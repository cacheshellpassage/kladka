import { useEffect } from "react";
import { useRoute } from "./router";
import { useLibrary } from "./store/library";
import { effectiveTheme, useSettings } from "./store/settings";
import { Shell } from "./components/Shell";
import { Onboarding } from "./components/Onboarding";
import { CatalogPage } from "./pages/CatalogPage";
import { BuildPage } from "./pages/BuildPage";
import { GuidePage } from "./pages/GuidePage";
import { ViewPage } from "./pages/ViewPage";
import { ImportPage } from "./pages/ImportPage";
import { SettingsPage, restoreResourcePack } from "./pages/SettingsPage";
import { AboutPage, HelpPage, LicensesPage, PrivacyPage } from "./pages/InfoPages";

function routeKey(r: ReturnType<typeof useRoute>): string {
  return "id" in r ? r.name + ":" + r.id : r.name;
}

export function App() {
  const route = useRoute();
  const load = useLibrary((s) => s.load);
  const theme = useSettings((s) => s.theme);
  const locale = useSettings((s) => s.locale);
  const textScale = useSettings((s) => s.textScale);

  useEffect(() => {
    void load();
    void restoreResourcePack();
  }, [load]);

  useEffect(() => {
    const apply = () => (document.documentElement.dataset.theme = effectiveTheme(theme));
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.style.setProperty("--text-scale", String(textScale));
  }, [locale, textScale]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const wide = route.name === "guide" || route.name === "view";
  let page;
  switch (route.name) {
    case "build":
      page = <BuildPage id={route.id} />;
      break;
    case "guide":
      page = <GuidePage key={route.id} id={route.id} />;
      break;
    case "view":
      page = <ViewPage key={route.id} id={route.id} />;
      break;
    case "import":
      page = <ImportPage />;
      break;
    case "settings":
      page = <SettingsPage />;
      break;
    case "about":
      page = <AboutPage />;
      break;
    case "help":
      page = <HelpPage />;
      break;
    case "privacy":
      page = <PrivacyPage />;
      break;
    case "licenses":
      page = <LicensesPage />;
      break;
    default:
      page = <CatalogPage />;
  }
  return (
    <Shell route={route} wide={wide}>
      <div key={routeKey(route)} className="page-anim" style={wide ? { height: "100%" } : undefined}>
        {page}
      </div>
      <Onboarding />
    </Shell>
  );
}
