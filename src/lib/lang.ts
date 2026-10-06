"use client";
// Язык сайта живёт в localStorage; на сервере — русский, в браузере сразу сохранённый или язык системы.
import { useEffect, useSyncExternalStore } from "react";
import { DICTS, type Dict, type Lang } from "./i18n";

const LANG_KEY = "qr-studio.lang";

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch {}
  // Язык системы, если он у нас есть; иначе английский (рынок — весь мир).
  const nav = navigator.language.slice(0, 2) as Lang;
  return nav in DICTS ? nav : "en";
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
  listeners.forEach((cb) => cb());
}

/** Текущий язык и словарь; заголовок вкладки — `title`, если передан. */
export function useLang(title?: (t: Dict) => string): { lang: Lang; t: Dict } {
  const lang = useSyncExternalStore(subscribe, readLang, () => "ru" as Lang);
  const t = DICTS[lang];
  const docTitle = title?.(t);
  useEffect(() => {
    document.documentElement.lang = lang;
    if (docTitle) document.title = docTitle;
  }, [lang, docTitle]);
  return { lang, t };
}
