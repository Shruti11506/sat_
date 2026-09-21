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
  Trash2,
  Share2,
  Clock,
  Sun,
  Moon
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

interface UserHistorySidebarProps {
  onNewChat: () => void
  onSelectScenario: (scenarioId: string) => void
  onNavigateScreen: (screenId: string) => void
  activeScreen: string
  currentScenarioId?: string
  theme: string
  onToggleTheme: () => void
}

interface ChatHistoryItem {
  id: string
  title: string
  dateGroup: "today" | "sevenDays" | "thirtyDays"
  scenarioId?: string
  screenTarget?: string
}

const INITIAL_HISTORY: ChatHistoryItem[] = [
  {
    id: "hist-1",
    title: "Bengaluru Cartosat-3 Optical & SAR",
    dateGroup: "today",
    scenarioId: "bengaluru-urban"
  },
  {
    id: "hist-2",
    title: "Ulsoor Lake NDWI Water Boundary",
    dateGroup: "today",
    scenarioId: "bengaluru-urban"
  },
  {
    id: "hist-3",
    title: "142 Permanent Buildings Radar Backscatter",
    dateGroup: "today",
    scenarioId: "bengaluru-urban"
  },
  {
    id: "hist-4",
    title: "Bi-Temporal Delta 2021 vs 2026",
    dateGroup: "sevenDays",
    screenTarget: "change"
  },
  {
    id: "hist-5",
    title: "Riparian Buffer Vegetation Canopy (NDVI)",
    dateGroup: "sevenDays",
    scenarioId: "bengaluru-urban"
  },
  {
    id: "hist-6",
    title: "Optical + SAR Deep Learning Fusion",
    dateGroup: "sevenDays",
    screenTarget: "fusion"
  },
  {
    id: "hist-7",
    title: "ISRO 7-Stage Agent Pipeline Trace",
    dateGroup: "thirtyDays",
    screenTarget: "pipeline"
  },
  {
    id: "hist-8",
    title: "EPSG:4326 Datum Georeferencing Bounds",
    dateGroup: "thirtyDays",
    screenTarget: "analytics"
  }
]

export function UserHistorySidebar({
  onNewChat,
  onSelectScenario,
  onNavigateScreen,
  activeScreen,
  currentScenarioId,
  theme,
  onToggleTheme
}: UserHistorySidebarProps) {
  const [historyList, setHistoryList] = React.useState<ChatHistoryItem[]>(INITIAL_HISTORY)
  const [activeItemId, setActiveItemId] = React.useState<string>("hist-1")
  const { isMobile, setOpenMobile } = useSidebar()

  const handleItemClick = (item: ChatHistoryItem) => {
    setActiveItemId(item.id)
    if (item.screenTarget) {
      onNavigateScreen(item.screenTarget)
    } else if (item.scenarioId) {
      onSelectScenario(item.scenarioId)
      onNavigateScreen("workspace")
    }
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setHistoryList(prev => prev.filter(item => item.id !== id))
  }

  const todayItems = historyList.filter(i => i.dateGroup === "today")
  const sevenDaysItems = historyList.filter(i => i.dateGroup === "sevenDays")
  const thirtyDaysItems = historyList.filter(i => i.dateGroup === "thirtyDays")

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

      {/* Main Content: Chronological Chat History */}
      <SidebarContent className="px-2 scrollbar-thin">
        {/* Today */}
        {todayItems.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
              Today
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {todayItems.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={activeItemId === item.id && activeScreen === "workspace"}
                      className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg pr-7"
                    >
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      showOnHover
                      title="Delete chat session"
                    >
                      <Trash2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100 hover:text-red-400" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Previous 7 Days */}
        {sevenDaysItems.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
              Previous 7 Days
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sevenDaysItems.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={activeItemId === item.id && (item.screenTarget ? activeScreen === item.screenTarget : activeScreen === "workspace")}
                      className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg pr-7"
                    >
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      showOnHover
                      title="Delete chat session"
                    >
                      <Trash2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100 hover:text-red-400" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Previous 30 Days */}
        {thirtyDaysItems.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 px-2 py-1 tracking-wider uppercase">
              Previous 30 Days
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {thirtyDaysItems.map(item => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleItemClick(item)}
                      isActive={activeItemId === item.id && (item.screenTarget ? activeScreen === item.screenTarget : activeScreen === "workspace")}
                      className="group/item text-[0.88rem] py-1.5 h-8.5 rounded-lg pr-7"
                    >
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => handleDeleteItem(e, item.id)}
                      showOnHover
                      title="Delete chat session"
                    >
                      <Trash2 className="w-3.5 h-3.5 opacity-60 hover:opacity-100 hover:text-red-400" />
                    </SidebarMenuAction>
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
