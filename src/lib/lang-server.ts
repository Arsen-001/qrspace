import { cookies, headers } from "next/headers";
import { DICTS, type Lang } from "./i18n";

export const LANG_COOKIE = "lang";

/**
 * Язык страницы на сервере — чтобы человек сразу видел свой язык (а не русский, который потом переключается),
 * и поисковик получал страницу на языке запроса: выбранный на сайте (cookie) → язык браузера → английский.
 */
export async function serverLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (saved && saved in DICTS) return saved as Lang;
  const accept = (await headers()).get("accept-language") ?? "";
  const ranked = accept
    .split(",")
    .map((part, i) => {
      const [tag, q] = part.trim().split(";q=");
      return { code: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1, i };
    })
    .filter((x) => x.code && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return (ranked.find((x) => x.code in DICTS)?.code as Lang | undefined) ?? "en";
}
