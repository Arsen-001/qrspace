import type { NextRequest } from "next/server";
import { accessOf, findCode, mutate, newId, notify, viewOf } from "@/server/db";
import { media } from "@/server/media";
import { currentPerson } from "@/server/session";
import { usable } from "@/server/users";
import type { CodePatch } from "@/lib/codes";
import { readContact, readPeople, readShort, readStyle, readTitle, readVisibility } from "../validate";

/** Код глазами текущего человека; ?visit=1 — это скан, пишем в историю (кроме хозяина). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/codes/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const code = await findCode(id);
  if (!code) return Response.json({ error: "not-found" }, { status: 404 });
  if (req.nextUrl.searchParams.has("visit") && code.owner !== me) {
    const allowed = accessOf(code, me) !== "closed";
    await mutate((db) => {
      const c = db.codes.find((x) => x.id === id);
      if (!c) return;
      c.visits.push({ personId: me, at: new Date().toISOString(), allowed });
      c.visits = c.visits.slice(-500);
    });
  }
  return Response.json(viewOf(code, me));
}

/** Настройки кода — только хозяин. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/codes/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const body = (await req.json().catch(() => ({}))) as CodePatch & Record<string, unknown>;
  const result = await mutate((db) => {
    const c = db.codes.find((x) => x.id === id);
    if (!c) return 404;
    if (c.owner !== me) return 403;
    if ("title" in body) {
      const t = readTitle(body.title);
      if (!t) return 400;
      c.title = t;
    }
    if ("visibility" in body) {
      const v = readVisibility(body.visibility);
      if (!v) return 400;
      c.visibility = v;
    }
    if ("people" in body) {
      const p = readPeople(body.people, c.owner, new Set(usable(db).map((u) => u.id)));
      if (!p) return 400;
      // Новым в списке — уведомление «вам открыли код».
      p.filter((g) => !c.people.some((x) => x.personId === g.personId)).forEach((g) => notify(db, g.personId, me, "granted", { who: c.owner, title: c.title }, `/c/${c.id}`));
      c.people = p;
      c.requests = c.requests.filter((r) => !p.some((g) => g.personId === r.personId));
    }
    if ("style" in body) {
      const st = readStyle(body.style);
      if (body.style !== null && !st) return 400;
      c.style = st;
    }
    if ("compact" in body) c.compact = body.compact === true;
    if ("showOwner" in body) c.showOwner = body.showOwner === true;
    if ("contact" in body) {
      const ct = readContact(body.contact);
      if (!ct) return 400;
      c.contact = ct;
    }
    if ("lost" in body) c.lost = body.lost === true;
    if ("reward" in body) c.reward = readShort(body.reward, 60);
    if (body.readMessages) c.messages.forEach((m) => (m.read = true));
    if (typeof body.removeMessage === "string") c.messages = c.messages.filter((m) => m.id !== body.removeMessage);
    if (typeof body.approve === "string") {
      const who = body.approve;
      if (c.requests.some((r) => r.personId === who) && !c.people.some((g) => g.personId === who)) {
        c.people.push({ personId: who, role: "view", until: null });
        notify(db, who, me, "granted", { who: c.owner, title: c.title }, `/c/${c.id}`);
        // Одобрили человека — значит код открыт выбранным людям (если был «только я»).
        if (c.visibility === "me") c.visibility = "people";
      }
      c.requests = c.requests.filter((r) => r.personId !== who);
    }
    if (typeof body.decline === "string") c.requests = c.requests.filter((r) => r.personId !== body.decline);
    if (body.newInvite) c.invite = newId(12);
    return viewOf(c, me);
  });
  if (typeof result === "number") return Response.json({ error: result }, { status: result });
  return Response.json(result);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/codes/[id]">) {
  const { id } = await ctx.params;
  const me = await currentPerson();
  const removed = await mutate((db) => {
    const i = db.codes.findIndex((x) => x.id === id && x.owner === me);
    return i < 0 ? null : db.codes.splice(i, 1)[0];
  });
  if (!removed) return Response.json({ error: "forbidden" }, { status: 403 });
  await Promise.all(removed.blocks.filter((b) => b.media).map((b) => media.remove(b.media!)));
  return Response.json({ ok: true });
}
