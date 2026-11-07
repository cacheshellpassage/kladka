/**
 * Three.js voxel viewer: chunked meshes, step-by-step visibility, section clipping, classic and
 * "shaders" rendering modes, orbit camera with touch gestures, picking, animation and capture.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { VoxelModel } from "@kladka/voxel-core";
import { buildPaletteRender, type PaletteRender, type TextureProvider } from "./palette-render";
import {
  CHUNK,
  meshChunk,
  nonEmptyChunks,
  type ClipBox,
  type MeshBuffers,
  type RenderPass as Pass,
} from "./mesher";
import { createMaterials, createUniforms, type MaterialSet, type ViewerUniforms } from "./material";
import { PRESETS, SkyDome, type TimeOfDay } from "./environment";
import { TEX } from "./textures";

export type RenderMode = "classic" | "shaders";
export type Quality = "low" | "medium" | "high";
export type Theme = "light" | "dark";

export interface ViewerOptions {
  mode?: RenderMode;
  quality?: Quality;
  theme?: Theme;
  timeOfDay?: TimeOfDay;
  /** Keep the drawing buffer (needed for some capture paths). */
  preserveDrawingBuffer?: boolean;
  /** Max device pixel ratio. */
  maxPixelRatio?: number;
  /** Show ground plane/grid. Default true. */
  ground?: boolean;
  antialias?: boolean;
}

export interface PickResult {
  x: number;
  y: number;
  z: number;
  palette: number;
  step: number;
}

interface ChunkEntry {
  origin: [number, number, number];
  meshes: THREE.Mesh[];
}

const PASS_ORDER: Pass[] = ["opaque", "cutout", "translucent"];

