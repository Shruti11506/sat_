import React, { useState, useEffect } from 'react';
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
import { GradientBackground } from './components/ui/oceanic-shimmer';
import { SATELLITE_SCENARIOS } from './data/mockData';
import { SidebarProvider, SidebarTrigger, SidebarInset } from './components/ui/sidebar';
import { UserHistorySidebar } from './components/UserHistorySidebar';
import { getImagery, submitAnalysis, getAnalysisHistory } from './lib/apiClient';

const LAST_IMAGERY_KEY = 'satquery-last-imagery-id';

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

// Builds the real, backend-driven "scenario" object Workspace/ImageViewer render.
// Every field here traces back to an actual imagery/analysis_jobs record --
// nothing is invented (see CLAUDE.md / backend README "no dummy data" scope).
function buildWorkspaceScenario(imagery, historyItemsForImage = []) {
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
    title: imagery.name,
    sensor: imagery.sensor || null,
    resolution: formatFileSize(imagery.file_size),
    opticalImg: imagery.url,
    uploadedFile: {
      name: imagery.original_filename || imagery.name,
      size: formatFileSize(imagery.file_size),
      sensor: imagery.sensor || null,
      previewUrl: imagery.url,
      imageryId: imagery.id
    },
    chatHistory
  };
}

export function App() {
  // Theme state: dark (default presentation theme) or light (accessibility theme)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('satquery-theme') || 'dark';
  });

  // Active Screen state: default to 'landing'
  const [activeScreen, setActiveScreen] = useState('landing');
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

  // Sync theme with HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('satquery-theme', theme);
  }, [theme]);

  // Page-refresh persistence: the backend database is the source of truth,
  // not localStorage -- this only remembers WHICH imagery to re-fetch, then
  // always re-fetches it (and its history) fresh from the API.
  useEffect(() => {
    let lastImageryId;
    try {
      lastImageryId = localStorage.getItem(LAST_IMAGERY_KEY);
    } catch {
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
        setWorkspaceScenario(buildWorkspaceScenario(imagery, itemsForImage));
        setActiveScreen('workspace');
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
  // on any failure it shows the actual error.
  const handleStartAnalysis = async (queryPrompt, imageAttachment) => {
    const promptText = queryPrompt?.trim() || '';
    const imageryId = imageAttachment?.imageryId;
    const nowTs = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: promptText || (imageAttachment ? `Analyze attached satellite scene: ${imageAttachment.name}` : ''),
      timestamp: nowTs(),
      attachment: imageAttachment || null
    };

    if (!imageryId) {
      // Either no image was ever attached, or its upload to the backend
      // failed -- either way there is no real imagery_id to submit against.
      setWorkspaceScenario({
        id: null,
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

    try {
      localStorage.setItem(LAST_IMAGERY_KEY, imageryId);
    } catch { /* refresh-persistence is a convenience, not required */ }

    const chatHistory = [userMsg];

    if (promptText) {
      try {
        const job = await submitAnalysis(imageryId, 'general_analysis', promptText);
        chatHistory.push({
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: 'Analysis request submitted.',
          status: job.status,
          jobId: job.job_id,
          timestamp: nowTs(),
          evidenceThumb: imageAttachment.previewUrl
        });
        setHistoryRefreshToken(t => t + 1);
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
      title: imageAttachment.name,
      sensor: null,
      resolution: imageAttachment.size || null,
      opticalImg: imageAttachment.previewUrl,
      uploadedFile: imageAttachment,
      chatHistory
    });
    navigateToScreen('workspace');
  };

  // Sidebar history item -> reload the real imagery + its real query/ack
  // messages from the backend. Never fabricates a conversation.
  const handleSelectHistoryItem = async (historyItem) => {
    try {
      const [imagery, history] = await Promise.all([
        getImagery(historyItem.imagery_id),
        getAnalysisHistory(200)
      ]);
      const itemsForImage = history.filter(h => h.imagery_id === historyItem.imagery_id);
      setWorkspaceScenario(buildWorkspaceScenario(imagery, itemsForImage));
      try {
        localStorage.setItem(LAST_IMAGERY_KEY, historyItem.imagery_id);
      } catch { /* ignore */ }
      navigateToScreen('workspace');
    } catch (err) {
      console.error('[SatQuery] Could not load history item:', err);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      {/* ChatGPT-Style User History Sidebar */}
      <UserHistorySidebar
        onNewChat={() => navigateToScreen('landing')}
        onSelectHistoryItem={handleSelectHistoryItem}
        onNavigateScreen={navigateToScreen}
        activeScreen={activeScreen}
        activeImageryId={workspaceScenario?.id}
        refreshToken={historyRefreshToken}
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
                onClick={() => navigateToScreen('landing')}
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
                    onClick={() => navigateToScreen('landing')}
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
                onStartAnalysis={handleStartAnalysis}
              />
            )}

            {activeScreen === 'workspace' && workspaceScenario && (
              <Workspace
                scenario={workspaceScenario}
                onNavigateScreen={navigateToScreen}
                onGoBack={handleGoBack}
                onAnalysisSubmitted={() => setHistoryRefreshToken(t => t + 1)}
              />
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
