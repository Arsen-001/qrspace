"use client";
// Профиль: имя, чем вхожу (Google/Apple), мои покупки, выход, удаление аккаунта.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/lang";
import { refreshPeople, signIn, useMe } from "@/lib/me";
import type { Purchase } from "@/lib/pricing";
import { Avatar } from "./Avatar";
import { Notice, Shell } from "./Shell";

type Profile = { id: string; name: string; email: string; provider: "google" | "apple" | "demo"; designer: boolean; codes: number; purchases: Purchase[] };

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
    <Shell t={t} lang={lang} narrow>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t.profileTitle}</h1>
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
        <div className="mt-6 space-y-5">
          <section className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
            <Avatar id={profile.id} lang={lang} size={56} />
            <div className="min-w-0">
              <div className="truncate font-heading text-xl font-bold">{profile.name}</div>
              <div className="truncate text-sm text-muted">
                {profile.provider === "demo" ? t.demoAccount : `${profile.provider === "google" ? "Google" : "Apple"} · ${profile.email}`}
                {profile.designer && ` · ${t.designerRole}`}
              </div>
            </div>
          </section>

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
                          <Link href={`/codes/${x.key.slice(5)}`} className="text-accent underline underline-offset-2">
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

          <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
            <button type="button" onClick={() => signIn(null).then(() => router.replace("/"))} className="min-h-11 w-full rounded-xl border border-line bg-field px-4 text-sm font-semibold hover:border-muted">
              {t.logout}
            </button>
            {profile.provider !== "demo" &&
              (sure ? (
                <div className="rounded-xl bg-warn-soft p-4">
                  <p className="text-sm font-semibold text-warn">{t.deleteAccountSure}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={remove} className="min-h-11 flex-1 rounded-xl bg-warn px-4 text-sm font-semibold text-white">
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
