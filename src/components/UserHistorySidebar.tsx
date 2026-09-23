"use client"

import * as React from "react"
import {
  SquarePen,
  Image as ImageIcon,
  Puzzle,
  Compass,
  GitCompare,
  BarChart3,
  Sparkles,
  Settings,
  HelpCircle,
  User,
  MoreHorizontal,
  Share2,
  Clock,
  Sun,
  Moon,
  AlertCircle,
  RefreshCw,
  Pencil,
  Trash2
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar"
import { ChitravitsEmblem } from "./ui/ChitravitsLogo"
import {
  deleteConversation,
  getAnalysisHistory,
  listConversations,
  renameConversation,
  type Conversation,
  type HistoryItem as ApiHistoryItem
} from "../lib/apiClient"

interface UserHistorySidebarProps {
  onNewChat: () => void
  onSelectConversation: (conversation: Conversation) => void
  onSelectHistoryItem: (item: ApiHistoryItem) => void
  onConversationRenamed?: (conversation: Conversation) => void
  onConversationDeleted?: (conversationId: string) => void
  onNavigateScreen: (screenId: string) => void
  activeScreen: string
  activeConversationId?: string | null
  activeImageryId?: string | null
  refreshToken?: number
  theme: string
  onToggleTheme: () => void
}

// One sidebar row. Conversations carry their stored title; legacy entries
// (requests made before conversations existed, one per image) are shown by
// their first query -- never by the uploaded filename -- and are read-only.
type SidebarEntry =
  | { kind: "conversation"; key: string; title: string; at: string; conversation: Conversation }
  | { kind: "legacy"; key: string; title: string; at: string; item: ApiHistoryItem }

type DateGroup = "today" | "yesterday" | "sevenDays" | "thirtyDays" | "older"

const GROUP_LABELS: Array<[DateGroup, string]> = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["sevenDays", "Previous 7 Days"],
  ["thirtyDays", "Previous 30 Days"],
  ["older", "Older"]
]

