import { readSettings } from "./migrate";
import { newId, type NewId } from "./ops";
import {
  MAX_GROUP_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  SCHEMA_VERSION,
  type DayportData,
  type Group,
  type Settings,
} from "./schema";
import { normalizeUrl, titleFromUrl, urlKey } from "./url";

export const BACKUP_FORMAT = "dayport-backup";

export interface BackupContents {
  links: boolean;
  settings: boolean;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  groups?: Group[];
  settings?: Settings;
}

export function createBackup(
  data: DayportData,
  contents: BackupContents,
  now = new Date(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...(contents.links ? { groups: data.groups } : {}),
    ...(contents.settings ? { settings: data.settings } : {}),
  };
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `dayport-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export type RejectReason = "empty" | "invalid" | "scheme" | "length" | "malformed";

export interface Rejected {
  kind: "link" | "group";
  label: string;
  reason: RejectReason;
}

export type ParsedBackup =
  | { ok: false; error: "json" | "format" | "version" | "empty" }
  | { ok: true; groups: Group[]; settings: Settings | null; rejected: Rejected[] };

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Validates an imported file without touching current data. Invalid entries
 * are listed and skipped rather than failing the whole file; ids are
 * regenerated so imports never collide with existing items.
 */
export function parseBackup(text: string, makeId: NewId = newId): ParsedBackup {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: "format" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "json" };
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as Record<string, unknown>).format !== BACKUP_FORMAT
  ) {
    return { ok: false, error: "format" };
  }
  const file = raw as Record<string, unknown>;
  if (typeof file.version !== "number" || file.version > SCHEMA_VERSION || file.version < 1) {
    return { ok: false, error: "version" };
  }

  const rejected: Rejected[] = [];
  const groups: Group[] = [];
  if (file.groups !== undefined) {
    if (!Array.isArray(file.groups)) return { ok: false, error: "format" };
    for (const rawGroup of file.groups) {
      const group = asRecord(rawGroup);
      const name =
        typeof group?.name === "string" ? group.name.trim().slice(0, MAX_GROUP_NAME_LENGTH) : "";
      if (!group || !name || !Array.isArray(group.links)) {
        rejected.push({ kind: "group", label: name || "—", reason: "malformed" });
        continue;
      }
      const links: Group["links"] = [];
      for (const rawLink of group.links) {
        const link = asRecord(rawLink);
        const rawTitle = typeof link?.title === "string" ? link.title.trim() : "";
        const checked = normalizeUrl(typeof link?.url === "string" ? link.url : "");
        if (!checked.ok) {
          rejected.push({ kind: "link", label: rawTitle || "—", reason: checked.reason });
          continue;
        }
        links.push({
          id: makeId(),
          title: (rawTitle || titleFromUrl(checked.url)).slice(0, MAX_TITLE_LENGTH),
          url: checked.url,
        });
      }
      groups.push({ id: makeId(), name, links });
    }
  }
  const settings = file.settings === undefined ? null : readSettings(file.settings);
  if (file.groups === undefined && settings === null) return { ok: false, error: "empty" };
  return { ok: true, groups, settings, rejected };
}

export interface ImportPreview {
  groups: number;
  links: number;
  duplicateLinks: number;
  hasSettings: boolean;
}

export function previewImport(
  current: DayportData,
  parsed: Extract<ParsedBackup, { ok: true }>,
): ImportPreview {
  const existing = new Set(
    current.groups.flatMap((group) => group.links.map((link) => urlKey(link.url))),
  );
  const links = parsed.groups.flatMap((group) => group.links);
  return {
    groups: parsed.groups.length,
    links: links.length,
    duplicateLinks: links.filter((link) => existing.has(urlKey(link.url))).length,
    hasSettings: parsed.settings !== null,
  };
}

/** Merge keeps current content and settings; adds new groups and links not already saved anywhere. */
export function mergeImport(
  current: DayportData,
  parsed: Extract<ParsedBackup, { ok: true }>,
): DayportData {
  const seen = new Set(
    current.groups.flatMap((group) => group.links.map((link) => urlKey(link.url))),
  );
  const groups = current.groups.map((group) => ({ ...group, links: [...group.links] }));
  for (const incoming of parsed.groups) {
    const fresh = incoming.links.filter((link) => {
      const key = urlKey(link.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const target = groups.find((group) => sameName(group.name, incoming.name));
    if (target) target.links.push(...fresh);
    else if (fresh.length > 0 || incoming.links.length === 0)
      groups.push({ ...incoming, links: fresh });
  }
  return { ...current, groups, updatedAt: Date.now() };
}

/** Replace swaps in the imported links, and its settings when the file has them. */
export function replaceImport(
  current: DayportData,
  parsed: Extract<ParsedBackup, { ok: true }>,
): DayportData {
  return {
    ...current,
    groups: parsed.groups,
    settings: parsed.settings ?? current.settings,
    updatedAt: Date.now(),
  };
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