export class VoxelViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private uniforms: ViewerUniforms = createUniforms();
  private materials: MaterialSet;
  private root = new THREE.Group();
  private chunks = new Map<string, ChunkEntry>();
  private model: VoxelModel | null = null;
  private table: PaletteRender[] = [];
  private stepOf: Int32Array | null = null;
  private roles: Uint8Array | null = null;
  private atlas: THREE.DataArrayTexture | null = null;
  private clip: ClipBox | null = null;
  private provider: TextureProvider | null = null;
  private mode: RenderMode;
  private quality: Quality;
  private theme: Theme;
  private timeOfDay: TimeOfDay;
  private sky = new SkyDome();
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private ground: THREE.Mesh;
  private grid: THREE.GridHelper | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gtaoPass: GTAOPass | null = null;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private resizeObs: ResizeObserver | null = null;
  private animation: {
    start: number;
    duration: number;
    from: number;
    to: number;
    onDone?: () => void;
  } | null = null;
  private stepValue: number | null = null;
  /** Camera distance that frames the whole model (set by resetCamera). */
  private fitDistance = 30;
  private flight: {
    start: number;
    duration: number;
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null = null;
  private buildToken = 0;
  private showGround: boolean;
  private maxPixelRatio: number;
  /** Called after each rendered frame (used for GIF/video capture). */
  onFrame: (() => void) | null = null;
  onContextLost: (() => void) | null = null;

  constructor(
    private container: HTMLElement,
    opts: ViewerOptions = {},
  ) {
    this.mode = opts.mode ?? "classic";
    this.quality = opts.quality ?? "medium";
    this.theme = opts.theme ?? "light";
    this.timeOfDay = opts.timeOfDay ?? "day";
    this.showGround = opts.ground ?? true;
    this.maxPixelRatio = opts.maxPixelRatio ?? 2;

    this.renderer = new THREE.WebGLRenderer({
      antialias: opts.antialias ?? this.quality !== "low",
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.onContextLost?.();
    });
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    this.camera.position.set(30, 25, 30);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener("change", () => (this.dirty = true));
    // the user takes over: stop any automatic camera flight
    this.controls.addEventListener("start", () => (this.flight = null));

    this.materials = createMaterials(this.mode, this.uniforms);
    this.scene.add(this.root);
    this.scene.add(this.sky.mesh);
    this.sky.mesh.onBeforeRender = (_r, _s, cam) => {
      this.sky.mesh.position.copy(cam.position);
    };
    this.scene.add(this.sun, this.sun.target, this.hemi);
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x6f9150, roughness: 1, metalness: 0 }),
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.applyEnvironment();
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(container);
    }
    this.loop();
  }

  /* ------------------------------------------------------------------ */
  /* model                                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Shows a model. `stepOf`/`roles` come from the build plan (optional).
   * Meshes are built progressively in small time slices so the UI stays responsive.
   */
  async setModel(
    model: VoxelModel,
    plan?: { stepOf: Int32Array; roles?: Uint8Array } | null,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const token = ++this.buildToken;
    this.clearChunks();
    this.model = model;
    this.stepOf = plan?.stepOf ?? null;
    this.roles = plan?.roles ?? null;
    this.rebuildAtlas();
    this.root.position.set(-model.size.x / 2, 0, -model.size.z / 2);
    this.layoutEnvironment();
    this.updateClipUniforms();
    this.resetCamera();
    const list = nonEmptyChunks(model, CHUNK);
    let i = 0;
    while (i < list.length) {
      if (token !== this.buildToken || this.disposed) return;
      const t0 = performance.now();
      while (i < list.length && performance.now() - t0 < 14) {
        this.buildChunk(list[i]!);
        i++;
      }
      onProgress?.(i / list.length);
      this.dirty = true;
      if (i < list.length) await nextFrame();
    }
  }

  getModel(): VoxelModel | null {
    return this.model;
  }

  setTextureProvider(p: TextureProvider | null): void {
    this.provider = p;
    if (!this.model) return;
    this.rebuildAtlas();
    this.rebuildAll();
  }

  private rebuildAtlas(): void {
    if (!this.model) return;
    const { table, atlas } = buildPaletteRender(this.model.palette, this.provider);
    this.table = table;
    const n = atlas.layers.length;
    const data = new Uint8Array(TEX * TEX * 4 * n);
    atlas.layers.forEach((l, i) => data.set(l, i * TEX * TEX * 4));
    this.atlas?.dispose();
    const tex = new THREE.DataArrayTexture(data, TEX, TEX, n);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.generateMipmaps = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    this.atlas = tex;
    this.uniforms.uAtlas.value = tex;
  }

  private chunkKey(o: [number, number, number]): string {
    return `${o[0]},${o[1]},${o[2]}`;
  }

  private buildChunk(origin: [number, number, number]): void {
    if (!this.model) return;
    const key = this.chunkKey(origin);
    this.disposeChunk(key);
    const mesh = meshChunk(
      { model: this.model, table: this.table, stepOf: this.stepOf, roles: this.roles, clip: this.clip },
      origin[0],
      origin[1],
      origin[2],
      CHUNK,
    );
    const entry: ChunkEntry = { origin, meshes: [] };
    for (const pass of PASS_ORDER) {
      const buf = mesh[pass];
      if (!buf) continue;
      const m = new THREE.Mesh(toGeometry(buf), this.materials[pass]);
      m.customDepthMaterial = this.materials.depth;
      m.castShadow = pass !== "translucent";
      m.receiveShadow = true;
      m.userData.pass = pass;
      m.renderOrder = pass === "translucent" ? 10 : 0;
      this.root.add(m);
      entry.meshes.push(m);
    }
    this.chunks.set(key, entry);
  }

  private disposeChunk(key: string): void {
    const e = this.chunks.get(key);
    if (!e) return;
    for (const m of e.meshes) {
      this.root.remove(m);
      m.geometry.dispose();
    }
    this.chunks.delete(key);
  }

  private clearChunks(): void {
    for (const k of [...this.chunks.keys()]) this.disposeChunk(k);
  }

  private rebuildAll(): void {
    if (!this.model) return;
    for (const o of nonEmptyChunks(this.model, CHUNK)) this.buildChunk(o);
    this.dirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* step / clip / highlight                                               */
  /* ------------------------------------------------------------------ */

  /** Shows the build up to `step` (highlighting it). `null` shows everything. */
  setStep(step: number | null): void {
    this.stepValue = step;
    this.uniforms.uStep.value = step === null ? 1e9 : step;
    this.updateComposerPasses();
    this.dirty = true;
  }

  setShowFuture(show: boolean): void {
    this.uniforms.uShowFuture.value = show ? 1 : 0;
    this.dirty = true;
  }

  /** Dither (semi-transparent look) everything below layer `y`. */
  setGhostBelow(enabled: boolean, y = 0): void {
    this.uniforms.uGhostBelow.value = enabled ? 1 : 0;
    this.uniforms.uFocusY.value = y;
    this.dirty = true;
  }

  setSelectedPalette(p: number | null): void {
    this.uniforms.uSelPal.value = p ?? -1;
    this.dirty = true;
  }

  setRoleView(on: boolean): void {
    this.uniforms.uRoleView.value = on ? 1 : 0;
    this.dirty = true;
  }

  /**
   * Section view: only blocks inside [min, max) (block coordinates) are shown. Affected chunks are
   * rebuilt so that cut faces are closed.
   */
  setClip(clip: ClipBox | null): void {
    const prev = this.clip;
    this.clip = clip;
    this.updateClipUniforms();
    this.updateComposerPasses();
    if (!this.model) return;
    // iterate over a snapshot: buildChunk() re-inserts keys, which would revisit them forever
    for (const e of [...this.chunks.values()]) {
      if (chunkTouchesClipChange(e.origin, prev, clip)) this.buildChunk(e.origin);
    }
    // chunks that were completely empty after clipping may need building again
    for (const o of nonEmptyChunks(this.model, CHUNK))
      if (!this.chunks.has(this.chunkKey(o))) this.buildChunk(o);
    this.dirty = true;
  }

  getClip(): ClipBox | null {
    return this.clip;
  }

  private updateClipUniforms(): void {
    const off = this.root.position;
    if (!this.clip) {
      this.uniforms.uClipMin.value.set(-1e6, -1e6, -1e6);
      this.uniforms.uClipMax.value.set(1e6, 1e6, 1e6);
      return;
    }
    const e = 0.001;
    this.uniforms.uClipMin.value.set(
      this.clip.min[0] + off.x - e,
      this.clip.min[1] + off.y - e,
      this.clip.min[2] + off.z - e,
    );
    this.uniforms.uClipMax.value.set(
      this.clip.max[0] + off.x + e,
      this.clip.max[1] + off.y + e,
      this.clip.max[2] + off.z + e,
    );
  }

  /* ------------------------------------------------------------------ */
  /* modes & environment                                                   */
  /* ------------------------------------------------------------------ */

  setMode(mode: RenderMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    const old = this.materials;
    this.materials = createMaterials(mode, this.uniforms);
    for (const e of this.chunks.values())
      for (const m of e.meshes) {
        m.material = this.materials[m.userData.pass as Pass];
        m.customDepthMaterial = this.materials.depth;
      }
    for (const k of ["opaque", "cutout", "translucent", "depth"] as const) old[k].dispose();
    this.applyEnvironment();
  }

  getMode(): RenderMode {
    return this.mode;
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.applyEnvironment();
    this.resize();
  }

  setTimeOfDay(t: TimeOfDay): void {
    this.timeOfDay = t;
    this.applyEnvironment();
  }

  setTheme(t: Theme): void {
    this.theme = t;
    this.applyEnvironment();
  }

  setGroundVisible(v: boolean): void {
    this.showGround = v;
    this.applyEnvironment();
  }

  private applyEnvironment(): void {
    const shaders = this.mode === "shaders";
    const p = PRESETS[this.timeOfDay];
    this.sky.mesh.visible = shaders;
    this.sun.visible = shaders;
    this.hemi.visible = shaders;
    this.ground.visible = shaders && this.showGround;
    if (this.grid) this.grid.visible = !shaders && this.showGround;
    if (shaders) {
      this.sky.apply(p, this.timeOfDay);
      this.scene.background = new THREE.Color(p.skyHorizon);
      this.scene.fog = new THREE.Fog(p.skyHorizon, 1, 2);
      this.sun.color.setHex(p.sunColor);
      this.sun.intensity = p.sunIntensity;
      this.hemi.color.setHex(p.hemiSky);
      this.hemi.groundColor.setHex(p.hemiGround);
      this.hemi.intensity = p.hemiIntensity;
      (this.ground.material as THREE.MeshStandardMaterial).color.setHex(p.ground);
      this.uniforms.uGlow.value = p.glow;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = p.exposure;
      const shadows = this.quality !== "low";
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
      this.sun.shadow.mapSize.set(
        this.quality === "high" ? 2048 : 1024,
        this.quality === "high" ? 2048 : 1024,
      );
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
      this.sun.shadow.radius = 3;
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    } else {
      this.scene.background = new THREE.Color(this.theme === "dark" ? 0x1a1e26 : 0xdfe7ef);
      this.scene.fog = null;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.renderer.shadowMap.enabled = false;
    }
    this.layoutEnvironment();
    this.setupComposer();
    this.dirty = true;
  }

  private layoutEnvironment(): void {
    const m = this.model;
    const sx = m?.size.x ?? 16,
      sy = m?.size.y ?? 16,
      sz = m?.size.z ?? 16;
    const r = Math.max(8, Math.hypot(sx, sy, sz) / 2);
    this.ground.scale.setScalar(r * 40);
    this.ground.position.y = -0.002;
    const p = PRESETS[this.timeOfDay];
    const d = new THREE.Vector3(...p.sunDir).normalize();
    this.sun.position.copy(d.multiplyScalar(r * 3)).add(new THREE.Vector3(0, sy / 2, 0));
    this.sun.target.position.set(0, sy / 3, 0);
    const cam = this.sun.shadow.camera;
    cam.left = -r * 1.2;
    cam.right = r * 1.2;
    cam.top = r * 1.2;
    cam.bottom = -r * 1.2;
    cam.near = 0.5;
    cam.far = r * 8;
    cam.updateProjectionMatrix();
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = r * 4;
      this.scene.fog.far = r * 14;
    }
    // classic-mode grid
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
    }
    const gsize = Math.ceil((Math.max(sx, sz) * 1.6) / 2) * 2 + 4;
    const dark = this.theme === "dark";
    this.grid = new THREE.GridHelper(gsize, gsize, dark ? 0x3a4250 : 0xb5c2cf, dark ? 0x2a303a : 0xcbd5df);
    this.grid.position.set(sx % 2 ? 0.5 : 0, -0.01, sz % 2 ? 0.5 : 0);
    this.grid.visible = this.mode === "classic" && this.showGround;
    this.scene.add(this.grid);
    this.camera.far = r * 30;
    this.camera.updateProjectionMatrix();
  }

  private needsAO(): boolean {
    return (
      this.mode === "shaders" && this.quality === "high" && this.stepValue === null && this.clip === null
    );
  }

  private setupComposer(): void {
    const shaders = this.mode === "shaders";
    const want = shaders && this.quality !== "low";
    if (!want) {
      this.composer?.dispose();
      this.composer = null;
      this.bloomPass = null;
      this.gtaoPass = null;
      return;
    }
    if (!this.composer) {
      const size = this.renderer.getSize(new THREE.Vector2());
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtaoPass = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.gtaoPass.blendIntensity = 0.85;
      composer.addPass(this.gtaoPass);
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.5, 0.82);
      composer.addPass(this.bloomPass);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.resize();
    }
    const p = PRESETS[this.timeOfDay];
    if (this.bloomPass) this.bloomPass.strength = p.bloom;
    this.updateComposerPasses();
  }

  private updateComposerPasses(): void {
    if (this.gtaoPass) this.gtaoPass.enabled = this.needsAO();
    this.dirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* camera                                                                */
  /* ------------------------------------------------------------------ */

  /** Camera presets: 0 = front-right, 1 = back-right, 2 = back-left, 3 = front-left, 4 = top. */
  resetCamera(preset = 0): void {
    this.flight = null;
    const m = this.model;
    const sx = m?.size.x ?? 16,
      sy = m?.size.y ?? 16,
      sz = m?.size.z ?? 16;
    const target = new THREE.Vector3(0, sy / 2, 0);
    const az =
      [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4][preset % 4] ?? Math.PI / 4;
    const el = preset === 4 ? Math.PI * 0.47 : THREE.MathUtils.degToRad(26);
    // direction from target to camera
    const back = new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    ).normalize();
    const fwd = back.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * 0.9;
    const tanH = tanV * Math.max(0.3, this.camera.aspect);
    // smallest distance that keeps every bounding-box corner inside the frustum
    let fit = 4;
    for (const cx of [-sx / 2, sx / 2])
      for (const cy of [-sy / 2, sy / 2])
        for (const cz of [-sz / 2, sz / 2]) {
          const p = new THREE.Vector3(cx, cy, cz);
          const z = p.dot(fwd);
          fit = Math.max(fit, z + Math.abs(p.dot(right)) / tanH, z + Math.abs(p.dot(up)) / tanV);
        }
    this.fitDistance = fit;
    this.camera.position.copy(target).addScaledVector(back, fit);
    this.controls.target.copy(target);
    this.controls.minDistance = 2;
    this.controls.maxDistance = fit * 4;
    this.camera.near = Math.max(0.05, fit / 500);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.dirty = true;
  }

  /**
   * Smoothly moves the camera to frame a box of blocks (model coordinates, max exclusive).
   * - exterior work (box near the outline of the build): camera moves to that side of the build;
   * - interior work (box well inside the footprint): camera looks down steeply over the walls;
   * - `minDistance` keeps some context around small steps.
   * Any user interaction (drag, pinch, wheel) cancels the flight.
   */
  focusOn(
    min: [number, number, number],
    max: [number, number, number],
    opts: { durationMs?: number; minDistance?: number; interior?: boolean; closeness?: number } = {},
  ): void {
    const m = this.model;
    if (!m) return;
    const off = this.root.position;
    const center = new THREE.Vector3(
      (min[0] + max[0]) / 2 + off.x,
      (min[1] + max[1]) / 2 + off.y,
      (min[2] + max[2]) / 2 + off.z,
    );
    const half = new THREE.Vector3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2);
    // where is the work relative to the footprint?
    const fx = center.x / Math.max(1, m.size.x / 2);
    const fz = center.z / Math.max(1, m.size.z / 2);
    const edge = Math.max(Math.abs(fx), Math.abs(fz)); // 0 = centre, 1 = outline
    const interior = opts.interior ?? (edge < 0.55 && half.x < m.size.x * 0.4 && half.z < m.size.z * 0.4);

    const cur = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let theta = cur.theta;
    if (!interior && edge > 0.15) {
      const wanted = Math.atan2(center.x, center.z); // azimuth pointing from the centre to the work
      // only swing round when the work is on a side we can't see well (> 70° away)
      const diff = Math.atan2(Math.sin(wanted - theta), Math.cos(wanted - theta));
      if (Math.abs(diff) > THREE.MathUtils.degToRad(70))
        theta = theta + diff - Math.sign(diff) * THREE.MathUtils.degToRad(35);
    }
    const phi = interior
      ? THREE.MathUtils.degToRad(32)
      : THREE.MathUtils.clamp(cur.phi, THREE.MathUtils.degToRad(48), THREE.MathUtils.degToRad(72));

    // distance that fits the box (plus margin) in the frustum
    const back = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, phi, theta)).normalize();
    const fwd = back.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * 0.75;
    const tanH = tanV * Math.max(0.3, this.camera.aspect);
    // stay far enough to keep the building around the step in view
    let dist = opts.minDistance ?? Math.max(9, this.fitDistance * 0.72 * (opts.closeness ?? 1));
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const p = new THREE.Vector3(sx * half.x, sy * half.y, sz * half.z);
          const z = p.dot(fwd);
          dist = Math.max(dist, z + Math.abs(p.dot(right)) / tanH, z + Math.abs(p.dot(up)) / tanV);
        }
    dist = Math.min(dist, this.controls.maxDistance);
    const toPos = center.clone().addScaledVector(back, dist);
    this.flight = {
      start: performance.now(),
      duration: opts.durationMs ?? 650,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos,
      toTarget: center,
    };
    this.dirty = true;
  }

  isFlying(): boolean {
    return this.flight !== null;
  }

  private stepFlight(): void {
    const f = this.flight;
    if (!f) return;
    const t = Math.min(1, (performance.now() - f.start) / f.duration);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    // interpolate around the target (spherically) to avoid cutting through the build
    const target = f.fromTarget.clone().lerp(f.toTarget, e);
    const a = new THREE.Spherical().setFromVector3(f.fromPos.clone().sub(f.fromTarget));
    const b = new THREE.Spherical().setFromVector3(f.toPos.clone().sub(f.toTarget));
    const dTheta = Math.atan2(Math.sin(b.theta - a.theta), Math.cos(b.theta - a.theta));
    const s = new THREE.Spherical(
      a.radius + (b.radius - a.radius) * e,
      a.phi + (b.phi - a.phi) * e,
      a.theta + dTheta * e,
    );
    this.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));
    this.controls.target.copy(target);
    this.camera.lookAt(target);
    this.dirty = true;
    if (t >= 1) this.flight = null;
  }

  /** Orbits the camera by an angle (radians), e.g. for keyboard controls. */
  orbit(dAzimuth: number, dElevation = 0): void {
    this.flight = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta += dAzimuth;
    sph.phi = THREE.MathUtils.clamp(sph.phi - dElevation, 0.05, this.controls.maxPolarAngle);
    offset.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.dirty = true;
  }

  zoom(factor: number): void {
    this.flight = null;
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
    const len = THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance);
    offset.setLength(len);
    this.camera.position.copy(this.controls.target).add(offset);
    this.dirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* picking                                                               */
  /* ------------------------------------------------------------------ */

  pick(clientX: number, clientY: number): PickResult | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const e of this.chunks.values()) meshes.push(...e.meshes);
    const hits = ray.intersectObjects(meshes, false);
    const cur = this.uniforms.uStep.value;
    for (const h of hits) {
      if (!h.face) continue;
      const geo = (h.object as THREE.Mesh).geometry;
      const data = geo.getAttribute("aData") as THREE.BufferAttribute;
      const step = data.getX(h.face.a);
      const palette = data.getY(h.face.a);
      if (step > cur + 0.5 && this.uniforms.uShowFuture.value < 0.5) continue;
      const local = h.point.clone().sub(this.root.position).addScaledVector(h.face.normal, -0.01);
      const x = Math.floor(local.x),
        y = Math.floor(local.y),
        z = Math.floor(local.z);
      if (this.clip) {
        const { min, max } = this.clip;
        if (x < min[0] || y < min[1] || z < min[2] || x >= max[0] || y >= max[1] || z >= max[2]) continue;
      }
      return { x, y, z, palette, step };
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* animation & capture                                                   */
  /* ------------------------------------------------------------------ */

  /** Animates the build growing from step `from` to `to` over `durationMs`. */
  animateBuild(totalSteps: number, durationMs: number, onDone?: () => void, from = 0): void {
    this.animation = { start: performance.now(), duration: durationMs, from, to: totalSteps, onDone };
  }

  stopAnimation(): void {
    this.animation = null;
  }

  isAnimating(): boolean {
    return this.animation !== null;
  }

  /** Renders immediately (synchronously) and returns the canvas. */
  renderNow(): HTMLCanvasElement {
    this.controls.update();
    this.draw();
    return this.renderer.domElement;
  }

  /** Renders at a given size and returns a data URL (PNG/JPEG/WebP). */
  capture(width: number, height: number, type = "image/png", quality = 0.9): string {
    const prevSize = this.renderer.getSize(new THREE.Vector2());
    const prevRatio = this.renderer.getPixelRatio();
    const prevAspect = this.camera.aspect;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(1);
    this.composer?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.draw();
    const url = this.renderer.domElement.toDataURL(type, quality);
    this.renderer.setPixelRatio(prevRatio);
    this.renderer.setSize(prevSize.x, prevSize.y, false);
    this.composer?.setPixelRatio(prevRatio);
    this.composer?.setSize(prevSize.x, prevSize.y);
    this.camera.aspect = prevAspect;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    return url;
  }

  requestRender(): void {
    this.dirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* loop                                                                  */
  /* ------------------------------------------------------------------ */

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const ratio = Math.min(dpr, this.quality === "low" ? 1.25 : this.maxPixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(ratio);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.stepFlight();
    const moved = this.flight ? false : this.controls.update();
    if (this.animation) {
      const a = this.animation;
      const t = Math.min(1, (performance.now() - a.start) / a.duration);
      const step = Math.floor(a.from + (a.to - a.from) * t);
      this.uniforms.uStep.value = t >= 1 ? 1e9 : step;
      this.dirty = true;
      if (t >= 1) {
        this.animation = null;
        this.uniforms.uStep.value = this.stepValue ?? 1e9;
        a.onDone?.();
      }
    }
    if (moved || this.dirty) {
      this.dirty = false;
      this.draw();
      this.onFrame?.();
    }
  };

  private draw(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    this.clearChunks();
    this.controls.dispose();
    this.atlas?.dispose();
    for (const k of ["opaque", "cutout", "translucent", "depth"] as const) this.materials[k].dispose();
    this.sky.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function toGeometry(b: MeshBuffers): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(b.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(b.normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(b.colors, 3));
  g.setAttribute("aTex", new THREE.BufferAttribute(b.tex, 3));
  g.setAttribute("aData", new THREE.BufferAttribute(b.data, 4));
  g.setIndex(new THREE.BufferAttribute(b.indices, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Signature of the clip box restricted to a chunk (plus a 1-block margin for neighbour culling). */
function clipSignature(origin: [number, number, number], c: ClipBox | null): string {
  const lo = origin.map((v) => v - 1);
  const hi = origin.map((v) => v + CHUNK + 1);
  if (!c) return lo.join() + "|" + hi.join();
  const mn = [0, 1, 2].map((i) => Math.max(lo[i]!, c.min[i]!));
  const mx = [0, 1, 2].map((i) => Math.min(hi[i]!, c.max[i]!));
  if (mn.some((v, i) => v >= mx[i]!)) return "empty";
  return mn.join() + "|" + mx.join();
}

function chunkTouchesClipChange(
  origin: [number, number, number],
  a: ClipBox | null,
  b: ClipBox | null,
): boolean {
  return clipSignature(origin, a) !== clipSignature(origin, b);
}

function nextFrame(): Promise<void> {
  return new Promise((r) =>
    typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(() => r()) : setTimeout(r, 0),
  );
}
