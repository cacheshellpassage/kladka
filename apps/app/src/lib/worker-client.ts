import type { WorkerRequest, WorkerResponse, SerializedPlan } from "./worker";
import type { BuildMeta, BuildStats } from "@kladka/voxel-core";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const p = pending.get(ev.data.id);
      if (!p) return;
      pending.delete(ev.data.id);
      if (ev.data.kind === "error") p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || "worker error"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

function call(req: WithoutId<WorkerRequest>, transfer = false): Promise<WorkerResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const msg = { ...req, id } as WorkerRequest;
    getWorker().postMessage(msg, transfer ? [req.bytes.buffer] : []);
  });
}

export async function planInWorker(bytes: Uint8Array): Promise<SerializedPlan> {
  const r = await call({ kind: "plan", bytes: bytes.slice() }, true);
  if (r.kind !== "plan") throw new Error("unexpected response");
  return r.plan;
}

export async function importInWorker(
  bytes: Uint8Array,
  filename: string,
  importId: string,
): Promise<{ bytes: Uint8Array; meta: BuildMeta; stats: BuildStats; warnings: string[]; format: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const r = await call({ kind: "import", bytes, filename, importId, date }, true);
  if (r.kind !== "import") throw new Error("unexpected response");
  return r;
}

export type { SerializedPlan };
