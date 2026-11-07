import type { GameAdapter } from "../types";
import { blockInfo } from "./blocks";
import { canonicalMaterial } from "./materials";
import { itemsFor, stackSize } from "./items";
import { itemName } from "./names";
import { shapeGeometry } from "./shapes";
import { finalizeConnections } from "./connections";
import { MC_DATA_VERSION, MC_VERSION } from "./version";

export const minecraftJava: GameAdapter = {
  id: "minecraft-java",
  displayName: "Minecraft Java Edition",
  versionLabel: MC_VERSION,
  dataVersion: MC_DATA_VERSION,
  blockInfo,
  materialOf: (s) => canonicalMaterial(s.name),
  shape: (s) => shapeGeometry(s, blockInfo(s.name)),
  itemsFor,
  stackSize,
  itemName,
  finalize: (m) => {
    finalizeConnections(m);
  },
};

export * from "./blocks";
export * from "./materials";
export * from "./items";
export * from "./names";
export * from "./shapes";
export * from "./connections";
export * from "./version";
