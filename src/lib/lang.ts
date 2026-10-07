"use client";
// Язык сайта: выбранный на сайте (localStorage + cookie «lang», чтобы сервер сразу отдал страницу на нём), иначе —
// тот, что сервер взял из языка браузера (src/lib/lang-server.ts) и передал через LangProvider.
import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DICTS, type Dict, type Lang } from "./i18n";

const LANG_KEY = "qr-studio.lang";

function savedLang(): Lang | null {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch {}
  return null;
}

function writeCookie(l: Lang) {
  document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
}

const InitialLang = createContext<Lang>("en");
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return createElement(InitialLang.Provider, { value: lang }, children);
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function saveLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {}
  writeCookie(l);
  listeners.forEach((cb) => cb());
}

/** Текущий язык и словарь; заголовок вкладки — `title`, если передан. */
export function useLang(title?: (t: Dict) => string): { lang: Lang; t: Dict } {
  const initial = useContext(InitialLang);
  const lang = useSyncExternalStore(subscribe, () => savedLang() ?? initial, () => initial);
  const t = DICTS[lang];
  const docTitle = title?.(t);
  useEffect(() => {
    document.documentElement.lang = lang;
    // Выбрали язык до cookie (или cookie стёрли) — пусть и сервер знает.
    if (lang !== initial && savedLang() === lang) writeCookie(lang);
    if (docTitle) document.title = docTitle;
  }, [lang, initial, docTitle]);
  return { lang, t };
}
