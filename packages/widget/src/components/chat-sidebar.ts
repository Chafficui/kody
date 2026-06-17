/** Conversation history sidebar component. */

import { el, on } from "../utils/dom.js";
import type { Conversation } from "../utils/session.js";

export interface ChatSidebarOptions {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export interface ChatSidebar {
  element: HTMLDivElement;
  update(conversations: Conversation[], activeId: string | null): void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";

  const date = new Date(timestamp);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function renderList(
  listEl: HTMLDivElement,
  conversations: Conversation[],
  activeId: string | null,
  onSelect: (id: string) => void,
  onDelete: (id: string) => void,
): void {
  while (listEl.firstChild) {
    listEl.removeChild(listEl.firstChild);
  }

  if (conversations.length === 0) {
    listEl.appendChild(el("div", { class: "kody-sidebar-empty" }, ["No conversations yet"]));
    return;
  }

  for (const convo of conversations) {
    const titleText = convo.title || "New conversation";
    const truncated = titleText.length > 40 ? titleText.slice(0, 40) + "..." : titleText;

    const titleEl = el("div", { class: "kody-sidebar-item-title" }, [truncated]);
    const timeEl = el("div", { class: "kody-sidebar-item-time" }, [formatRelativeTime(convo.updatedAt)]);
    const contentEl = el("div", { class: "kody-sidebar-item-content" }, [titleEl, timeEl]);

    const deleteBtn = el("button", {
      class: "kody-sidebar-item-delete",
      "aria-label": "Delete conversation",
    }, ["×"]);

    on(deleteBtn, "click", (e: MouseEvent) => {
      e.stopPropagation();
      onDelete(convo.id);
    });

    const isActive = convo.id === activeId;
    const itemClass = "kody-sidebar-item" + (isActive ? " kody-sidebar-item--active" : "");
    const item = el("div", { class: itemClass }, [contentEl, deleteBtn]);

    on(item, "click", () => onSelect(convo.id));

    listEl.appendChild(item);
  }
}

export function createChatSidebar(options: ChatSidebarOptions): ChatSidebar {
  const { conversations, activeId, onSelect, onDelete, onNewChat, onClose } = options;

  // Header
  const headerTitle = el("span", null, ["Conversations"]);
  const closeBtn = el("button", {
    class: "kody-sidebar-close",
    "aria-label": "Close sidebar",
  }, ["×"]);
  on(closeBtn, "click", () => onClose());

  const header = el("div", { class: "kody-sidebar-header" }, [headerTitle, closeBtn]);

  // New chat button
  const newChatBtn = el("button", { class: "kody-sidebar-new" }, ["+ New chat"]);
  on(newChatBtn, "click", () => onNewChat());

  // Conversation list
  const listEl = el("div", { class: "kody-sidebar-list" });
  renderList(listEl, conversations, activeId, onSelect, onDelete);

  // Sidebar container
  const sidebar = el("div", { class: "kody-sidebar" }, [header, newChatBtn, listEl]);

  return {
    element: sidebar,
    update(updatedConversations: Conversation[], updatedActiveId: string | null): void {
      renderList(listEl, updatedConversations, updatedActiveId, onSelect, onDelete);
    },
  };
}
