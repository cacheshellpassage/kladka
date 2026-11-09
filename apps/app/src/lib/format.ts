import { itemName, type MaterialLine } from "@kladka/voxel-core";
import type { TFunction } from "../i18n";
import type { Locale, Units } from "../store/settings";

export function formatMinutes(t: TFunction, minutes: number): string {
  if (minutes < 60) return t("build.minutes", { n: minutes });
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return m ? t("build.hours", { h, m }) : t("build.hoursOnly", { h });
}

export function formatCount(t: TFunction, line: MaterialLine, units: Units): string {
  if (units === "pieces" || line.count < line.stackSize || line.stackSize === 1) return `${line.count}`;
  if (units === "shulkers" && line.shulkers >= 0.5)
    return t("materials.shulker", { n: line.shulkers.toFixed(line.shulkers < 10 ? 1 : 0) });
  if (line.remainder === 0) return t("materials.stackOnly", { s: line.stacks });
  return t("materials.stack", { s: line.stacks, r: line.remainder });
}

/** "блок / блока / блоков" (ru) or "block / blocks" (en). */
export function blocksWord(locale: Locale, n: number): string {
  if (locale === "en") return n === 1 ? "block" : "blocks";
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "блок";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "блока";
  return "блоков";
}

export function nameOf(locale: Locale): (block: string) => string {
  return (b) => itemName(b, locale);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
