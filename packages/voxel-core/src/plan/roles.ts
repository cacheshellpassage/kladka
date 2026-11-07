/**
 * Block roles and build stages.
 * Role codes are stored per voxel (Uint8Array); 0 means "unknown, classify automatically".
 */
export const ROLES = ["foundation", "frame", "walls", "openings", "roof", "interior", "decor", "lighting"] as const;
export type Role = (typeof ROLES)[number];

/** Stage order of construction. Lighting is placed during the decor stage. */
export const STAGES = ["foundation", "frame", "walls", "openings", "roof", "interior", "decor"] as const;
export type StageId = (typeof STAGES)[number];

export function roleCode(r: Role): number {
  return ROLES.indexOf(r) + 1;
}

export function roleFromCode(c: number): Role | null {
  return c > 0 && c <= ROLES.length ? ROLES[c - 1]! : null;
}

export function stageOfRole(r: Role): StageId {
  return r === "lighting" ? "decor" : r;
}

export function stageIndex(s: StageId): number {
  return STAGES.indexOf(s);
}
