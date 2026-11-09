/**
 * Human-readable block state properties for the "tap a block" panel: property names and common values in
 * Russian/English, plus the exact `id[key=value,…]` string used by game commands and mods.
 */
import type { BlockState } from "@kladka/voxel-core";
import type { Locale } from "../store/settings";

const KEYS: Record<string, { ru: string; en: string }> = {
  facing: { ru: "Направление", en: "Facing" },
  half: { ru: "Половина", en: "Half" },
  type: { ru: "Тип", en: "Type" },
  shape: { ru: "Форма", en: "Shape" },
  axis: { ru: "Ось", en: "Axis" },
  waterlogged: { ru: "В воде", en: "Waterlogged" },
  open: { ru: "Открыто", en: "Open" },
  powered: { ru: "Запитано", en: "Powered" },
  lit: { ru: "Горит", en: "Lit" },
  hinge: { ru: "Петли", en: "Hinge" },
  part: { ru: "Часть", en: "Part" },
  face: { ru: "Крепление", en: "Attached to" },
  hanging: { ru: "Подвешен", en: "Hanging" },
  rotation: { ru: "Поворот (0–15)", en: "Rotation (0–15)" },
  attachment: { ru: "Крепление", en: "Attachment" },
  north: { ru: "Север", en: "North" },
  south: { ru: "Юг", en: "South" },
  east: { ru: "Восток", en: "East" },
  west: { ru: "Запад", en: "West" },
  up: { ru: "Вверх", en: "Up" },
  down: { ru: "Вниз", en: "Down" },
  age: { ru: "Возраст", en: "Age" },
  level: { ru: "Уровень", en: "Level" },
  snowy: { ru: "Под снегом", en: "Snowy" },
  occupied: { ru: "Занята", en: "Occupied" },
  persistent: { ru: "Не опадает", en: "Persistent" },
  distance: { ru: "Расстояние", en: "Distance" },
  layers: { ru: "Слоёв", en: "Layers" },
  candles: { ru: "Свечей", en: "Candles" },
  flower_amount: { ru: "Цветков", en: "Flowers" },
};

const VALUES: Record<string, { ru: string; en: string }> = {
  north: { ru: "север", en: "north" },
  south: { ru: "юг", en: "south" },
  east: { ru: "восток", en: "east" },
  west: { ru: "запад", en: "west" },
  up: { ru: "вверх", en: "up" },
  down: { ru: "вниз", en: "down" },
  top: { ru: "верх", en: "top" },
  bottom: { ru: "низ", en: "bottom" },
  upper: { ru: "верхняя", en: "upper" },
  lower: { ru: "нижняя", en: "lower" },
  double: { ru: "двойная", en: "double" },
  true: { ru: "да", en: "yes" },
  false: { ru: "нет", en: "no" },
  left: { ru: "слева", en: "left" },
  right: { ru: "справа", en: "right" },
  head: { ru: "изголовье", en: "head" },
  foot: { ru: "ноги", en: "foot" },
  floor: { ru: "пол", en: "floor" },
  wall: { ru: "стена", en: "wall" },
  ceiling: { ru: "потолок", en: "ceiling" },
  straight: { ru: "прямая", en: "straight" },
  inner_left: { ru: "внутренний угол слева", en: "inner corner, left" },
  inner_right: { ru: "внутренний угол справа", en: "inner corner, right" },
  outer_left: { ru: "внешний угол слева", en: "outer corner, left" },
  outer_right: { ru: "внешний угол справа", en: "outer corner, right" },
  none: { ru: "нет", en: "none" },
  low: { ru: "низкая", en: "low" },
  tall: { ru: "высокая", en: "tall" },
  side: { ru: "сбоку", en: "side" },
  x: { ru: "X (восток–запад)", en: "X (east–west)" },
  y: { ru: "Y (вертикально)", en: "Y (vertical)" },
  z: { ru: "Z (север–юг)", en: "Z (north–south)" },
};

export interface PropRow {
  key: string;
  label: string;
  value: string;
}

export function describeProps(s: BlockState, locale: Locale): PropRow[] {
  return Object.keys(s.props)
    .sort()
    .map((key) => {
      const raw = s.props[key]!;
      return {
        key,
        label: KEYS[key]?.[locale] ?? key,
        value: VALUES[raw]?.[locale] ?? raw,
      };
    });
}

/** `minecraft:oak_stairs[facing=east,half=bottom]` — the form used by /setblock and mods. */
export function blockStateString(s: BlockState): string {
  const keys = Object.keys(s.props).sort();
  return keys.length ? `${s.name}[${keys.map((k) => `${k}=${s.props[k]}`).join(",")}]` : s.name;
}
