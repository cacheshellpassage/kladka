/**
 * Shader patches for three.js built-in materials: texture-array sampling with per-block repeat,
 * step visibility (built / current / future), section clipping, ghosting of lower layers,
 * block-type highlighting and Minecraft-like face shading for the classic mode.
 */
import * as THREE from "three";

export interface ViewerUniforms {
  uAtlas: { value: THREE.DataArrayTexture | null };
  uStep: { value: number };
  uShowFuture: { value: number };
  uClipMin: { value: THREE.Vector3 };
  uClipMax: { value: THREE.Vector3 };
  uFocusY: { value: number };
  uGhostBelow: { value: number };
  uSelPal: { value: number };
  uHighlight: { value: THREE.Color };
  uGlow: { value: number };
  uRoleView: { value: number };
}

export function createUniforms(): ViewerUniforms {
  return {
    uAtlas: { value: null },
    uStep: { value: 1e9 },
    uShowFuture: { value: 0 },
    uClipMin: { value: new THREE.Vector3(-1e6, -1e6, -1e6) },
    uClipMax: { value: new THREE.Vector3(1e6, 1e6, 1e6) },
    uFocusY: { value: -1e6 },
    uGhostBelow: { value: 0 },
    uSelPal: { value: -1 },
    uHighlight: { value: new THREE.Color(0xffc23a) },
    uGlow: { value: 1 },
    uRoleView: { value: 0 },
  };
}

const VERT_HEAD = /* glsl */ `
attribute vec3 aTex;
attribute vec4 aData;
varying vec3 vTex;
varying vec4 vData;
varying vec3 vWPos;
varying vec3 vNrmW;
`;

const VERT_BODY = /* glsl */ `
vTex = aTex;
vData = aData;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vNrmW = normal;
`;

const FRAG_HEAD = /* glsl */ `
uniform highp sampler2DArray uAtlas;
uniform float uStep;
uniform float uShowFuture;
uniform vec3 uClipMin;
uniform vec3 uClipMax;
uniform float uFocusY;
uniform float uGhostBelow;
uniform float uSelPal;
uniform vec3 uHighlight;
uniform float uGlow;
uniform float uRoleView;
varying vec3 vTex;
varying vec4 vData;
varying vec3 vWPos;
varying vec3 vNrmW;

vec3 roleColor(float r) {
  if (r < 0.5) return vec3(0.7);
  if (r < 1.5) return vec3(0.55, 0.45, 0.38);
  if (r < 2.5) return vec3(0.62, 0.42, 0.22);
  if (r < 3.5) return vec3(0.85, 0.78, 0.6);
  if (r < 4.5) return vec3(0.45, 0.7, 0.9);
  if (r < 5.5) return vec3(0.75, 0.3, 0.25);
  if (r < 6.5) return vec3(0.6, 0.5, 0.8);
  if (r < 7.5) return vec3(0.45, 0.75, 0.4);
  return vec3(1.0, 0.85, 0.3);
}

bool kladkaDither(float keepEvery) {
  vec2 p = floor(gl_FragCoord.xy);
  return mod(p.x + p.y * 2.0, keepEvery) > 0.5;
}
`;

/** Shared visibility + texturing code; leaves the sampled colour in diffuseColor. */
const FRAG_SAMPLE = /* glsl */ `
if (any(lessThan(vWPos, uClipMin)) || any(greaterThan(vWPos, uClipMax))) discard;
float kStep = vData.x;
bool kFuture = kStep > uStep + 0.5;
if (kFuture && uShowFuture < 0.5) discard;
if (kFuture && kladkaDither(4.0)) discard;
if (uGhostBelow > 0.5 && vWPos.y < uFocusY - 0.01 && kladkaDither(2.0)) discard;
vec2 kUv = vTex.xy;
vec4 kTexel = textureGrad(uAtlas, vec3(fract(kUv), vTex.z), dFdx(kUv), dFdy(kUv));
diffuseColor *= kTexel;
if (uRoleView > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, roleColor(vData.w), 0.65);
if (kFuture) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.72, 1.0), 0.55);
if (abs(kStep - uStep) < 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, uHighlight, 0.38);
if (uSelPal >= 0.0 && abs(vData.y - uSelPal) > 0.5) diffuseColor.rgb *= 0.28;
`;

const CLASSIC_SHADE = /* glsl */ `
{
  vec3 n = normalize(vNrmW);
  float shade = n.y > 0.5 ? 1.0 : (n.y < -0.5 ? 0.55 : (abs(n.z) > 0.5 ? 0.82 : 0.66));
  shade = mix(shade, 1.0, clamp(vData.z, 0.0, 1.0));
  diffuseColor.rgb *= shade;
}
`;

export type PatchKind = "classic" | "standard" | "depth";

/** Patches a material in place; returns it for chaining. */
export function patchMaterial<T extends THREE.Material>(
  mat: T,
  uniforms: ViewerUniforms,
  kind: PatchKind,
): T {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);
    let frag = shader.fragmentShader.replace("#include <common>", `#include <common>\n${FRAG_HEAD}`);
    if (kind === "depth") {
      // MeshDepthMaterial has no diffuseColor; emulate one for alpha testing
      // MeshDepthMaterial already declares diffuseColor; alpha-test cut-out textures in the shadow map
      frag = frag.replace("#include <map_fragment>", `${FRAG_SAMPLE}\nif (diffuseColor.a < 0.5) discard;`);
    } else {
      frag = frag.replace("#include <map_fragment>", FRAG_SAMPLE);
      if (kind === "classic")
        frag = frag.replace("#include <color_fragment>", `#include <color_fragment>\n${CLASSIC_SHADE}`);
      if (kind === "standard") {
        frag = frag.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * clamp(vData.z, 0.0, 1.0) * uGlow;`,
        );
      }
    }
    shader.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => `kladka-${kind}`;
  return mat;
}

export interface MaterialSet {
  opaque: THREE.Material;
  cutout: THREE.Material;
  translucent: THREE.Material;
  depth: THREE.MeshDepthMaterial;
}

export function createMaterials(mode: "classic" | "shaders", u: ViewerUniforms): MaterialSet {
  const mk = (pass: "opaque" | "cutout" | "translucent") => {
    const common = {
      vertexColors: true,
      transparent: pass === "translucent",
      depthWrite: pass !== "translucent",
      alphaTest: pass === "cutout" ? 0.5 : 0,
      side: THREE.FrontSide,
    } as const;
    if (mode === "classic") {
      return patchMaterial(new THREE.MeshBasicMaterial({ ...common, color: 0xffffff }), u, "classic");
    }
    return patchMaterial(
      new THREE.MeshStandardMaterial({
        ...common,
        color: 0xffffff,
        roughness: 0.92,
        metalness: 0,
        emissive: 0x000000,
      }),
      u,
      "standard",
    );
  };
  const depth = patchMaterial(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
    u,
    "depth",
  );
  return { opaque: mk("opaque"), cutout: mk("cutout"), translucent: mk("translucent"), depth };
}
