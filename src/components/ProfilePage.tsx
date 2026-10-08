"use client";
// Профиль: имя, чем вхожу (Google/Apple), мои покупки, выход, удаление аккаунта.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type CodeList } from "@/lib/codes";
import { fmtDateTime } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { refreshPeople, signIn, useMe } from "@/lib/me";
import type { Purchase } from "@/lib/pricing";
import { Avatar } from "./Avatar";
import { MyCodesGrid } from "./MyCodesGrid";
import { Notice, Shell } from "./Shell";

type Profile = { id: string; name: string; email: string; provider: "google" | "apple" | "demo"; designer: boolean; codes: number; purchases: Purchase[] };

/** Сразу при входе в профиль — мои коды (владелец: «зашёл — как будто ничего не поменялось»). */
function MyCodes({ t, me }: { t: Dict; me: string }) {
  const [list, setList] = useState<{ me: string; data: CodeList } | null>(null);
  useEffect(() => {
    let live = true;
    api.list().then((data) => live && setList({ me, data }), () => {});
    return () => {
      live = false;
    };
  }, [me]);
  const data = list?.me === me ? list.data : null;
  if (!data) return <Notice>{t.loading}</Notice>;
  if (!data.mine.length)
    return (
      <Link href="/#make" className="group relative block overflow-hidden rounded-2xl bg-stage p-8 text-on-stage sm:p-10">
        <div aria-hidden className="x-stage-glow" />
        <span className="relative block font-heading text-2xl font-extrabold sm:text-3xl">{t.firstCodeTitle}</span>
        <span className="relative mt-2 block max-w-md text-sm text-on-stage/70">{t.firstCodeText}</span>
        <span className="relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent">
          {t.firstCodeCta} <span className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>
    );
  return (
    <MyCodesGrid
      t={t}
      base={data.base}
      codes={data.mine}
      leading={
        <li>
          <Link
            href="/#make"
            className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm font-semibold text-muted transition-colors hover:border-accent-ink hover:text-ink"
          >
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-2xl text-on-accent">
              +
            </span>
            {t.newCode}
          </Link>
        </li>
      }
    />
  );
}

export function ProfilePage() {
  const { lang, t } = useLang((t) => `${t.profileTitle} — ${t.appName}`);
  const { ready, me } = useMe();
  const router = useRouter();
  const [p, setP] = useState<{ me: string; profile: Profile } | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!me) return;
    let live = true;
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json() as Promise<Profile>)
      .then((profile) => {
        if (!live) return;
        setP({ me, profile });
        setName(profile.name);
      }, () => {});
    return () => {
      live = false;
    };
  }, [me]);
  const profile = p?.me === me ? p.profile : null;

  const saveName = async () => {
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (r.ok) {
      await refreshPeople();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };
  const remove = async () => {
    setError(false);
    const r = await fetch("/api/profile", { method: "DELETE" });
    if (!r.ok) return setError(true);
    await signIn(null).catch(() => {});
    router.replace("/");
  };

  return (
    <Shell t={t} lang={lang}>
      {!ready ? null : !me ? (
        <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center">
          <Link href="/login?next=/profile" className="inline-grid min-h-11 place-items-center rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent">
            {t.login}
          </Link>
        </div>
      ) : !profile ? (
        <div className="mt-6">
          <Notice>{t.loading}</Notice>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-2xl bg-stage p-5 text-on-stage sm:p-7">
            <div aria-hidden className="x-stage-glow" />
            <div className="relative flex flex-wrap items-center gap-4">
              <Avatar id={profile.id} lang={lang} size={64} />
              <div className="min-w-0 flex-1 basis-40">
                <h1 className="truncate font-heading text-2xl font-extrabold sm:text-3xl">{profile.name}</h1>
                <div className="truncate text-sm text-on-stage/70">
                  {profile.provider === "demo" ? t.demoAccount : `${profile.provider === "google" ? "Google" : "Apple"} · ${profile.email}`}
                  {profile.designer && ` · ${t.designerRole}`}
                </div>
              </div>
              <Link href="/#make" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 font-heading text-sm font-bold text-on-accent sm:w-auto">
                + {t.newCode}
              </Link>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-heading text-2xl font-extrabold">{t.navCodes}</h2>
              <Link href="/codes" className="text-sm font-semibold text-accent-ink">
                {t.allCodes} →
              </Link>
            </div>
            <MyCodes t={t} me={me} />
          </section>

          <h2 className="border-t border-line pt-6 font-heading text-xl font-extrabold">{t.settingsTitle}</h2>
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">

          <section className="rounded-2xl border border-line bg-card p-5">
            <label htmlFor="pname" className="mb-1.5 block text-sm font-medium text-muted">
              {t.yourName}
            </label>
            <div className="flex gap-2">
              <input id="pname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-field px-3.5 text-base outline-none focus:border-accent" />
              <button type="button" disabled={!name.trim() || name.trim() === profile.name} onClick={saveName} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
                {saved ? t.saved : t.save}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">{t.yourNameHint}</p>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-heading text-lg font-bold">{t.myPurchases}</h2>
            {profile.purchases.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t.noPurchases}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {profile.purchases.map((x, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0 flex-1">
                      {x.tier === "simple" ? t.tierSimple : t.tierStyled}
                      {x.key.startsWith("code:") && !x.key.startsWith("code:order-") && (
                        <>
                          {" · "}
                          <Link href={`/codes/${x.key.slice(5)}`} className="text-accent-ink underline underline-offset-2">
                            {t.openCode}
                          </Link>
                        </>
                      )}
                    </span>
                    <span className="font-semibold">{x.free ? t.free : `$${x.price}`}</span>
                    <span className="text-xs text-muted">{fmtDateTime(x.at, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          </div>
          <section className="space-y-3 rounded-2xl border border-line bg-card p-5 lg:max-w-md">
            <button type="button" onClick={() => signIn(null).then(() => router.replace("/"))} className="min-h-11 w-full rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
              {t.logout}
            </button>
            {profile.provider !== "demo" &&
              (sure ? (
                <div className="rounded-xl bg-warn-soft p-4">
                  <p className="text-sm font-semibold text-warn">{t.deleteAccountSure}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={remove} className="min-h-11 flex-1 rounded-xl bg-warn px-4 text-sm font-semibold text-on-warn">
                      {t.deleteAccountYes}
                    </button>
                    <button type="button" onClick={() => setSure(false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:text-ink">
                      {t.cancel}
                    </button>
                  </div>
                  {error && <p className="mt-2 text-sm text-warn">{t.saveError}</p>}
                </div>
              ) : (
                <button type="button" onClick={() => setSure(true)} className="min-h-11 w-full rounded-xl px-4 text-sm font-medium text-muted hover:text-warn">
                  {t.deleteAccount}
                </button>
              ))}
          </section>
        </div>
      )}
    </Shell>
  );
}
