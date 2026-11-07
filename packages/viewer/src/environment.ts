/** Sky, lights and time-of-day presets for the "shaders" mode. */
import * as THREE from "three";

export type TimeOfDay = "day" | "sunset" | "night";

export interface LightPreset {
  skyTop: number;
  skyHorizon: number;
  skyBottom: number;
  sunDir: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  exposure: number;
  glow: number;
  bloom: number;
  ground: number;
}

export const PRESETS: Record<TimeOfDay, LightPreset> = {
  day: {
    skyTop: 0x4f8ff0,
    skyHorizon: 0xcfe2fb,
    skyBottom: 0xcfe2fb,
    sunDir: [0.55, 0.8, 0.35],
    sunColor: 0xfff1dc,
    sunIntensity: 2.8,
    hemiSky: 0xc4dbff,
    hemiGround: 0x8c7b5c,
    hemiIntensity: 1.25,
    exposure: 1.0,
    glow: 0.4,
    bloom: 0.18,
    ground: 0x6f9150,
  },
  sunset: {
    skyTop: 0x3d5aa8,
    skyHorizon: 0xf3c9a4,
    skyBottom: 0xf3c9a4,
    sunDir: [0.75, 0.42, 0.62],
    sunColor: 0xffd3a2,
    sunIntensity: 3.4,
    hemiSky: 0xb7b4e0,
    hemiGround: 0x7a5a3a,
    hemiIntensity: 1.25,
    exposure: 1.22,
    glow: 1.3,
    bloom: 0.32,
    ground: 0x6c8a46,
  },
  night: {
    skyTop: 0x03061a,
    skyHorizon: 0x1b2850,
    skyBottom: 0x1b2850,
    sunDir: [-0.35, 0.75, -0.3],
    sunColor: 0x9fb6ff,
    sunIntensity: 0.38,
    hemiSky: 0x2d3f78,
    hemiGround: 0x0e0f18,
    hemiIntensity: 0.42,
    exposure: 1.15,
    glow: 3.2,
    bloom: 0.95,
    ground: 0x26331f,
  },
};

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uStars;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.55)) : mix(uHorizon, uBottom, pow(-h, 0.4));
  float sun = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sun, 900.0) * 6.0 + pow(sun, 18.0) * 0.35);
  if (uStars > 0.5 && h > 0.05) {
    vec3 cell = floor(d * 220.0);
    float s = step(0.9975, hash(cell));
    col += vec3(s) * 0.9 * h;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uBottom: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uStars: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }
  apply(p: LightPreset, time: TimeOfDay): void {
    const u = this.material.uniforms;
    (u.uTop!.value as THREE.Color).setHex(p.skyTop);
    (u.uHorizon!.value as THREE.Color).setHex(p.skyHorizon);
    (u.uBottom!.value as THREE.Color).setHex(p.skyBottom);
    (u.uSunDir!.value as THREE.Vector3).set(...p.sunDir).normalize();
    (u.uSunColor!.value as THREE.Color).setHex(p.sunColor);
    u.uStars!.value = time === "night" ? 1 : 0;
  }
  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
