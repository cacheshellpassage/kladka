import type { GameId } from "../model/blockstate";
import type { GameAdapter } from "./types";
import { minecraftJava } from "./minecraft-java";

const adapters: Record<GameId, GameAdapter> = {
  "minecraft-java": minecraftJava,
};

export function gameAdapter(id: GameId): GameAdapter {
  const a = adapters[id];
  if (!a) throw new Error(`Unsupported game: ${id}`);
  return a;
}

export type { GameAdapter };
