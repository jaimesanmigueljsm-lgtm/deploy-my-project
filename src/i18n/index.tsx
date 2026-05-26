import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LOCALES, TRANSLATIONS, type LocaleCode } from "./translations";

export type TParams = Record<string, string | number>;

type Ctx = {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  t: (key: string, params?: TParams) => string;
  locales: typeof LOCALES;
};

const I18nCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "nest.locale";

function detectInitial(): LocaleCode {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
  if (stored && TRANSLATIONS[stored]) return stored;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase() as LocaleCode;
  if (nav && TRANSLATIONS[nav]) return nav;
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage on the FIRST render — no post-mount flash
  const [locale, setLocaleState] = useState<LocaleCode>(() => detectInitial());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale: (l) => {
        setLocaleState(l);
        try {
          window.localStorage.setItem(STORAGE_KEY, l);
          // eslint-disable-next-line no-empty
        } catch {}
        if (typeof document !== "undefined") document.documentElement.lang = l;
      },
      t: (key, params) => {
        const tpl = TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
        if (!params) return tpl;
        return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
      },
      locales: LOCALES,
    }),
    [locale],
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    // Safe fallback so components don't crash if used outside provider
    return {
      locale: "en" as LocaleCode,
      setLocale: () => {},
      t: (k: string, params?: TParams) => {
        const tpl = TRANSLATIONS.en[k] ?? k;
        if (!params) return tpl;
        return tpl.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`));
      },
      locales: LOCALES,
    };
  }
  return ctx;
}

export { LOCALES };
export type { LocaleCode };
