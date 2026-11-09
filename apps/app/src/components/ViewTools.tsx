/**
 * Overlays of the free 3D view: block details on tap, the two-corner measuring tool and the on-screen
 * pad of the first-person fly camera.
 */
import { useMemo, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { countItems, toLines, type VoxelModel } from "@kladka/voxel-core";
import { useT } from "../i18n";
import { blockStateString, describeProps } from "../lib/blockprops";
import { blocksWord, formatCount, nameOf } from "../lib/format";
import { useSettings } from "../store/settings";
import { useUi } from "../store/ui";
import { Icon } from "./Icon";
import { BlockIcon } from "./Visual";

export type Vec3i = [number, number, number];

export function BlockInfoPanel({
  model,
  at,
  palette,
  onClose,
}: {
  model: VoxelModel;
  at: Vec3i;
  palette: number;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const showToast = useUi((s) => s.showToast);
  const st = model.palette[palette];
  if (!st) return null;
  const rows = describeProps(st, locale);
  const id = blockStateString(st);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      showToast(t("materials.copied"));
    } catch {
      /* selectable text */
    }
  };
  return (
    <div className="view-panel block-panel" role="dialog" aria-label={nameOf(locale)(st.name)}>
      <div className="vp-head">
        <BlockIcon block={st.name} size={32} />
        <span className="stack" style={{ gap: 0 }}>
          <strong>{nameOf(locale)(st.name)}</strong>
          <span className="small muted">{t("viewer.block.coords", { x: at[0], y: at[1], z: at[2] })}</span>
        </span>
        <button className="btn icon ghost" type="button" onClick={onClose} aria-label={t("common.close")}>
          <Icon name="close" />
        </button>
      </div>
      {rows.length ? (
        <dl className="vp-props">
          {rows.map((r) => (
            <div key={r.key}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="small muted">{t("viewer.block.noProps")}</p>
      )}
      <div className="vp-id">
        <span className="small muted">{t("viewer.block.id")}</span>
        <code>{id}</code>
        <button className="btn icon ghost" type="button" onClick={copy} aria-label={t("materials.copy")}>
          <Icon name="copy" />
        </button>
      </div>
    </div>
  );
}

export function MeasurePanel({
  model,
  a,
  b,
  onReset,
}: {
  model: VoxelModel;
  a: Vec3i | null;
  b: Vec3i | null;
  onReset: () => void;
}) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const units = useSettings((s) => s.units);
  const result = useMemo(() => {
    if (!a || !b) return null;
    const lo = a.map((v, i) => Math.min(v, b[i]!)) as Vec3i;
    const hi = a.map((v, i) => Math.max(v, b[i]!)) as Vec3i;
    const inside: number[] = [];
    for (let y = lo[1]; y <= hi[1]; y++)
      for (let z = lo[2]; z <= hi[2]; z++)
        for (let x = lo[0]; x <= hi[0]; x++) {
          const i = model.index(x, y, z);
          if (model.blocks[i]) inside.push(i);
        }
    const w = hi[0] - lo[0] + 1,
      h = hi[1] - lo[1] + 1,
      d = hi[2] - lo[2] + 1;
    return { w, h, d, cells: w * h * d, n: inside.length, lines: toLines(model, countItems(model, inside)) };
  }, [model, a, b]);

  return (
    <div className="view-panel measure-panel" aria-live="polite">
      <div className="vp-head">
        <Icon name="ruler" />
        <strong>{t("viewer.tool.measure")}</strong>
        {a ? (
          <button className="btn ghost" type="button" onClick={onReset} style={{ minHeight: 32 }}>
            {t("viewer.measure.reset")}
          </button>
        ) : null}
      </div>
      {!result ? (
        <p className="small">{a ? t("viewer.measure.second") : t("viewer.measure.first")}</p>
      ) : (
        <>
          <p className="measure-size">
            {t("viewer.measure.size", { w: result.w, h: result.h, d: result.d })}
          </p>
          <p className="small muted">
            {t("viewer.measure.blocks", {
              n: result.n,
              blocks: blocksWord(locale, result.n),
              cells: result.cells,
            })}
          </p>
          <ul className="measure-mats">
            {result.lines.slice(0, 8).map((l) => (
              <li key={l.item}>
                <BlockIcon block={l.item} size={20} />
                <span>{nameOf(locale)(l.item)}</span>
                <b>{formatCount(t, l, units)}</b>
              </li>
            ))}
            {result.lines.length > 8 ? <li className="small muted">+{result.lines.length - 8}</li> : null}
          </ul>
        </>
      )}
    </div>
  );
}

/** Hold-to-move buttons for touch screens; desktop users also get WASD. */
export function FlyPad({ onInput }: { onInput: (f: number, s: number, u: number) => void }) {
  const t = useT();
  const hold = (f: number, s: number, u: number) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onInput(f, s, u);
    },
    onPointerUp: () => onInput(0, 0, 0),
    onPointerCancel: () => onInput(0, 0, 0),
    onLostPointerCapture: () => onInput(0, 0, 0),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  return (
    <div className="fly-pad" aria-label={t("viewer.camera.fly")}>
      <div className="fly-dpad">
        <button
          type="button"
          className="btn icon dir-f"
          aria-label={t("viewer.fly.forward")}
          {...hold(1, 0, 0)}
        >
          <Icon name="next" size={20} />
        </button>
        <button
          type="button"
          className="btn icon dir-l"
          aria-label={t("viewer.fly.left")}
          {...hold(0, -1, 0)}
        >
          <Icon name="back" size={20} />
        </button>
        <button
          type="button"
          className="btn icon dir-r"
          aria-label={t("viewer.fly.right")}
          {...hold(0, 1, 0)}
        >
          <Icon name="next" size={20} />
        </button>
        <button
          type="button"
          className="btn icon dir-b"
          aria-label={t("viewer.fly.back")}
          {...hold(-1, 0, 0)}
        >
          <Icon name="back" size={20} />
        </button>
      </div>
      <div className="fly-ud">
        <button type="button" className="btn icon" aria-label={t("viewer.fly.up")} {...hold(0, 0, 1)}>
          <Icon name="plus" size={20} />
        </button>
        <button type="button" className="btn icon" aria-label={t("viewer.fly.down")} {...hold(0, 0, -1)}>
          <Icon name="minus" size={20} />
        </button>
      </div>
    </div>
  );
}
