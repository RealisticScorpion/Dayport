import type { ParsedBackup, Rejected } from "./backup";
import { newId, type NewId } from "./ops";
import { MAX_GROUP_NAME_LENGTH, MAX_TITLE_LENGTH, type Group } from "./schema";
import { normalizeUrl, titleFromUrl } from "./url";

// Bookmark import (docs/design.md, Data portability): each chosen folder
// becomes a group holding the folder's own links, not those of its subfolders.

export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

export interface BookmarkFolder {
  id: string;
  title: string;
  /** Titles of the enclosing folders, outermost first. */
  path: string[];
  links: number;
}

/** Folders that directly contain at least one bookmark, in tree order. */
export function bookmarkFolders(roots: BookmarkNode[]): BookmarkFolder[] {
  const folders: BookmarkFolder[] = [];
  const visit = (node: BookmarkNode, path: string[]) => {
    if (!node.children) return;
    const links = node.children.filter((child) => child.url).length;
    if (links > 0) folders.push({ id: node.id, title: node.title, path, links });
    const childPath = node.title ? [...path, node.title] : path;
    for (const child of node.children) visit(child, childPath);
  };
  for (const root of roots) visit(root, []);
  return folders;
}

/** Builds the same shape as a parsed backup, so preview and merge are shared with file import. */
export function bookmarksToImport(
  roots: BookmarkNode[],
  folderIds: string[],
  fallbackName: string,
  makeId: NewId = newId,
): Extract<ParsedBackup, { ok: true }> {
  const wanted = new Set(folderIds);
  const groups: Group[] = [];
  const rejected: Rejected[] = [];
  const visit = (node: BookmarkNode) => {
    if (!node.children) return;
    if (wanted.has(node.id)) {
      const links: Group["links"] = [];
      for (const child of node.children) {
        if (!child.url) continue;
        const checked = normalizeUrl(child.url);
        if (!checked.ok) {
          rejected.push({ kind: "link", label: child.title || child.url, reason: checked.reason });
          continue;
        }
        const title = (child.title.trim() || titleFromUrl(checked.url)).slice(0, MAX_TITLE_LENGTH);
        links.push({ id: makeId(), title, url: checked.url });
      }
      const name = (node.title.trim() || fallbackName).slice(0, MAX_GROUP_NAME_LENGTH);
      groups.push({ id: makeId(), name, links });
    }
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  return { ok: true, groups, settings: null, rejected };
}
