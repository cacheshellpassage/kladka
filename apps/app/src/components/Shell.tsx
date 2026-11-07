import type { ReactNode } from "react";
import appConfig from "../../app.config.json";
import { useT } from "../i18n";
import { Link, type Route } from "../router";
import { useSettings } from "../store/settings";
import { Toast } from "./Common";
import { Icon } from "./Icon";

export function Shell({ route, wide, children }: { route: Route; wide?: boolean; children: ReactNode }) {
  const t = useT();
  const locale = useSettings((s) => s.locale);
  const hand = useSettings((s) => s.hand);
  const name = locale === "ru" ? appConfig.name : appConfig.nameLatin;
  const nav: Array<{ to: Route; label: string; icon: string; match: Route["name"][] }> = [
    {
      to: { name: "catalog" },
      label: t("nav.catalog"),
      icon: "grid",
      match: ["catalog", "build", "guide", "view"],
    },
    { to: { name: "import" }, label: t("nav.import"), icon: "import", match: ["import"] },
    { to: { name: "settings" }, label: t("nav.settings"), icon: "settings", match: ["settings"] },
    {
      to: { name: "about" },
      label: t("nav.about"),
      icon: "info",
      match: ["about", "help", "privacy", "licenses"],
    },
  ];
  return (
    <div className={`app ${hand === "left" ? "left-handed" : ""}`}>
      <a className="sr-only" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" to={{ name: "catalog" }}>
          <img src="./icons/icon.svg" alt="" width={32} height={32} />
          <span>
            {name}
            <small>{t("app.subtitle")}</small>
          </span>
        </Link>
        <nav className="topnav" aria-label="main">
          {nav.map((n) => (
            <Link key={n.label} to={n.to} aria-current={n.match.includes(route.name) ? "page" : undefined}>
              <Icon name={n.icon} size={18} />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className={`page ${wide ? "wide" : ""}`}>
        {children}
      </main>
      <nav className="bottomnav" aria-label="main">
        {nav.map((n) => (
          <Link key={n.label} to={n.to} aria-current={n.match.includes(route.name) ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </Link>
        ))}
      </nav>
      <Toast />
    </div>
  );
}
