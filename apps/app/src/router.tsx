/** Tiny hash router: works under file://, Tauri and Capacitor without server rewrites. */
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

export type Route =
  | { name: "catalog" }
  | { name: "build"; id: string }
  | { name: "guide"; id: string }
  | { name: "view"; id: string }
  | { name: "import" }
  | { name: "settings" }
  | { name: "about" }
  | { name: "help" }
  | { name: "privacy" }
  | { name: "licenses" };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/+/, "");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case undefined:
    case "":
      return { name: "catalog" };
    case "b":
      if (!parts[1]) return { name: "catalog" };
      if (parts[2] === "guide") return { name: "guide", id: parts[1] };
      if (parts[2] === "view") return { name: "view", id: parts[1] };
      return { name: "build", id: parts[1] };
    case "import":
      return { name: "import" };
    case "settings":
      return { name: "settings" };
    case "about":
      return { name: "about" };
    case "help":
      return { name: "help" };
    case "privacy":
      return { name: "privacy" };
    case "licenses":
      return { name: "licenses" };
    default:
      return { name: "catalog" };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case "catalog":
      return "#/";
    case "build":
      return `#/b/${encodeURIComponent(r.id)}`;
    case "guide":
      return `#/b/${encodeURIComponent(r.id)}/guide`;
    case "view":
      return `#/b/${encodeURIComponent(r.id)}/view`;
    default:
      return `#/${r.name}`;
  }
}

export function navigate(r: Route | string, replace = false): void {
  const h = typeof r === "string" ? r : href(r);
  if (replace) history.replaceState(null, "", h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function goBack(fallback: Route = { name: "catalog" }): void {
  if (history.length > 1) history.back();
  else navigate(fallback, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function Link({ to, onClick, ...rest }: { to: Route } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href(to)}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
