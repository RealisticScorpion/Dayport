import type { DayportData, Group, Link, Settings } from "./schema";

// Pure, immutable edits to the persisted document. The store applies one of
// these, renders the result immediately, and then persists it.

export type NewId = () => string;
export const newId: NewId = () => crypto.randomUUID();

function touch(data: DayportData, groups: Group[]): DayportData {
  return { ...data, groups, updatedAt: Date.now() };
}

function mapGroup(data: DayportData, groupId: string, fn: (group: Group) => Group): DayportData {
  return touch(
    data,
    data.groups.map((group) => (group.id === groupId ? fn(group) : group)),
  );
}

export function addGroup(data: DayportData, name: string, id = newId()): DayportData {
  return touch(data, [...data.groups, { id, name, links: [] }]);
}

export function renameGroup(data: DayportData, groupId: string, name: string): DayportData {
  return mapGroup(data, groupId, (group) => ({ ...group, name }));
}

export function deleteGroup(data: DayportData, groupId: string): DayportData {
  return touch(
    data,
    data.groups.filter((group) => group.id !== groupId),
  );
}

export function moveGroup(data: DayportData, groupId: string, toIndex: number): DayportData {
  const from = data.groups.findIndex((group) => group.id === groupId);
  if (from < 0) return data;
  const groups = [...data.groups];
  const [moved] = groups.splice(from, 1);
  groups.splice(clamp(toIndex, 0, groups.length), 0, moved!);
  return touch(data, groups);
}

export function addLink(
  data: DayportData,
  groupId: string,
  link: Omit<Link, "id">,
  id = newId(),
): DayportData {
  return mapGroup(data, groupId, (group) => ({
    ...group,
    links: [...group.links, { id, ...link }],
  }));
}

export function updateLink(
  data: DayportData,
  linkId: string,
  patch: Partial<Omit<Link, "id">>,
): DayportData {
  return touch(
    data,
    data.groups.map((group) => ({
      ...group,
      links: group.links.map((link) => (link.id === linkId ? { ...link, ...patch } : link)),
    })),
  );
}

export function deleteLink(data: DayportData, linkId: string): DayportData {
  return touch(
    data,
    data.groups.map((group) => ({
      ...group,
      links: group.links.filter((link) => link.id !== linkId),
    })),
  );
}

export function findLink(
  data: DayportData,
  linkId: string,
): { group: Group; index: number; link: Link } | null {
  for (const group of data.groups) {
    const index = group.links.findIndex((link) => link.id === linkId);
    if (index >= 0) return { group, index, link: group.links[index]! };
  }
  return null;
}

/** Moves a link to `toIndex` within `toGroupId`; the index counts positions after removal. */
export function moveLink(
  data: DayportData,
  linkId: string,
  toGroupId: string,
  toIndex: number,
): DayportData {
  const found = findLink(data, linkId);
  if (!found || !data.groups.some((group) => group.id === toGroupId)) return data;
  const without = data.groups.map((group) =>
    group.id === found.group.id
      ? { ...group, links: group.links.filter((link) => link.id !== linkId) }
      : group,
  );
  return touch(
    data,
    without.map((group) => {
      if (group.id !== toGroupId) return group;
      const links = [...group.links];
      links.splice(clamp(toIndex, 0, links.length), 0, found.link);
      return { ...group, links };
    }),
  );
}

/** Keyboard reordering: moves a link one step up/down, or into the neighboring group. */
export function nudgeLink(
  data: DayportData,
  linkId: string,
  direction: "up" | "down" | "left" | "right",
): DayportData {
  const found = findLink(data, linkId);
  if (!found) return data;
  const groupIndex = data.groups.findIndex((group) => group.id === found.group.id);
  if (direction === "up") return moveLink(data, linkId, found.group.id, found.index - 1);
  if (direction === "down") return moveLink(data, linkId, found.group.id, found.index + 1);
  const target = data.groups[groupIndex + (direction === "left" ? -1 : 1)];
  if (!target) return data;
  return moveLink(data, linkId, target.id, Math.min(found.index, target.links.length));
}

export function updateSettings(data: DayportData, patch: Partial<Settings>): DayportData {
  return { ...data, settings: { ...data.settings, ...patch }, updatedAt: Date.now() };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
