/**
 * Block roles and build stages.
 * Role codes are stored per voxel (Uint8Array); 0 means "unknown, classify automatically".
 * New roles are only ever appended: codes are stored in files.
 */
export const ROLES = [
  "foundation",
  "frame",
  "walls",
  "openings",
  "roof",
  "interior",
  "decor",
  "lighting",
  "site",
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Stage order of construction. "site" is the ground of the plot (lawn, paths, the soil under the house): it
 * comes first and is skipped when the ground is already there. The frame, the walls and the windows and doors
 * are one stage ("shell") built floor by floor, so the builder always stands on what is already there;
 * lighting is placed during the decor stage.
 */
export const STAGES = ["site", "foundation", "shell", "roof", "interior", "decor"] as const;
export type StageId = (typeof STAGES)[number];

export function roleCode(r: Role): number {
  return ROLES.indexOf(r) + 1;
}

export function roleFromCode(c: number): Role | null {
  return c > 0 && c <= ROLES.length ? ROLES[c - 1]! : null;
}

export function stageOfRole(r: Role): StageId {
  switch (r) {
    case "frame":
    case "walls":
    case "openings":
      return "shell";
    case "lighting":
      return "decor";
    default:
      return r;
  }
}

export function stageIndex(s: StageId): number {
  return STAGES.indexOf(s);
}
