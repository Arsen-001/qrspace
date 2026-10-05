"use client";
// Кем вошёл человек (демо-вход) и адрес сайта для ссылок в кодах. Загружается один раз на страницу.
import { useSyncExternalStore } from "react";
import { api } from "./codes";
import { setDirectory } from "./people";

type MeState = { ready: boolean; me: string | null; base: string; demo: boolean; providers: { google: boolean; apple: boolean } };
const SERVER: MeState = { ready: false, me: null, base: "", demo: false, providers: { google: false, apple: false } };
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
      state = { ready: true, me: r.me, base: r.base, demo: r.demo, providers: r.providers };
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
  const r = await api.login(personId);
  state = { ...state, ready: true, me: r.me };
  emit();
}
