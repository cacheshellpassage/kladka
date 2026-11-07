/**
 * Computes neighbour-dependent block-state properties (fence/pane/wall connections, stair shapes),
 * so that generated builds look right and exported files contain correct states.
 * The rules are a simplified re-implementation of the in-game behaviour.
 */
import { shortId, withProps, type BlockState } from "../../model/blockstate";
import type { VoxelModel } from "../../model/model";
import { blockInfo } from "./blocks";
import { clockwise, counterClockwise, opposite, type Horizontal } from "./shapes";

const OFF: Record<Horizontal, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};
const SIDES: Horizontal[] = ["north", "east", "south", "west"];

function isSolid(s: BlockState): boolean {
  const i = blockInfo(s.name);
  return (i.shape === "cube" && i.render !== "none") || (i.shape === "slab" && s.props.type === "double");
}

function isWoodFence(name: string): boolean {
  const s = shortId(name);
  return s.endsWith("_fence") && s !== "nether_brick_fence";
}

function connectsFence(self: BlockState, other: BlockState, side: Horizontal): boolean {
  const oi = blockInfo(other.name);
  if (oi.shape === "fence") return isWoodFence(self.name) === isWoodFence(other.name);
  if (oi.shape === "fence_gate") {
    const f = other.props.facing ?? "north";
    const axisNS = f === "north" || f === "south";
    return axisNS ? side === "east" || side === "west" : side === "north" || side === "south";
  }
  if (oi.shape === "stairs") return other.props.facing === opposite(side);
  return isSolid(other);
}

function connectsPane(other: BlockState): boolean {
  const oi = blockInfo(other.name);
  return oi.shape === "pane" || oi.shape === "wall" || isSolid(other) || shortId(other.name).includes("glass");
}

function connectsWall(other: BlockState, side: Horizontal): boolean {
  const oi = blockInfo(other.name);
  if (oi.shape === "wall" || oi.shape === "pane") return true;
  if (oi.shape === "fence_gate") {
    const f = other.props.facing ?? "north";
    const axisNS = f === "north" || f === "south";
    return axisNS ? side === "east" || side === "west" : side === "north" || side === "south";
  }
  return isSolid(other);
}

function stairShape(m: VoxelModel, x: number, y: number, z: number, st: BlockState): string {
  const facing = (st.props.facing ?? "north") as Horizontal;
  const half = st.props.half ?? "bottom";
  const at = (f: Horizontal): BlockState => {
    const [dx, dz] = OFF[f];
    return m.get(x + dx, y, z + dz);
  };
  const isStair = (s: BlockState) => blockInfo(s.name).shape === "stairs";
  const axis = (f: string) => (f === "north" || f === "south" ? "z" : "x");
  const canTake = (face: Horizontal) => {
    const o = at(face);
    return !isStair(o) || o.props.facing !== facing || (o.props.half ?? "bottom") !== half;
  };

  const front = at(facing);
  if (isStair(front) && (front.props.half ?? "bottom") === half) {
    const d = (front.props.facing ?? "north") as Horizontal;
    if (axis(d) !== axis(facing) && canTake(opposite(d))) {
      return d === counterClockwise(facing) ? "outer_left" : "outer_right";
    }
  }
  const back = at(opposite(facing));
  if (isStair(back) && (back.props.half ?? "bottom") === half) {
    const d = (back.props.facing ?? "north") as Horizontal;
    if (axis(d) !== axis(facing) && canTake(d)) {
      return d === counterClockwise(facing) ? "inner_left" : "inner_right";
    }
  }
  void clockwise;
  return "straight";
}

/**
 * Updates connection/shape properties for all fences, panes, walls and stairs in the model.
 * Waterlogging is set to false where the property is relevant. Returns the number of changed voxels.
 */
export function finalizeConnections(m: VoxelModel): number {
  let changed = 0;
  const updates: Array<[number, number, number, BlockState]> = [];
  for (const { x, y, z, p } of m.nonAir()) {
    const st = m.palette[p]!;
    const info = blockInfo(st.name);
    let next: BlockState | null = null;
    switch (info.shape) {
      case "fence": {
        const patch: Record<string, string> = { waterlogged: "false" };
        for (const side of SIDES) {
          const [dx, dz] = OFF[side];
          patch[side] = String(connectsFence(st, m.get(x + dx, y, z + dz), side));
        }
        next = withProps(st, patch);
        break;
      }
      case "pane": {
        const patch: Record<string, string> = { waterlogged: "false" };
        for (const side of SIDES) {
          const [dx, dz] = OFF[side];
          patch[side] = String(connectsPane(m.get(x + dx, y, z + dz)));
        }
        next = withProps(st, patch);
        break;
      }
      case "wall": {
        const patch: Record<string, string> = { waterlogged: "false" };
        const conn: Record<string, boolean> = {};
        const above = m.get(x, y + 1, z);
        const aboveInfo = blockInfo(above.name);
        for (const side of SIDES) {
          const [dx, dz] = OFF[side];
          conn[side] = connectsWall(m.get(x + dx, y, z + dz), side);
          patch[side] = conn[side] ? (isSolid(above) || aboveInfo.shape === "wall" ? "tall" : "low") : "none";
        }
        const straightNS = conn.north && conn.south && !conn.east && !conn.west;
        const straightEW = conn.east && conn.west && !conn.north && !conn.south;
        const needsPost =
          aboveInfo.shape === "torch" || aboveInfo.shape === "lantern" || (aboveInfo.shape === "wall" && above.props.up === "true");
        patch.up = String(!(straightNS || straightEW) || needsPost);
        next = withProps(st, patch);
        break;
      }
      case "stairs":
        next = withProps(st, {
          shape: stairShape(m, x, y, z, st),
          half: st.props.half ?? "bottom",
          facing: st.props.facing ?? "north",
          waterlogged: "false",
        });
        break;
      default:
        break;
    }
    if (next) updates.push([x, y, z, next]);
  }
  for (const [x, y, z, s] of updates) {
    const before = m.getIndex(x, y, z);
    m.set(x, y, z, s);
    if (m.getIndex(x, y, z) !== before) changed++;
  }
  return changed;
}
