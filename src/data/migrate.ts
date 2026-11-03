import {
  DEFAULT_SETTINGS,
  DataSchema,
  GroupSchema,
  SCHEMA_VERSION,
  SettingsSchema,
  emptyData,
  type DayportData,
  type Settings,
} from "./schema";

export type LoadResult = { ok: true; data: DayportData; fresh: boolean } | { ok: false };

/**
 * Reads whatever is in storage. Missing data yields an empty document.
 * Unreadable data yields `ok: false` so the caller can refuse to overwrite it.
 */
export function migrate(raw: unknown): LoadResult {
  if (raw === undefined || raw === null) return { ok: true, data: emptyData(), fresh: true };
  if (typeof raw !== "object") return { ok: false };
  const record = raw as Record<string, unknown>;

  if (record.version === SCHEMA_VERSION) {
    const candidate = {
      ...record,
      settings: readSettings(record.settings),
    };
    const parsed = DataSchema.safeParse(candidate);
    if (parsed.success) return { ok: true, data: parsed.data, fresh: false };
    // Keep every group that is still valid rather than losing the whole page.
    if (Array.isArray(record.groups)) {
      const groups = record.groups.flatMap((group) => {
        const result = GroupSchema.safeParse(group);
        return result.success ? [result.data] : [];
      });
      if (groups.length > 0 || record.groups.length === 0) {
        return {
          ok: true,
          data: { ...emptyData(), groups, settings: readSettings(record.settings) },
          fresh: false,
        };
      }
    }
    return { ok: false };
  }

  // Future versions: add `if (record.version === 1) raw = migrateV1toV2(raw)` steps here.
  return { ok: false };
}

/** Settings tolerate missing or invalid fields by falling back to defaults per field. */
export function readSettings(raw: unknown): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return settings;
  const shape = SettingsSchema.shape;
  for (const key of Object.keys(shape) as (keyof Settings)[]) {
    const result = shape[key].safeParse((raw as Record<string, unknown>)[key]);
    if (result.success) (settings as Record<string, unknown>)[key] = result.data;
  }
  return settings;
}
