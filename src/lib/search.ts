/** Case- and accent-insensitive text matching. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matches(haystack: string, query: string): boolean {
  const q = normalize(query.trim());
  return !q || normalize(haystack).includes(q);
}
