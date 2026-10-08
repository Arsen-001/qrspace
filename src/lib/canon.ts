/** JSON без учёта порядка ключей: Postgres (jsonb) хранит ключи в своём порядке — сравниваем по смыслу. */
export function canon(v: unknown): string {
  const sort = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(sort) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])])) : x;
  return JSON.stringify(sort(v ?? null));
}
