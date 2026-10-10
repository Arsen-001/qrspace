import type { Db } from "@/server/db";
import type { Lot } from "@/lib/codes";
import type { Listing } from "@/lib/listings";

/** Лот + то, что видно о коде всем (без памяти владельца). Не коллекционный код — без названия: в маркете его
 * показывают ссылкой (как домен), название может выдать данные продавца. */
export function lotOf(db: Db, l: Listing): Lot | null {
  const c = db.codes.find((x) => x.id === l.code);
  if (!c) return null;
  return { ...l, view: { title: c.edition ? c.title : null, short: c.short ?? "", style: c.style, edition: c.edition ?? null, owners: c.owners ?? [] } };
}
