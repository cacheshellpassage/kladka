/** Build passport: block types, size class, saved-in / works-in game versions and required mods. */
import { useMemo } from "react";
import { buildPassport, type VoxelModel } from "@kladka/voxel-core";
import { useT, type MessageKey } from "../i18n";
import { nameOf } from "../lib/format";
import { useSettings } from "../store/settings";

export function Passport({ model }: { model: VoxelModel }) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const p = useMemo(() => buildPassport(model), [model]);
  const name = nameOf(locale);
  return (
    <div className="passport" data-testid="passport">
      <span className="small muted">{t("passport.title")}</span>
      <dl>
        <div>
          <dt>{t("passport.types")}</dt>
          <dd>{p.blockTypes}</dd>
        </div>
        <div>
          <dt>{t("passport.size")}</dt>
          <dd>
            <span className="size-badge">{p.sizeClass}</span>{" "}
            {t(`passport.size.${p.sizeClass}` as MessageKey)}
          </dd>
        </div>
        {p.savedDataVersion ? (
          <div>
            <dt>{t("passport.savedIn")}</dt>
            <dd>Java {p.savedIn}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t("passport.worksIn")}</dt>
          <dd>
            {t("passport.worksIn.value", { v: p.minVersion })}
            {p.newestBlocks.length ? (
              <span className="small muted passport-why">
                {t("passport.because", { blocks: p.newestBlocks.map(name).join(", ") })}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t("passport.mods")}</dt>
          <dd>
            {p.mods.length ? (
              <>
                {p.mods.map((m) => `${m.namespace} (${m.blocks})`).join(", ")}
                <span className="small muted passport-why">{t("passport.mods.note")}</span>
              </>
            ) : (
              t("passport.mods.none")
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
