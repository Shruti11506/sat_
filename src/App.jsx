import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Sun, Moon, ArrowLeft } from 'lucide-react';
import { ChitravitsEmblem } from './components/ui/ChitravitsLogo';
import { LandingHero } from './components/LandingHero';
import { Workspace } from './components/Workspace';
import { ImageViewer } from './components/ImageViewer';
import { ChangeDetection } from './components/ChangeDetection';
import { FusionViewer } from './components/FusionViewer';
import { AgentPipeline } from './components/AgentPipeline';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ReportScreen } from './components/ReportScreen';
import { ProfileDashboard } from './components/ProfileDashboard';
import { GradientBackground } from './components/ui/oceanic-shimmer';
import { SATELLITE_SCENARIOS } from './data/mockData';
import { SidebarProvider, SidebarTrigger, SidebarInset } from './components/ui/sidebar';
import { UserHistorySidebar } from './components/UserHistorySidebar';
import {
  getImagery,
  submitAnalysis,
  getAnalysisHistory,
  createConversation,
  getConversation,
  generateConversationTitle,
  getProfile
} from './lib/apiClient';

// Legacy pointer: chats created before conversations existed are keyed by imagery.
const LAST_IMAGERY_KEY = 'satquery-last-imagery-id';
// Pointer only (never data) to the open conversation, re-fetched on refresh.
const LAST_CONVERSATION_KEY = 'satquery-last-conversation-id';
// Set only while the profile screen is open, so a refresh reopens it.
const LAST_SCREEN_KEY = 'satquery-last-screen';

