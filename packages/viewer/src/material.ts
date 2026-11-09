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
  /** 0..1 progress of the "drop in" animation of the current step (1 = landed). */
  uDrop: { value: number };
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
    uHighlight: { value: new THREE.Color(0x2f7bff) },
    uGlow: { value: 1 },
    uRoleView: { value: 0 },
    uDrop: { value: 1 },
  };
}

/**
 * "Colour by stage" in 3D: one blue ramp from foundation (darkest) to decor (lightest), in build order;
 * lights stay amber. Validated as an ordinal ramp (monotone lightness, ΔL ≥ 0.06 between neighbours).
 */
export const ROLE_COLORS_3D: Record<string, string> = {
  foundation: "#013271",
  frame: "#034393",
  walls: "#1a57ad",
  openings: "#306dc4",
  roof: "#4582db",
  interior: "#5a98f3",
  decor: "#7baffc",
};

function glslColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  // shader colours are linear: convert from sRGB so the 3D view shows the same colours as the legend
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255).toFixed(4));
  return `vec3(${c.join(", ")})`;
}

const VERT_HEAD = /* glsl */ `
attribute vec3 aTex;
attribute vec4 aData;
uniform float uStep;
uniform float uDrop;
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
// blocks of the current step drop into place (clipping above uses the final position)
if (uDrop < 1.0 && abs(aData.x - uStep) < 0.5) {
  float kFall = 1.0 - uDrop;
  transformed.y += kFall * kFall * 1.6;
}
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
${Object.values(ROLE_COLORS_3D)
  .map((c, i) => `  if (r < ${i + 1}.5) return ${glslColor(c)};`)
  .join("\n")}
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
if (uRoleView > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb * 0.35 + 0.65 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), roleColor(vData.w), 0.82);
if (kFuture) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.72, 1.0), 0.55);
if (abs(kStep - uStep) < 0.5) {
  // current step: keep the material readable, outline every block face with the highlight colour
  vec2 kf = fract(kUv);
  float kEdge = min(min(kf.x, 1.0 - kf.x), min(kf.y, 1.0 - kf.y));
  float kLine = 1.0 - smoothstep(0.045, 0.1, kEdge);
  diffuseColor.rgb = mix(mix(diffuseColor.rgb, vec3(1.0), 0.14), uHighlight, max(kLine, 0.08));
}
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
