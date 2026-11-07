import { itemName, type MaterialLine } from "@kladka/voxel-core";
import type { TFunction } from "../i18n";
import type { Locale, Units } from "../store/settings";

export function formatMinutes(t: TFunction, minutes: number): string {
  if (minutes < 60) return t("build.minutes", { n: minutes });
  return t("build.hours", { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export function formatCount(t: TFunction, line: MaterialLine, units: Units): string {
  if (units === "pieces" || line.count < line.stackSize) return `${line.count}`;
  if (units === "shulkers" && line.shulkers >= 0.5)
    return t("materials.shulker", { n: line.shulkers.toFixed(line.shulkers < 10 ? 1 : 0) });
  return t("materials.stack", { s: line.stacks, r: line.remainder });
}

export function nameOf(locale: Locale): (block: string) => string {
  return (b) => itemName(b, locale);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
