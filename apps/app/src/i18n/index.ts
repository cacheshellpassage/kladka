import { useCallback } from "react";
import { useSettings, type Locale } from "../store/settings";
import { en } from "./en";
import { ru, type MessageKey } from "./ru";

const DICTS: Record<Locale, Record<MessageKey, string>> = { ru, en };

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  let s = DICTS[locale][key] ?? ru[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

export function useT(): TFunction {
  const locale = useSettings((s) => s.locale);
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );
}

export function useLocale(): Locale {
  return useSettings((s) => s.locale);
}

export type { MessageKey };
