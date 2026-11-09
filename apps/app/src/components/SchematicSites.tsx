/**
 * Where to find builds: links to well-known community sites with downloadable schematics. The app does
 * not load anything from them; a link opens in the system browser, the user downloads a file there and
 * imports it here (or opens it with the app).
 */
import { useT, type MessageKey } from "../i18n";
import { openExternal } from "../platform/platform";
import { Icon } from "./Icon";

const SITES: Array<{ name: string; url: string; formats: string; about: MessageKey }> = [
  {
    name: "Planet Minecraft",
    url: "https://www.planetminecraft.com/projects/tag/schematic/",
    formats: ".schem · .litematic · .nbt",
    about: "sites.planetminecraft",
  },
  {
    name: "Abfielder",
    url: "https://abfielder.com/",
    formats: ".litematic",
    about: "sites.abfielder",
  },
  {
    name: "Minecraft Maps",
    url: "https://www.minecraftmaps.com/schematics",
    formats: ".litematic · .schem · .nbt",
    about: "sites.minecraftmaps",
  },
  {
    name: "Minecraft-Schematics",
    url: "https://www.minecraft-schematics.com/",
    formats: ".schem · .schematic",
    about: "sites.minecraftschematics",
  },
];

export function SchematicSites() {
  const t = useT();
  return (
    <section className="sites" aria-labelledby="sites-title">
      <h2 id="sites-title">{t("sites.title")}</h2>
      <p className="small muted">{t("sites.lead")}</p>
      <ul className="sites-list">
        {SITES.map((s) => (
          <li key={s.url}>
            <a
              className="site card"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                void openExternal(s.url);
              }}
            >
              <span className="site-head">
                <strong>{s.name}</strong>
                <Icon name="next" size={16} />
              </span>
              <span className="small">{t(s.about)}</span>
              <span className="small muted site-formats">{s.formats}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="small muted">{t("sites.note")}</p>
    </section>
  );
}
