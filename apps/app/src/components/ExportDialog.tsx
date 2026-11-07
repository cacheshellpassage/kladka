import { useState } from "react";
import { exportModel, type ExportFormat, type VoxelModel } from "@kladka/voxel-core";
import { useT } from "../i18n";
import { safeFileName, saveFile } from "../platform/platform";
import { Link } from "../router";
import { useUi } from "../store/ui";
import { Modal } from "./Common";
import { Icon } from "./Icon";

export function ExportDialog({
  model,
  name,
  onClose,
}: {
  model: VoxelModel;
  name: string;
  onClose: () => void;
}) {
  const t = useT();
  const showToast = useUi((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const run = async (fmt: ExportFormat) => {
    setBusy(true);
    try {
      const out = exportModel(model, fmt);
      const suffix = fmt === "schem-v2" ? "-v2" : "";
      const file = `${safeFileName(name)}${suffix}.${out.extension}`;
      const saved = await saveFile(file, out.bytes, out.mime);
      showToast(t("export.done", { name: saved }));
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "cancelled") showToast(t("export.failed", { msg }));
    } finally {
      setBusy(false);
    }
  };
  const items: Array<[ExportFormat, string]> = [
    ["litematic", t("export.litematic")],
    ["schem", t("export.schem")],
    ["schem-v2", t("export.schem2")],
    ["nbt", t("export.nbt")],
  ];
  return (
    <Modal title={t("export.title")} onClose={onClose}>
      <div className="menu">
        {items.map(([fmt, label]) => (
          <button
            key={fmt}
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => run(fmt)}
            data-format={fmt}
          >
            <Icon name="download" /> {label}
          </button>
        ))}
      </div>
      <p className="small" style={{ marginTop: 14 }}>
        <Link to={{ name: "help" }} onClick={onClose}>
          {t("export.help")}
        </Link>
      </p>
    </Modal>
  );
}
