/// <reference lib="webworker" />
/**
 * Background worker: heavy work (parsing imports, planning steps) runs here so the UI stays smooth.
 */
import {
  decodeKBuild,
  encodeKBuild,
  estimate,
  importBytes,
  materialList,
  planBuild,
  type BuildMeta,
  type BuildStats,
} from "@kladka/voxel-core";

export type WorkerRequest =
  | { kind: "plan"; id: number; bytes: Uint8Array }
  | { kind: "import"; id: number; bytes: Uint8Array; filename: string; importId: string; date: string };

export interface SerializedPlan {
  steps: Array<{ stage: string; layer: number; blocks: Int32Array; deferred?: boolean; scaffold?: boolean }>;
  stages: Array<{
    id: string;
    stepStart: number;
    stepEnd: number;
    blockCount: number;
    layers: Array<{ y: number; stepStart: number; stepEnd: number }>;
  }>;
  stepOf: Int32Array;
  roles: Uint8Array;
  totalBlocks: number;
  groundY: number;
  warnings: string[];
}

export type WorkerResponse =
  | { kind: "plan"; id: number; plan: SerializedPlan }
  | {
      kind: "import";
      id: number;
      bytes: Uint8Array;
      meta: BuildMeta;
      stats: BuildStats;
      warnings: string[];
      format: string;
    }
  | { kind: "error"; id: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function serialize(plan: ReturnType<typeof planBuild>): { plan: SerializedPlan; transfer: Transferable[] } {
  const transfer: Transferable[] = [];
  const steps = plan.steps.map((s) => {
    const blocks = Int32Array.from(s.blocks);
    transfer.push(blocks.buffer);
    return { stage: s.stage, layer: s.layer, blocks, deferred: s.deferred, scaffold: s.scaffold };
  });
  transfer.push(plan.stepOf.buffer, plan.roles.buffer);
  return {
    plan: {
      steps,
      stages: plan.stages.map((s) => ({
        id: s.id,
        stepStart: s.stepStart,
        stepEnd: s.stepEnd,
        blockCount: s.blockCount,
        layers: s.layers,
      })),
      stepOf: plan.stepOf,
      roles: plan.roles,
      totalBlocks: plan.totalBlocks,
      groundY: plan.groundY,
      warnings: plan.warnings,
    },
    transfer,
  };
}

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.kind === "plan") {
      const { model } = decodeKBuild(req.bytes);
      const { plan, transfer } = serialize(planBuild(model));
      ctx.postMessage({ kind: "plan", id: req.id, plan } satisfies WorkerResponse, transfer);
      return;
    }
    if (req.kind === "import") {
      const res = importBytes(req.bytes, req.filename);
      const model = res.model.trimmed();
      model.compactPalette();
      if (model.countBlocks() === 0) throw new Error("empty structure");
      const plan = planBuild(model);
      const mats = materialList(model);
      const est = estimate(model, plan, mats.length);
      const base = req.filename.replace(/\.[^.]+$/, "");
      const title = res.meta?.title ?? { ru: model.meta.name || base, en: model.meta.name || base };
      const meta: BuildMeta = res.meta
        ? { ...res.meta, id: req.importId }
        : {
            id: req.importId,
            title,
            description: model.meta.description
              ? { ru: model.meta.description, en: model.meta.description }
              : undefined,
            author: model.meta.author || "—",
            license: "—",
            createdAt: req.date,
            style: "imported",
            tags: [res.format],
          };
      const stats: BuildStats = {
        size: [model.size.x, model.size.y, model.size.z],
        blocks: plan.totalBlocks,
        materials: mats.length,
        steps: plan.steps.length,
        difficulty: est.difficulty,
        minutes: est.minutes,
      };
      const bytes = encodeKBuild(model, meta);
      ctx.postMessage(
        {
          kind: "import",
          id: req.id,
          bytes,
          meta,
          stats,
          warnings: [...res.warnings, ...plan.warnings],
          format: res.format,
        } satisfies WorkerResponse,
        [bytes.buffer],
      );
    }
  } catch (e) {
    ctx.postMessage({
      kind: "error",
      id: req.id,
      message: e instanceof Error ? e.message : String(e),
    } satisfies WorkerResponse);
  }
};