function groupForDate(iso: string): DateGroup {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const days = Math.floor((startOfToday.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return "sevenDays"
  if (days < 30) return "thirtyDays"
  return "older"
}

function truncate(text: string, max = 60): string {
  if (!text) return ""
  return text.length > max ? text.slice(0, max - 1) + "…" : text
}

function buildEntries(conversations: Conversation[], history: ApiHistoryItem[]): SidebarEntry[] {
  const entries: SidebarEntry[] = conversations.map((conversation) => ({
    kind: "conversation",
    key: `c-${conversation.id}`,
    title: conversation.title,
    at: conversation.updated_at || conversation.created_at,
    conversation
  }))

  // history is newest first, so the last item seen per image is its first query.
  const legacyByImage = new Map<string, { latest: ApiHistoryItem; first: ApiHistoryItem }>()
  history
    .filter((item) => !item.conversation_id)
    .forEach((item) => {
      const existing = legacyByImage.get(item.imagery_id)
      if (existing) existing.first = item
      else legacyByImage.set(item.imagery_id, { latest: item, first: item })
    })
  legacyByImage.forEach(({ latest, first }, imageryId) => {
    entries.push({
      kind: "legacy",
      key: `l-${imageryId}`,
      title: truncate(first.query),
      at: latest.created_at,
      item: latest
    })
  })

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

interface ConversationRowProps {
  entry: SidebarEntry
  isActive: boolean
  isMenuOpen: boolean
  onOpenMenu: (key: string | null) => void
  onSelect: (entry: SidebarEntry) => void
  onRename: (conversation: Conversation, title: string) => Promise<void>
  onDelete: (conversation: Conversation) => Promise<void>
}

function ConversationRow({ entry, isActive, isMenuOpen, onOpenMenu, onSelect, onRename, onDelete }: ConversationRowProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(entry.title)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isMenuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onOpenMenu(null)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [isMenuOpen, onOpenMenu])

  const commitRename = async () => {
    setIsEditing(false)
    const title = draft.trim()
    if (entry.kind !== "conversation" || !title || title === entry.title) return
    await onRename(entry.conversation, title)
  }

  if (isEditing && entry.kind === "conversation") {
    return (
      <SidebarMenuItem>
        <input
          autoFocus
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") {
              setDraft(entry.title)
              setIsEditing(false)
            }
          }}
          aria-label="Conversation title"
          className="w-full h-8.5 rounded-lg px-2 text-[0.88rem] bg-sidebar-accent text-sidebar-foreground outline-none ring-1 ring-blue-500/60"
        />
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => onSelect(entry)}
        isActive={isActive}
        className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg"
        tooltip={entry.title}
      >
        <span className="truncate">{entry.title}</span>
      </SidebarMenuButton>

      {entry.kind === "conversation" && (
        <>
          <SidebarMenuAction
            showOnHover
            className="top-2"
            data-state={isMenuOpen ? "open" : "closed"}
            onClick={(e) => {
              e.stopPropagation()
              onOpenMenu(isMenuOpen ? null : entry.key)
            }}
            title="Conversation options"
            aria-label="Conversation options"
          >
            <MoreHorizontal />
          </SidebarMenuAction>

          {isMenuOpen && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute right-1 top-9 z-50 min-w-32 rounded-lg border border-sidebar-border bg-sidebar p-1 shadow-lg"
            >
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => {
                  onOpenMenu(null)
                  setDraft(entry.title)
                  setIsEditing(true)
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Rename</span>
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-400 hover:bg-sidebar-accent"
                onClick={() => {
                  onOpenMenu(null)
                  onDelete(entry.conversation)
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </>
      )}
    </SidebarMenuItem>
  )
}

export function UserHistorySidebar({
  onNewChat,
  onSelectConversation,
  onSelectHistoryItem,
  onConversationRenamed,
  onConversationDeleted,
  onNavigateScreen,
  activeScreen,
  activeConversationId,
  activeImageryId,
  refreshToken,
  theme,
  onToggleTheme
}: UserHistorySidebarProps) {
  // Real backend data ONLY -- see CLAUDE.md / backend README. No hardcoded
  // entries, and a failed fetch never falls back to stale/sample data.
  const [entries, setEntries] = React.useState<SidebarEntry[]>([])
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading")
  const [openMenuKey, setOpenMenuKey] = React.useState<string | null>(null)
  const { isMobile, setOpenMobile } = useSidebar()
  const hasLoadedRef = React.useRef(false)

  const fetchHistory = React.useCallback(() => {
    // Only the very first load shows "Loading…"; refreshes (e.g. a title
    // arriving) swap the list in place instead of flashing it away.
    if (!hasLoadedRef.current) setStatus("loading")
    Promise.all([listConversations(100), getAnalysisHistory(200)])
      .then(([conversations, history]) => {
        setEntries(buildEntries(conversations, history))
        setStatus("ready")
        hasLoadedRef.current = true
      })
      .catch((err) => {
        console.error("[SatQuery] Failed to load conversation history:", err)
        setEntries([])
        setStatus("error")
        hasLoadedRef.current = false
      })
  }, [])

  React.useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshToken])

  const handleItemClick = (entry: SidebarEntry) => {
    if (entry.kind === "conversation") onSelectConversation(entry.conversation)
    else onSelectHistoryItem(entry.item)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleRename = async (conversation: Conversation, title: string) => {
    // Optimistic: show the new title immediately, reconcile with the server.
    setEntries((prev) => prev.map((e) => (e.key === `c-${conversation.id}` ? { ...e, title } : e)))
    try {
      const updated = await renameConversation(conversation.id, title)
      onConversationRenamed?.(updated)
    } catch (err) {
      console.error("[SatQuery] Failed to rename conversation:", err)
      window.alert(`Could not rename conversation: ${(err as Error).message || "unknown error"}`)
    }
    fetchHistory()
  }

  const handleDelete = async (conversation: Conversation) => {
    const ok = window.confirm(
      `Delete "${conversation.title}"?\n\nThis permanently removes the conversation, its queries and its uploaded images.`
    )
    if (!ok) return
    try {
      await deleteConversation(conversation.id)
      onConversationDeleted?.(conversation.id)
    } catch (err) {
      console.error("[SatQuery] Failed to delete conversation:", err)
      window.alert(`Could not delete conversation: ${(err as Error).message || "unknown error"}`)
    }
    fetchHistory()
  }

  // A conversation is highlighted on the landing screen too: New Chat opens a
  // real (still empty) conversation there, so the sidebar shows that record
  // rather than a frontend-only placeholder.
  const isEntryActive = (entry: SidebarEntry) =>
    entry.kind === "conversation"
      ? (activeScreen === "workspace" || activeScreen === "landing") &&
        entry.conversation.id === activeConversationId
      : activeScreen === "workspace" && !activeConversationId && entry.item.imagery_id === activeImageryId

  const grouped = GROUP_LABELS.map(([group, label]) => ({
    group,
    label,
    items: entries.filter((entry) => groupForDate(entry.at) === group)
  }))

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border select-none">
      {/* Header: Brand, New Chat, and Sidebar Close Action */}
      <SidebarHeader className="p-3 pb-2 border-b border-sidebar-border/30">
        <div className="flex items-center justify-between gap-2">
          <div 
            className="flex items-center gap-2 px-1 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => {
              onNewChat()
              if (isMobile) setOpenMobile(false)
            }}
            title="SatQuery AI - New Analysis"
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center p-0.5 border border-blue-500/40 shadow-sm shrink-0">
              <ChitravitsEmblem size={24} />
            </div>
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
              Sat<span className="text-blue-500">Query</span> <span className="text-[10px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30 ml-0.5">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                onNewChat()
                if (isMobile) setOpenMobile(false)
              }}
              className="flex items-center justify-center p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors cursor-pointer"
              title="New Chat / New Analysis"
            >
              <SquarePen className="w-4 h-4" />
            </button>
            <SidebarTrigger className="hover:bg-sidebar-accent rounded-lg p-1.5 transition-colors cursor-pointer text-sidebar-foreground" title="Close Sidebar (Ctrl+B)" />
          </div>
        </div>

        {/* Primary ChatGPT-Style Fast Shortcuts */}
        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNewChat()
                if (isMobile) setOpenMobile(false)
              }}
              className="font-medium text-[0.92rem] py-2 h-9"
              tooltip="New Chat"
            >
              <SquarePen className="w-4 h-4 text-sidebar-foreground" />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNavigateScreen("fusion")
                if (isMobile) setOpenMobile(false)
              }}
              isActive={activeScreen === "fusion"}
              className="text-[0.92rem] py-2 h-9"
              tooltip="Multimodal Satellite Images"
            >
              <ImageIcon className="w-4 h-4 text-sidebar-foreground" />
              <span>Images</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNavigateScreen("pipeline")
                if (isMobile) setOpenMobile(false)
              }}
              isActive={activeScreen === "pipeline"}
              className="text-[0.92rem] py-2 h-9"
              tooltip="Agentic Remote Sensing Pipeline"
            >
              <Puzzle className="w-4 h-4 text-sidebar-foreground" />
              <span>Plugins</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNavigateScreen("report")
                if (isMobile) setOpenMobile(false)
              }}
              isActive={activeScreen === "report"}
              className="text-[0.92rem] py-2 h-9"
              tooltip="Intelligence Dossier Research"
            >
              <Compass className="w-4 h-4 text-sidebar-foreground" />
              <span>Deep research</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Content: Chronological Chat History -- backend-driven only */}
      <SidebarContent className="px-2 scrollbar-thin">
        {status === "loading" && (
          <div className="px-3 py-4 text-xs text-sidebar-foreground/50">Loading history…</div>
        )}

        {status === "error" && (
          <div className="px-3 py-4 flex flex-col items-start gap-2 text-xs text-sidebar-foreground/70">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>Unable to load conversation history.</span>
            </div>
            <button
              onClick={fetchHistory}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {status === "ready" && entries.length === 0 && (
          <div className="px-3 py-4 text-xs text-sidebar-foreground/50">No conversations yet.</div>
        )}

        {status === "ready" && grouped.map(({ group, label, items }) => {
          if (items.length === 0) return null
          return (
            <SidebarGroup key={group} className="py-1">
              <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
                {label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((entry) => (
                    <ConversationRow
                      key={entry.key}
                      entry={entry}
                      isActive={isEntryActive(entry)}
                      isMenuOpen={openMenuKey === entry.key}
                      onOpenMenu={setOpenMenuKey}
                      onSelect={handleItemClick}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      {/* Footer: ChatGPT-Style Settings, Plans, Help, and User Profile */}
      <SidebarFooter className="p-3 border-t border-sidebar-border/60">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onNavigateScreen("report")}
              className="text-[0.88rem] py-1.5 h-8.5"
              tooltip="SatQuery Enterprise Plans"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>See plans and pricing</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onToggleTheme}
              className="text-[0.88rem] py-1.5 h-8.5"
              tooltip={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-yellow-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-500" />
              )}
              <span>Settings & Appearance</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onNavigateScreen("pipeline")}
              className="text-[0.88rem] py-1.5 h-8.5"
              tooltip="Documentation & ISRO Help"
            >
              <HelpCircle className="w-4 h-4 text-sidebar-foreground" />
              <span>Help & Mission Guide</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* User Profile Tile */}
          <SidebarMenuItem className="mt-2 pt-2 border-t border-sidebar-border/40">
            <SidebarMenuButton className="w-full justify-between gap-3 h-12 hover:bg-sidebar-accent rounded-lg p-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
                  SD
                </div>
                <div className="flex flex-col items-start min-w-0 leading-tight">
                  <span className="text-sm font-semibold text-sidebar-foreground truncate">
                    Shruti Daware
                  </span>
                  <span className="text-[0.72rem] text-sidebar-foreground/60 truncate">
                    ISRO Remote Sensing Lab
                  </span>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 opacity-60 shrink-0" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
