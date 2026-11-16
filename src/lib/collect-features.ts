/** Shared by the client and server feature registries. */

const FEATURE_ID = /^[a-z][a-z0-9-]*$/;

/** Turn glob results into a validated, id-sorted feature list. Throws on a
 * malformed feature so mistakes surface at startup, not as a missing page. */
export function collectFeatures<T extends { id: string }>(modules: Record<string, { default?: T }>, kind: string): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const [file, mod] of Object.entries(modules)) {
    const folder = file.match(/features\/([^/]+)\//)?.[1];
    const f = mod.default;
    if (!f) throw new Error(`${file} must default-export a ${kind}`);
    if (!FEATURE_ID.test(f.id)) throw new Error(`Feature id "${f.id}" in ${file} must be lowercase-kebab-case`);
    if (folder && folder !== f.id) throw new Error(`Feature id "${f.id}" must match its folder "${folder}"`);
    if (seen.has(f.id)) throw new Error(`Duplicate feature id "${f.id}"`);
    seen.add(f.id);
    out.push(f);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
