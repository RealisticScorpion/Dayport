import { useEffect, useRef, useState } from "react";
import { openLink } from "../../app/appearance";
import { Favicon } from "../../app/Favicon";
import { useI18n } from "../../app/i18n";
import { CloseIcon, EditIcon, GripIcon, TrashIcon } from "../../app/icons";
import { useToast } from "../../app/Toasts";
import type { DayportStore } from "../../app/useDayport";
import {
  addGroup,
  addLink,
  deleteGroup,
  deleteLink,
  findLink,
  moveLink,
  newId,
  nudgeLink,
  renameGroup,
  updateLink,
} from "../../data/ops";
import { MAX_GROUP_NAME_LENGTH, type DayportData, type Group } from "../../data/schema";
import { LinkForm } from "./LinkForm";

const COLLAPSED_LIMIT = 12;

interface Props {
  data: DayportData;
  apply: DayportStore["apply"];
  editing: boolean;
  setEditing: (editing: boolean) => void;
  /** Group whose add-link form should open, e.g. after "Add a link" on first run. */
  addingGroupId: string | null;
  setAddingGroupId: (groupId: string | null) => void;
}

export function Navigation({
  data,
  apply,
  editing,
  setEditing,
  addingGroupId,
  setAddingGroupId,
}: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState({ g: 0, i: 0 });
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ groupId: string; index: number } | null>(null);
  const focusAfter = useRef<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Restore focus to the item that moved or was created once React has rendered it.
  useEffect(() => {
    const target = focusAfter.current;
    if (!target || !gridRef.current) return;
    focusAfter.current = null;
    const element = gridRef.current.querySelector<HTMLElement>(
      `[data-focus-key="${CSS.escape(target)}"]`,
    );
    element?.focus();
    if (element instanceof HTMLInputElement) element.select();
  });

  const remove = (linkId: string) => {
    const before = data;
    const found = findLink(data, linkId);
    if (!found) return;
    void apply((current) => deleteLink(current, linkId));
    toast({
      text: t("deletedLink", { name: found.link.title }),
      action: {
        label: t("undo"),
        run: () => void apply(() => ({ ...before, updatedAt: Date.now() })),
      },
    });
  };

  const removeGroup = (group: Group) => {
    const before = data;
    void apply((current) => deleteGroup(current, group.id));
    toast({
      text: t("deletedGroup", { name: group.name }),
      action: {
        label: t("undo"),
        run: () => void apply(() => ({ ...before, updatedAt: Date.now() })),
      },
    });
  };

  const createGroup = () => {
    const id = newId();
    focusAfter.current = `group:${id}`;
    void apply((current) => addGroup(current, t("newGroupName"), id));
  };

  const onDropAt = (groupId: string, index: number) => {
    const id = dragId;
    setDragId(null);
    setDrop(null);
    if (!id) return;
    const found = findLink(data, id);
    if (!found) return;
    // moveLink counts the target index after removing the dragged link.
    const adjusted = found.group.id === groupId && found.index < index ? index - 1 : index;
    void apply((current) => moveLink(current, id, groupId, adjusted));
  };

  // Arrow keys move between links in view mode: one tab stop for the whole grid.
  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (editing) return;
    const key = event.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    const visible = data.groups.map((group) => visibleLinks(group).length);
    let { g, i } = focus;
    if (key === "ArrowDown") i = Math.min(i + 1, visible[g]! - 1);
    if (key === "ArrowUp") i = Math.max(i - 1, 0);
    if (key === "Home") i = 0;
    if (key === "End") i = visible[g]! - 1;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const step = key === "ArrowLeft" ? -1 : 1;
      let next = g + step;
      while (next >= 0 && next < visible.length && visible[next] === 0) next += step;
      if (next < 0 || next >= visible.length) return;
      g = next;
      i = Math.min(i, visible[g]! - 1);
    }
    event.preventDefault();
    setFocus({ g, i });
    gridRef.current?.querySelector<HTMLElement>(`[data-g="${g}"][data-i="${i}"]`)?.focus();
  };

  const visibleLinks = (group: Group) =>
    expanded.has(group.id) || editing ? group.links : group.links.slice(0, COLLAPSED_LIMIT);

  // Keep the roving tab stop on a link that still exists.
  const firstWithLinks = data.groups.findIndex((group) => group.links.length > 0);
  const tabStop =
    data.groups[focus.g] && focus.i < visibleLinks(data.groups[focus.g]!).length
      ? focus
      : { g: firstWithLinks, i: 0 };

  return (
    <section className="navigation" aria-labelledby="dayport-pinned">
      {editing ? (
        <div className="section-bar editing-bar">
          <h2 id="dayport-pinned" className="heading">
            {t("editingBar")}
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(false);
              setEditingLinkId(null);
              setAddingGroupId(null);
            }}
          >
            {t("done")}
          </button>
        </div>
      ) : (
        <div className="section-bar">
          <h2 id="dayport-pinned" className="heading">
            {t("pinned")}
          </h2>
          <button
            type="button"
            className="btn"
            style={{ marginRight: -8 }}
            onClick={() => setEditing(true)}
          >
            <EditIcon />
            {t("edit")}
          </button>
        </div>
      )}

      <div className="groups" ref={gridRef} onKeyDown={onGridKeyDown}>
        {data.groups.map((group, gi) => {
          const links = visibleLinks(group);
          const hidden = group.links.length - links.length;
          if (!editing) {
            return (
              <div className="group" key={group.id}>
                <h3 className="heading">{group.name}</h3>
                {links.map((link, li) => (
                  <a
                    key={link.id}
                    className="row"
                    href={link.url}
                    data-g={gi}
                    data-i={li}
                    tabIndex={tabStop.g === gi && tabStop.i === li ? 0 : -1}
                    onFocus={() => setFocus({ g: gi, i: li })}
                    onClick={(event) => {
                      if (link.url.startsWith("chrome:")) {
                        event.preventDefault();
                        openLink(link.url, { background: event.metaKey || event.ctrlKey });
                      }
                    }}
                  >
                    <Favicon url={link.url} title={link.title} />
                    <span className="label">{link.title}</span>
                  </a>
                ))}
                {(hidden > 0 || expanded.has(group.id)) && group.links.length > COLLAPSED_LIMIT && (
                  <button
                    type="button"
                    className="btn more"
                    aria-expanded={expanded.has(group.id)}
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                  >
                    {hidden > 0 ? t("more", { count: hidden }) : t("less")}
                  </button>
                )}
              </div>
            );
          }

          return (
            <div
              key={group.id}
              className={`group${drop?.groupId === group.id && drop.index === group.links.length ? " drop-end" : ""}`}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                if (event.target === event.currentTarget)
                  setDrop({ groupId: group.id, index: group.links.length });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (drop) onDropAt(drop.groupId, drop.index);
              }}
            >
              <div className="group-header">
                <label className="sr-only" htmlFor={`group-${group.id}`}>
                  {t("groupName")}
                </label>
                <input
                  id={`group-${group.id}`}
                  className="field"
                  data-focus-key={`group:${group.id}`}
                  defaultValue={group.name}
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (!name) event.target.value = group.name;
                    else if (name !== group.name)
                      void apply((current) => renameGroup(current, group.id, name));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      event.currentTarget.value = group.name;
                      event.currentTarget.blur();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("deleteGroup", { name: group.name })}
                  onClick={() => removeGroup(group)}
                >
                  <TrashIcon />
                </button>
              </div>

              {group.links.map((link, li) =>
                editingLinkId === link.id ? (
                  <LinkForm
                    key={link.id}
                    initial={link}
                    onCancel={() => {
                      focusAfter.current = link.id;
                      setEditingLinkId(null);
                    }}
                    onDelete={() => {
                      setEditingLinkId(null);
                      remove(link.id);
                    }}
                    onSave={(value) => {
                      focusAfter.current = link.id;
                      setEditingLinkId(null);
                      void apply((current) => updateLink(current, link.id, value));
                    }}
                  />
                ) : (
                  <div
                    key={link.id}
                    className={`row editable${drop?.groupId === group.id && drop.index === li ? " drop-before" : ""}${
                      dragId === link.id ? " dragging" : ""
                    }`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", link.id);
                      setDragId(link.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDrop(null);
                    }}
                    onDragOver={(event) => {
                      if (!dragId) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const before = event.clientY < rect.top + rect.height / 2;
                      setDrop({ groupId: group.id, index: before ? li : li + 1 });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (drop) onDropAt(drop.groupId, drop.index);
                    }}
                    onKeyDown={(event) => {
                      const direction = {
                        ArrowUp: "up",
                        ArrowDown: "down",
                        ArrowLeft: "left",
                        ArrowRight: "right",
                      }[event.key] as "up" | "down" | "left" | "right" | undefined;
                      if (event.altKey && direction) {
                        event.preventDefault();
                        focusAfter.current = link.id;
                        void apply((current) => nudgeLink(current, link.id, direction));
                      } else if (event.key === "Delete") {
                        event.preventDefault();
                        remove(link.id);
                      }
                    }}
                  >
                    <span
                      className="grip"
                      title={t("dragHandle", { name: link.title })}
                      aria-hidden="true"
                    >
                      <GripIcon />
                    </span>
                    <button
                      type="button"
                      className="row-title"
                      data-focus-key={link.id}
                      aria-label={t("editLink", { name: link.title })}
                      onClick={() => {
                        setAddingGroupId(null);
                        setEditingLinkId(link.id);
                      }}
                    >
                      {link.title}
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon"
                      aria-label={t("deleteLink", { name: link.title })}
                      onClick={() => remove(link.id)}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ),
              )}

              {addingGroupId === group.id ? (
                <LinkForm
                  onCancel={() => setAddingGroupId(null)}
                  onSave={(value) => {
                    const id = newId();
                    void apply((current) => addLink(current, group.id, value, id));
                    // Keep the form open for adding several links in a row.
                    setAddingGroupId(null);
                    queueMicrotask(() => setAddingGroupId(group.id));
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="btn add"
                  onClick={() => {
                    setEditingLinkId(null);
                    setAddingGroupId(group.id);
                  }}
                >
                  {t("addLink")}
                </button>
              )}
            </div>
          );
        })}
        {editing && (
          <button type="button" className="btn new-group" onClick={createGroup}>
            {t("newGroup")}
          </button>
        )}
      </div>
    </section>
  );
}
