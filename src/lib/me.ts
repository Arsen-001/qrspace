"use client";
// Кем вошёл человек (демо-вход) и адрес сайта для ссылок в кодах. Загружается один раз на страницу.
import { useSyncExternalStore } from "react";
import { api } from "./codes";
import { setDirectory } from "./people";

type MeState = { ready: boolean; me: string | null; base: string; demo: boolean; providers: { google: boolean; apple: boolean }; admin: boolean; colors: { fg: string; bg: string }[] };
const SERVER: MeState = { ready: false, me: null, base: "", demo: false, providers: { google: false, apple: false }, admin: false, colors: [] };
let state: MeState = SERVER;
let loading = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((cb) => cb());

function load() {
  if (loading || state.ready) return;
  loading = true;
  api
    .me()
    .then((r) => {
      setDirectory(r.people);
      state = { ready: true, me: r.me, base: r.base, demo: r.demo, providers: r.providers, admin: r.admin, colors: r.colors ?? [] };
    })
    .catch(() => (state = { ...SERVER, ready: true, base: location.origin }))
    .finally(() => {
      loading = false;
      emit();
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  load();
  return () => listeners.delete(cb);
}

export function useMe(): MeState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export async function signIn(personId: string | null) {
  await api.login(personId);
  // Перечитываем всё: у нового человека свои имена вокруг и своя роль (администратор).
  const r = await api.me();
  setDirectory(r.people);
  state = { ready: true, me: r.me, base: r.base, demo: r.demo, providers: r.providers, admin: r.admin, colors: r.colors ?? [] };
  emit();
}

/** Обновить имена людей (появился новый контакт, человек в списке кода, просьба о доступе). */
export async function refreshPeople() {
  try {
    const r = await api.me();
    setDirectory(r.people);
    state = { ...state };
    emit();
  } catch {}
}

/** Запомнить цвета скачанного кода — первыми в «Тонкой настройке» и по умолчанию в генераторе. */
export async function rememberColors(fg: string, bg: string) {
  if (!state.me) return;
  const r = await fetch("/api/me/colors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fg, bg }) }).catch(() => null);
  const j = r?.ok ? ((await r.json()) as { colors: { fg: string; bg: string }[] }) : null;
  if (j) {
    state = { ...state, colors: j.colors };
    emit();
  }
}
