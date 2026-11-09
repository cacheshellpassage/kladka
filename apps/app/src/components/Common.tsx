import { useEffect, useRef, useState, type ReactNode } from "react";
import { blockInfo, itemName, type MaterialLine, type VoxelModel } from "@kladka/voxel-core";
import { useT } from "../i18n";
import { formatCount } from "../lib/format";
import { getOne, put } from "../db/db";
import { safeFileName, saveFile } from "../platform/platform";
import { useSettings, type Units } from "../store/settings";
import { useUi } from "../store/ui";
import { Icon } from "./Icon";
import { BlockIcon } from "./Visual";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, a, input, select")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <span className="spacer" />
          <button className="btn icon ghost" type="button" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const msg = useUi((s) => s.toast);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function DifficultyDots({ value }: { value: number }) {
  const t = useT();
  return (
    <span className="dots" title={t(`difficulty.${Math.min(5, Math.max(1, value))}` as "difficulty.1")}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= value ? "on" : ""} />
      ))}
    </span>
  );
}

export function MaterialsTable({
  lines,
  model,
  selected,
  onSelect,
  checklistId,
  title,
}: {
  lines: MaterialLine[];
  model: VoxelModel;
  selected?: number | null;
  onSelect?: (palette: number | null) => void;
  /** When set, rows get checkboxes saved per build (gathering checklist). */
  checklistId?: string;
  /** Build title used for exported checklists. */
  title?: string;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!checklistId) return;
    let alive = true;
    void getOne("checklists", checklistId).then((r) => alive && setChecked(new Set(r?.checked ?? [])));
    return () => {
      alive = false;
    };
  }, [checklistId]);
  const toggle = (item: string) => {
    if (!checklistId) return;
    const next = new Set(checked);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setChecked(next);
    void put("checklists", { id: checklistId, checked: [...next], updatedAt: Date.now() });
  };
  const collected = lines.filter((l) => checked.has(l.item)).length;
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const units = useSettings((s) => s.units);
  const setSettings = useSettings((s) => s.set);
  const showToast = useUi((s) => s.showToast);
  // map item → a palette index that produces it (for highlighting)
  const paletteOf = new Map<string, number>();
  model.palette.forEach((p, i) => {
    if (i === 0) return;
    const short = p.name.replace("minecraft:", "");
    const key = short.endsWith("_wall_torch") || short === "wall_torch" ? short.replace("wall_", "") : short;
    if (!paletteOf.has(key)) paletteOf.set(key, i);
    if (!paletteOf.has(p.material)) paletteOf.set(p.material, i);
  });
  const total = lines.reduce((n, l) => n + l.count, 0);
  const listText = () =>
    (title ? title + "\n\n" : "") +
    lines
      .map(
        (l) =>
          (checklistId ? (checked.has(l.item) ? "☑ " : "☐ ") : "") +
          itemName(l.item, locale) +
          " — " +
          l.count +
          (units !== "pieces" && l.count >= l.stackSize && l.stackSize > 1
            ? " (" + formatCount(t, l, units) + ")"
            : ""),
      )
      .join("\n");
  const share = async () => {
    const text = listText();
    try {
      if (navigator.share) {
        await navigator.share({ title: title ?? t("build.materials"), text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await saveFile(
        safeFileName(title ?? "materials") + "-checklist.txt",
        new TextEncoder().encode(text),
        "text/plain",
      );
    } catch {
      await copy();
    }
  };
  const reset = () => {
    if (!checklistId) return;
    setChecked(new Set());
    void put("checklists", { id: checklistId, checked: [], updatedAt: Date.now() });
  };
  const copy = async () => {
    const text = listText();
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("materials.copied"));
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="stack">
      <div className="row">
        <Segmented<Units>
          label={t("materials.unit")}
          value={units}
          onChange={(u) => setSettings({ units: u })}
          options={[
            { value: "pieces", label: t("materials.pieces") },
            { value: "stacks", label: t("materials.stacks") },
            { value: "shulkers", label: t("materials.shulkers") },
          ]}
        />
        <span className="spacer" />
        <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
          <button
            className="btn icon ghost"
            type="button"
            onClick={copy}
            title={t("materials.copy")}
            aria-label={t("materials.copy")}
          >
            <Icon name="copy" />
          </button>
          {checklistId ? (
            <button
              className="btn icon ghost"
              type="button"
              onClick={share}
              title={t("materials.share")}
              aria-label={t("materials.share")}
            >
              <Icon name="download" />
            </button>
          ) : null}
        </span>
      </div>
      {checklistId ? (
        <div className="checklist-head">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small">
              <b>{t("materials.collected", { n: collected, total: lines.length })}</b>
            </span>
            {collected ? (
              <button className="btn ghost" type="button" onClick={reset} style={{ minHeight: 32 }}>
                {t("materials.reset")}
              </button>
            ) : null}
          </div>
          <div className="progressbar">
            <div style={{ width: (lines.length ? Math.round((collected / lines.length) * 100) : 0) + "%" }} />
          </div>
        </div>
      ) : null}
      <table className="mats">
        <tbody>
          {lines.map((l) => {
            const pal = paletteOf.get(l.item);
            const color = pal ? blockInfo(model.palette[pal]!.name).color : 0x999999;
            const sel = pal !== undefined && pal === selected;
            return (
              <tr
                key={l.item}
                className={(sel ? "sel " : "") + (checklistId && checked.has(l.item) ? "got" : "")}
              >
                {checklistId ? (
                  <td style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      className="check"
                      checked={checked.has(l.item)}
                      onChange={() => toggle(l.item)}
                      aria-label={itemName(l.item, locale)}
                    />
                  </td>
                ) : null}
                <td style={{ width: 26 }}>
                  <BlockIcon block={pal ? model.palette[pal]!.name : l.item} color={color} />
                </td>
                <td>
                  {onSelect && pal !== undefined ? (
                    <button
                      className="rowbtn"
                      type="button"
                      onClick={() => onSelect(sel ? null : pal)}
                      title={t("materials.highlight")}
                    >
                      {itemName(l.item, locale)}
                    </button>
                  ) : (
                    itemName(l.item, locale)
                  )}
                </td>
                <td className="n">{formatCount(t, l, units)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="small muted">{t("materials.total", { n: total })}</div>
    </div>
  );
}

export function Disclaimer() {
  const t = useT();
  return <p className="disclaimer">{t("about.disclaimer")}</p>;
}
