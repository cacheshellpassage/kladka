import appConfig from "../../app.config.json";
import licenses from "../licenses.json";
import { MC_VERSION } from "@kladka/voxel-core";
import { useT } from "../i18n";
import { Link } from "../router";
import { useSettings } from "../store/settings";

export function AboutPage() {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  return (
    <div className="stack prose">
      <div className="row">
        <img src="./icons/icon.svg" alt="" width={64} height={64} />
        <div>
          <h1 style={{ margin: 0 }}>{locale === "ru" ? appConfig.name : appConfig.nameLatin}</h1>
          <div className="muted">{appConfig.subtitle[locale]}</div>
        </div>
      </div>
      <p>{t("about.lead")}</p>
      <p>{t("about.offline")}</p>
      <p>{t("about.content")}</p>
      <p className="small muted">{t("about.version", { v: appConfig.version, mc: MC_VERSION })}</p>
      <div className="card panel stack">
        <strong>{t("about.disclaimer")}</strong>
        <span className="small muted">{t("about.disclaimerRu")}</span>
      </div>
      <div className="row">
        <Link className="btn" to={{ name: "help" }}>
          {t("nav.help")}
        </Link>
        <Link className="btn" to={{ name: "privacy" }}>
          {t("about.privacy")}
        </Link>
        <Link className="btn" to={{ name: "licenses" }}>
          {t("about.licenses")}
        </Link>
      </div>
    </div>
  );
}

export function HelpPage() {
  const t = useT();
  return (
    <div className="stack prose">
      <h1>{t("help.title")}</h1>
      <section className="card panel">
        <h2>{t("help.litematica.title")}</h2>
        <ol>
          <li>{t("help.litematica.1")}</li>
          <li>{t("help.litematica.2")}</li>
          <li>{t("help.litematica.3")}</li>
          <li>{t("help.litematica.4")}</li>
        </ol>
      </section>
      <section className="card panel">
        <h2>{t("help.worldedit.title")}</h2>
        <ol>
          <li>{t("help.worldedit.1")}</li>
          <li>{t("help.worldedit.2")}</li>
        </ol>
      </section>
      <section className="card panel">
        <h2>{t("help.structure.title")}</h2>
        <ol>
          <li>{t("help.structure.1")}</li>
          <li>{t("help.structure.2")}</li>
          <li>{t("help.structure.3")}</li>
        </ol>
      </section>
      <p className="small muted">{t("help.note")}</p>
    </div>
  );
}

export function PrivacyPage() {
  const t = useT();
  return (
    <div className="stack prose">
      <h1>{t("privacy.title")}</h1>
      <p>{t("privacy.body")}</p>
      <p data-testid="privacy-contact">{t("privacy.contact", { email: appConfig.contact })}</p>
      <p className="small muted">{t("about.disclaimer")}</p>
    </div>
  );
}

export function LicensesPage() {
  const t = useT();
  const list = licenses as Array<{ name: string; version: string; license: string }>;
  return (
    <div className="stack prose">
      <h1>{t("about.licenses")}</h1>
      <p className="small muted">{appConfig.license}</p>
      <table className="mats card">
        <tbody>
          {list.map((l) => (
            <tr key={l.name}>
              <td>{l.name}</td>
              <td className="muted">{l.version}</td>
              <td className="n">{l.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