function readPointer(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function rememberPointer(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* refresh-persistence is a convenience, not required */ }
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatFileSize(bytes) {
  if (!bytes) return null;
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function attachmentFromImagery(imagery) {
  return {
    name: imagery.original_filename || imagery.name,
    size: formatFileSize(imagery.file_size),
    sensor: imagery.sensor || null,
    previewUrl: imagery.url,
    imageryId: imagery.id
  };
}

// A conversation with nothing uploaded or asked in yet (left by the old eager
// New Chat, or one whose first upload failed).
function isEmptyConversation(detail) {
  return !detail.imagery?.length && !detail.jobs?.length;
}

// Builds the Workspace "scenario" for a conversation from GET /conversations/{id}.
// Uploads render as attachment bubbles and queries as user message + queued
// acknowledgment, interleaved by their real created_at -- nothing is invented.
function buildConversationScenario(detail) {
  const events = [
    ...detail.imagery.map((imagery) => ({ kind: 'imagery', at: imagery.created_at, imagery })),
    ...detail.jobs.map((job) => ({ kind: 'job', at: job.created_at, job }))
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  const chatHistory = [];
  events.forEach((event) => {
    const ts = formatTime(event.at);
    if (event.kind === 'imagery') {
      chatHistory.push({
        id: `img-${event.imagery.id}`,
        sender: 'user',
        text: '',
        timestamp: ts,
        attachment: attachmentFromImagery(event.imagery)
      });
      return;
    }
    const { job } = event;
    const imagery = detail.imagery.find(i => i.id === job.imagery_id);
    chatHistory.push({ id: `usr-${job.id}`, sender: 'user', text: job.query, timestamp: ts });
    chatHistory.push({
      id: `ai-${job.id}`,
      sender: 'ai',
      text: 'Analysis request submitted.',
      status: job.status,
      jobId: job.id,
      timestamp: ts,
      evidenceThumb: imagery?.url || null
    });
  });

  const latestImagery = detail.imagery[detail.imagery.length - 1] || null;
  return {
    id: latestImagery?.id || null,
    conversationId: detail.id,
    title: latestImagery ? latestImagery.name : 'Untitled',
    sensor: latestImagery?.sensor || null,
    resolution: latestImagery ? formatFileSize(latestImagery.file_size) : null,
    opticalImg: latestImagery?.url || null,
    uploadedFile: latestImagery ? attachmentFromImagery(latestImagery) : null,
    chatHistory
  };
}

// Builds the scenario for a LEGACY chat (made before conversations existed):
// one imagery record plus its analysis_jobs. Every field traces back to a real
// record -- nothing is invented (see CLAUDE.md "no dummy data" scope).
function buildLegacyScenario(imagery, historyItemsForImage = []) {
  const chatHistory = [];
  // Oldest first, matching a natural chat reading order.
  [...historyItemsForImage].reverse().forEach((item) => {
    const ts = formatTime(item.created_at);
    chatHistory.push({
      id: `usr-${item.job_id}`,
      sender: 'user',
      text: item.query,
      timestamp: ts
    });
    chatHistory.push({
      id: `ai-${item.job_id}`,
      sender: 'ai',
      text: 'Analysis request submitted.',
      status: item.status,
      jobId: item.job_id,
      timestamp: ts,
      evidenceThumb: imagery.url
    });
  });

  return {
    id: imagery.id,
    conversationId: null,
    isLegacy: true,
    title: imagery.name,
    sensor: imagery.sensor || null,
    resolution: formatFileSize(imagery.file_size),
    opticalImg: imagery.url,
    uploadedFile: attachmentFromImagery(imagery),
    chatHistory
  };
}

export function App() {
  // Theme state: dark (default presentation theme) or light (accessibility theme)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('satquery-theme') || 'dark';
  });

  // Active Screen state: 'landing', or the profile screen if it was open before a refresh.
  const initialScreenRef = useRef(readPointer(LAST_SCREEN_KEY) === 'profile' ? 'profile' : 'landing');
  const [activeScreen, setActiveScreen] = useState(initialScreenRef.current);
  // Navigation history stack for step-by-step back navigation
  const [historyStack, setHistoryStack] = useState([]);

  const navigateToScreen = (screenId) => {
    if (screenId !== activeScreen) {
      setHistoryStack(prev => [...prev, activeScreen]);
      setActiveScreen(screenId);
    }
  };

  const handleGoBack = () => {
    if (historyStack.length > 0) {
      const prevScreen = historyStack[historyStack.length - 1];
      setHistoryStack(prev => prev.slice(0, -1));
      setActiveScreen(prevScreen);
    } else {
      setActiveScreen('landing');
    }
  };

  // Legacy mock scenario -- kept ONLY for the pre-existing Change/Fusion/Pipeline/
  // Analytics/Report screens, which are out of scope for the backend-persistence
  // milestone (no AI/raster analysis exists to drive them with real data yet).
  // The primary upload -> query -> history flow below never reads from this.
  const [currentScenario] = useState(SATELLITE_SCENARIOS[0]);

  // Real, backend-driven state for the Workspace screen. Built exclusively
  // from actual imagery/analysis_jobs records -- see buildWorkspaceScenario().
  const [workspaceScenario, setWorkspaceScenario] = useState(null);
  // Bumped whenever a new analysis request is submitted, so the sidebar
  // (which owns its own fetch) knows to refetch GET /api/v1/analysis/history.
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const bumpHistory = useCallback(() => setHistoryRefreshToken(t => t + 1), []);

  // The open conversation ({ id, title, title_source }), or null for a new,
  // unsaved chat. New Chat never writes to the backend: the record is created
  // lazily by the first upload, just before the file is stored (see
  // ensureConversation). If that upload then fails, the empty row is hidden
  // by GET /conversations and purgeable (backend/scripts/purge_empty_conversations.py).
  // It's titled "New Chat" until the first
  // meaningful query -- an uploaded filename never becomes its title.
  const [activeConversation, setActiveConversation] = useState(null);
  const activeConversationRef = useRef(null);
  const pendingConversationRef = useRef(null);
  // An EMPTY conversation that was reopened (one left behind by the old
  // eager New Chat, restored on refresh) and the ids an upload has since been
  // started into. It's "fresh" -- reusable by the landing upload instead of
  // creating another record -- only while it's in the first and not the
  // second. A Set rather than a flag, so the check doesn't depend on which
  // awaiting caller resumes first.
  const freshConversationIdRef = useRef(null);
  const usedConversationIdsRef = useRef(new Set());
  // Bumped by New Chat to remount LandingHero, clearing its typed query and
  // selected file even when the landing screen is already showing.
  const [landingKey, setLandingKey] = useState(0);

  const openConversation = useCallback((conversation) => {
    const value = conversation
      ? { id: conversation.id, title: conversation.title, title_source: conversation.title_source }
      : null;
    activeConversationRef.current = value;
    pendingConversationRef.current = null;
    setActiveConversation(value);
    rememberPointer(LAST_CONVERSATION_KEY, value?.id);
  }, []);

  // Returns the open conversation's id, creating it on first use (the first
  // upload). Concurrent callers share one in-flight request so a chat never
  // gets two records. The sidebar isn't refreshed here but once the upload
  // lands (onImageryUploaded), so it never shows a conversation with nothing in it.
  const ensureConversation = useCallback(async () => {
    if (activeConversationRef.current) return activeConversationRef.current.id;
    if (!pendingConversationRef.current) {
      const pending = createConversation().then((conversation) => {
        // Not opened if New Chat was clicked meanwhile -- the upload still
        // goes into it, but the user has moved on to a new chat.
        if (pendingConversationRef.current === pending) openConversation(conversation);
        return conversation.id;
      });
      pending.catch(() => {
        if (pendingConversationRef.current === pending) pendingConversationRef.current = null;
      });
      pendingConversationRef.current = pending;
    }
    return pendingConversationRef.current;
  }, [openConversation]);

  const isFreshConversation = useCallback((conversation) =>
    Boolean(conversation)
    && conversation.id === freshConversationIdRef.current
    && !usedConversationIdsRef.current.has(conversation.id), []);

  const markConversationUsed = useCallback((conversationId) => {
    if (conversationId) usedConversationIdsRef.current.add(conversationId);
    return conversationId;
  }, []);

  // Landing-screen upload: the point where a new chat is first persisted.
  // Reuses a creation already in flight, or a reopened empty conversation;
  // otherwise -- after New Chat, or landing reached via Back from a chat --
  // it creates a NEW conversation.
  const startConversation = useCallback(async () => {
    if (pendingConversationRef.current) {
      return markConversationUsed(await pendingConversationRef.current);
    }
    if (isFreshConversation(activeConversationRef.current)) {
      return markConversationUsed(activeConversationRef.current.id);
    }
    openConversation(null);
    return markConversationUsed(await ensureConversation());
  }, [openConversation, ensureConversation, isFreshConversation, markConversationUsed]);

  // Mid-chat upload with no conversation yet (Workspace).
  const ensureConversationForUpload = useCallback(
    async () => markConversationUsed(await ensureConversation()),
    [ensureConversation, markConversationUsed]
  );

  // Called after every successfully submitted query. The title is generated
  // in the background (never blocks the chat) and only while the chat is
  // still "New Chat": the backend titles from the FIRST meaningful stored
  // query and ignores later calls, so follow-ups and renames never overwrite it.
  const handleQuerySubmitted = useCallback((conversationId) => {
    bumpHistory();
    if (!conversationId) return;
    const current = activeConversationRef.current;
    if (current?.id === conversationId && current.title_source !== 'default') return;
    generateConversationTitle(conversationId)
      .then((conversation) => {
        if (activeConversationRef.current?.id === conversation.id) {
          openConversation(conversation);
        }
        if (conversation.title_source !== 'default') bumpHistory();
      })
      .catch((err) => console.error('[SatQuery] Could not generate conversation title:', err));
  }, [bumpHistory, openConversation]);

  // The single workspace profile (GET /profile) shown in the sidebar footer.
  // null until loaded, or if the backend can't provide it -- never a made-up user.
  const [profileUser, setProfileUser] = useState(null);

  useEffect(() => {
    getProfile()
      .then(({ user }) => setProfileUser(user))
      .catch((err) => console.error('[SatQuery] Could not load profile:', err));
  }, []);

  useEffect(() => {
    rememberPointer(LAST_SCREEN_KEY, activeScreen === 'profile' ? 'profile' : null);
  }, [activeScreen]);

  // Sync theme with HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('satquery-theme', theme);
  }, [theme]);

  // Page-refresh persistence: the backend database is the source of truth,
  // not localStorage -- this only remembers WHICH imagery to re-fetch, then
  // always re-fetches it (and its history) fresh from the API.
  useEffect(() => {
    // A refresh on the profile screen stays there; the restored chat is one Back away.
    const showRestoredWorkspace = () => {
      if (initialScreenRef.current === 'profile') setHistoryStack(['workspace']);
      else setActiveScreen('workspace');
    };
    let lastConversationId;
    let lastImageryId;
    try {
      lastConversationId = localStorage.getItem(LAST_CONVERSATION_KEY);
      lastImageryId = localStorage.getItem(LAST_IMAGERY_KEY);
    } catch {
      return;
    }

    if (lastConversationId) {
      (async () => {
        try {
          const detail = await getConversation(lastConversationId);
          openConversation(detail);
          if (isEmptyConversation(detail)) {
            // An empty conversation: stay on the upload screen, and let the
            // next upload go into this conversation instead of a new one.
            freshConversationIdRef.current = detail.id;
            return;
          }
          setWorkspaceScenario(buildConversationScenario(detail));
          showRestoredWorkspace();
        } catch (err) {
          console.error('[SatQuery] Could not restore last conversation:', err);
          rememberPointer(LAST_CONVERSATION_KEY, null);
        }
      })();
      return;
    }
    if (!lastImageryId) return;

    (async () => {
      try {
        const [imagery, history] = await Promise.all([
          getImagery(lastImageryId),
          getAnalysisHistory(200).catch(() => [])
        ]);
        const itemsForImage = history.filter(h => h.imagery_id === lastImageryId);
        setWorkspaceScenario(buildLegacyScenario(imagery, itemsForImage));
        showRestoredWorkspace();
      } catch (err) {
        // Imagery no longer exists (deleted) or backend unreachable -- clear
        // the stale pointer and fall back to the empty landing state, never
        // to fake data.
        console.error('[SatQuery] Could not restore last session:', err);
        try { localStorage.removeItem(LAST_IMAGERY_KEY); } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount only
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('satquery-theme', nextTheme);
    setTheme(nextTheme);
  };

  // Real upload -> real (optional) query flow. No AI response is ever
  // fabricated: on success the UI shows a neutral "queued" acknowledgment;
  // on any failure it shows the actual error. An upload with no typed query
  // submits nothing -- the chat stays "New Chat" until the user asks.
  const handleStartAnalysis = async (queryPrompt, imageAttachment) => {
    const promptText = queryPrompt?.trim() || '';
    const imageryId = imageAttachment?.imageryId;
    const conversationId = imageAttachment?.conversationId || null;
    const nowTs = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: nowTs(),
      attachment: imageAttachment || null
    };

    if (!imageryId) {
      // Either no image was ever attached, or its upload to the backend
      // failed -- either way there is no real imagery_id to submit against.
      setWorkspaceScenario({
        id: null,
        conversationId: null,
        title: imageAttachment?.name || 'Untitled',
        sensor: null,
        resolution: null,
        opticalImg: imageAttachment?.previewUrl || null,
        uploadedFile: imageAttachment || null,
        chatHistory: [
          userMsg,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: imageAttachment
              ? 'This image could not be uploaded to the backend, so no analysis request could be submitted. Please try attaching it again.'
              : 'Please attach a satellite image before submitting a query -- an analysis request must reference an uploaded image.',
            isError: true,
            timestamp: nowTs()
          }
        ]
      });
      navigateToScreen('workspace');
      return;
    }

    rememberPointer(LAST_IMAGERY_KEY, null);

    const chatHistory = [userMsg];

    if (promptText) {
      try {
        const job = await submitAnalysis(imageryId, 'general_analysis', promptText, conversationId);
        chatHistory.push({
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: 'Analysis request submitted.',
          status: job.status,
          jobId: job.job_id,
          timestamp: nowTs(),
          evidenceThumb: imageAttachment.previewUrl
        });
        handleQuerySubmitted(conversationId);
      } catch (err) {
        chatHistory.push({
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `Failed to submit analysis request: ${err.message || 'unknown error'}`,
          isError: true,
          timestamp: nowTs()
        });
      }
    }

    setWorkspaceScenario({
      id: imageryId,
      conversationId,
      title: imageAttachment.name,
      sensor: null,
      resolution: imageAttachment.size || null,
      opticalImg: imageAttachment.previewUrl,
      uploadedFile: imageAttachment,
      chatHistory
    });
    navigateToScreen('workspace');
  };

  // New Chat only resets frontend state -- it never writes to the backend.
  // The conversation record is created by the first upload (startConversation
  // / ensureConversation), so clicking it any number of times persists nothing.
  const handleNewChat = () => {
    openConversation(null); // also drops any creation still in flight
    freshConversationIdRef.current = null;
    rememberPointer(LAST_IMAGERY_KEY, null);
    setWorkspaceScenario(null);
    setLandingKey(k => k + 1);
    setHistoryStack([]);
    setActiveScreen('landing');
  };

  // Sidebar conversation -> reload its real uploads + queries from the backend.
  const handleSelectConversation = async (conversation) => {
    try {
      const detail = await getConversation(conversation.id);
      openConversation(detail);
      rememberPointer(LAST_IMAGERY_KEY, null);
      if (isEmptyConversation(detail)) {
        // Nothing to show yet: open the upload screen for this conversation.
        freshConversationIdRef.current = detail.id;
        usedConversationIdsRef.current.delete(detail.id);
        navigateToScreen('landing');
        return;
      }
      setWorkspaceScenario(buildConversationScenario(detail));
      navigateToScreen('workspace');
    } catch (err) {
      console.error('[SatQuery] Could not load conversation:', err);
    }
  };

  const handleConversationRenamed = (conversation) => {
    if (activeConversationRef.current?.id === conversation.id) openConversation(conversation);
  };

  const handleConversationDeleted = (conversationId) => {
    if (activeConversationRef.current?.id === conversationId) {
      openConversation(null);
      setWorkspaceScenario(null);
      setHistoryStack([]);
      setActiveScreen('landing');
    }
  };

  // Legacy sidebar item (pre-conversation history) -> reload the real imagery
  // + its real query/ack messages from the backend. Never fabricates a chat.
  const handleSelectHistoryItem = async (historyItem) => {
    try {
      const [imagery, history] = await Promise.all([
        getImagery(historyItem.imagery_id),
        getAnalysisHistory(200)
      ]);
      const itemsForImage = history.filter(h => h.imagery_id === historyItem.imagery_id);
      openConversation(null);
      setWorkspaceScenario(buildLegacyScenario(imagery, itemsForImage));
      rememberPointer(LAST_IMAGERY_KEY, historyItem.imagery_id);
      navigateToScreen('workspace');
    } catch (err) {
      console.error('[SatQuery] Could not load history item:', err);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      {/* ChatGPT-Style User History Sidebar */}
      <UserHistorySidebar
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onSelectHistoryItem={handleSelectHistoryItem}
        onConversationRenamed={handleConversationRenamed}
        onConversationDeleted={handleConversationDeleted}
        onNavigateScreen={navigateToScreen}
        activeScreen={activeScreen}
        activeConversationId={activeConversation?.id || null}
        activeImageryId={workspaceScenario?.isLegacy ? workspaceScenario.id : null}
        refreshToken={historyRefreshToken}
        profileUser={profileUser}
        onOpenProfile={() => navigateToScreen('profile')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <SidebarInset className="flex-1 flex flex-col min-w-0 min-h-screen relative overflow-x-hidden bg-transparent">
          {/* Dynamic Ambient Background: Synchronized 60fps hardware-accelerated cross-fade */}
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
            <div 
              style={{ 
                position: 'absolute', 
                inset: 0, 
                opacity: theme === 'light' ? 1 : 0, 
                transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'opacity'
              }}
            >
              <GradientBackground variant="light-white" className="w-full h-full" />
            </div>
            <div 
              style={{ 
                position: 'absolute', 
                inset: 0, 
                opacity: theme === 'dark' ? 1 : 0, 
                transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'opacity'
              }}
            >
              <GradientBackground variant="dark-blue" className="w-full h-full" />
            </div>
          </div>

          {/* Minimalist Header: SatQuery AI Logo + Sidebar Trigger + Back Option + New Analysis + Theme Toggle */}
          <header className="minimal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SidebarTrigger className="hover:bg-sidebar-accent rounded-lg p-1.5 transition-colors cursor-pointer" title="Toggle History Sidebar" />
              <div 
                className="brand-section" 
                onClick={handleNewChat}
                title="SatQuery AI"
                style={{ cursor: 'pointer' }}
              >
                <div className="brand-logo-badge">
                  <ChitravitsEmblem size={44} />
                </div>
                <span className="brand-title">
                  Sat<span className="brand-title-accent">Query</span> <span className="brand-title-ai">AI</span>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeScreen !== 'landing' && (
                <>
                  <button 
                    className="btn btn-secondary btn-back-nav"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={handleGoBack}
                    title="Go back to previous screen"
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={handleNewChat}
                    title="Upload another satellite scene"
                  >
                    <Plus size={14} />
                    <span>New Analysis</span>
                  </button>
                </>
              )}

              <button 
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light Theme' : 'Dark Theme'}`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </header>

          {/* Screen Routing with Step-by-Step Back Option */}
          <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            {activeScreen === 'landing' && (
              <LandingHero
                key={landingKey}
                onStartAnalysis={handleStartAnalysis}
                onStartConversation={startConversation}
                onImageryUploaded={bumpHistory}
              />
            )}

            {activeScreen === 'workspace' && workspaceScenario && (
              <Workspace
                scenario={workspaceScenario}
                onNavigateScreen={navigateToScreen}
                onGoBack={handleGoBack}
                onEnsureConversation={ensureConversationForUpload}
                onAnalysisSubmitted={handleQuerySubmitted}
                onImageryUploaded={bumpHistory}
              />
            )}

            {activeScreen === 'profile' && (
              <ProfileDashboard onProfileUpdated={setProfileUser} />
            )}

            {activeScreen === 'viewer' && (
              <div style={{ height: 'calc(100vh - 75px)', padding: 'var(--space-6)' }}>
                <ImageViewer 
                  imageUrl={currentScenario.opticalImg} 
                  scenario={currentScenario}
                  onGoBack={handleGoBack}
                />
              </div>
            )}

            {activeScreen === 'change' && (
              <ChangeDetection scenario={currentScenario} onGoBack={handleGoBack} />
            )}

            {activeScreen === 'fusion' && (
              <FusionViewer scenario={currentScenario} onGoBack={handleGoBack} />
            )}

            {activeScreen === 'pipeline' && (
              <AgentPipeline scenario={currentScenario} onGoBack={handleGoBack} />
            )}

            {activeScreen === 'analytics' && (
              <AnalyticsDashboard scenario={currentScenario} onGoBack={handleGoBack} />
            )}

            {activeScreen === 'report' && (
              <ReportScreen scenario={currentScenario} onGoBack={handleGoBack} />
            )}
          </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
