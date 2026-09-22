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
  RefreshCw
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar"
import { ChitravitsEmblem } from "./ui/ChitravitsLogo"
import { getAnalysisHistory, type HistoryItem as ApiHistoryItem } from "../lib/apiClient"

interface UserHistorySidebarProps {
  onNewChat: () => void
  onSelectHistoryItem: (item: ApiHistoryItem) => void
  onNavigateScreen: (screenId: string) => void
  activeScreen: string
  activeImageryId?: string | null
  refreshToken?: number
  theme: string
  onToggleTheme: () => void
}

type DateGroup = "today" | "sevenDays" | "thirtyDays" | "older"

function groupForDate(iso: string): DateGroup {
  const created = new Date(iso).getTime()
  const now = Date.now()
  const days = (now - created) / (1000 * 60 * 60 * 24)
  if (days < 1) return "today"
  if (days < 7) return "sevenDays"
  if (days < 30) return "thirtyDays"
  return "older"
}

function truncate(text: string, max = 60): string {
  if (!text) return ""
  return text.length > max ? text.slice(0, max - 1) + "…" : text
}

export function UserHistorySidebar({
  onNewChat,
  onSelectHistoryItem,
  onNavigateScreen,
  activeScreen,
  activeImageryId,
  refreshToken,
  theme,
  onToggleTheme
}: UserHistorySidebarProps) {
  // Real backend data ONLY -- see CLAUDE.md / backend README. No hardcoded
  // entries, and a failed fetch never falls back to stale/sample data.
  const [historyList, setHistoryList] = React.useState<ApiHistoryItem[]>([])
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading")
  const { isMobile, setOpenMobile } = useSidebar()

  const fetchHistory = React.useCallback(() => {
    setStatus("loading")
    getAnalysisHistory(100)
      .then((items) => {
        setHistoryList(items)
        setStatus("ready")
      })
      .catch((err) => {
        console.error("[SatQuery] Failed to load analysis history:", err)
        setHistoryList([])
        setStatus("error")
      })
  }, [])

  React.useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshToken])

  const handleItemClick = (item: ApiHistoryItem) => {
    onSelectHistoryItem(item)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const todayItems = historyList.filter(i => groupForDate(i.created_at) === "today")
  const sevenDaysItems = historyList.filter(i => groupForDate(i.created_at) === "sevenDays")
  const thirtyDaysItems = historyList.filter(i => groupForDate(i.created_at) === "thirtyDays" || groupForDate(i.created_at) === "older")

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
              <span>Unable to load analysis history.</span>
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

        {status === "ready" && historyList.length === 0 && (
          <div className="px-3 py-4 text-xs text-sidebar-foreground/50">No analysis history yet.</div>
        )}

        {status === "ready" && todayItems.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
              Today
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {todayItems.map(item => (
                  <SidebarMenuItem key={item.job_id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={activeImageryId === item.imagery_id && activeScreen === "workspace"}
                      className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg"
                      tooltip={item.query}
                    >
                      <span className="truncate">{truncate(item.imagery_name ? `${item.imagery_name}: ${item.query}` : item.query)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {status === "ready" && sevenDaysItems.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
              Previous 7 Days
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sevenDaysItems.map(item => (
                  <SidebarMenuItem key={item.job_id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={activeImageryId === item.imagery_id && activeScreen === "workspace"}
                      className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg"
                      tooltip={item.query}
                    >
                      <span className="truncate">{truncate(item.imagery_name ? `${item.imagery_name}: ${item.query}` : item.query)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {status === "ready" && thirtyDaysItems.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
              Previous 30 Days
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {thirtyDaysItems.map(item => (
                  <SidebarMenuItem key={item.job_id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={activeImageryId === item.imagery_id && activeScreen === "workspace"}
                      className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg"
                      tooltip={item.query}
                    >
                      <span className="truncate">{truncate(item.imagery_name ? `${item.imagery_name}: ${item.query}` : item.query)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
