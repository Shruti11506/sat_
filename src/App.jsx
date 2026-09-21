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

  // Active satellite scenario
  const [currentScenario, setCurrentScenario] = useState(SATELLITE_SCENARIOS[0]);

  // Sync theme with HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('satquery-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('satquery-theme', nextTheme);
    setTheme(nextTheme);
  };

  const handleStartAnalysis = (queryPrompt, imageAttachment) => {
    const promptText = queryPrompt?.trim() || 'Analyze this satellite scene and extract critical land-cover structures';
    const lowerPrompt = promptText.toLowerCase();

    // Natural Language Query Redirection (e.g. "give me the report", "compare these both")
    if (lowerPrompt.includes('report')) {
      navigateToScreen('report');
      return;
    }
    if (lowerPrompt.includes('compare') || lowerPrompt.includes('comparison') || lowerPrompt.includes('both')) {
      navigateToScreen('change');
      return;
    }
    
    // Construct user message with the attached image (ChatGPT / Gemini style)
    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: imageAttachment || {
        name: 'Cartosat3_Multispectral_Scene.tif',
        size: '142.8 MB',
        sensor: 'Cartosat-3 High-Res (0.28m GSD)',
        previewUrl: currentScenario.opticalImg,
        crs: 'EPSG:4326 (WGS84)'
      }
    };

    // AI response grounded on this image
    const aiResponse = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: `Multimodal Remote Sensing Analysis completed for **${userMsg.attachment.name}**.\n\n• **Sensor Calibration**: Verified ${userMsg.attachment.sensor} with 4-band reflectance.\n• **Water Body Extraction**: Identified primary reservoir with NDWI clarity index of **+0.54**.\n• **Vegetation & Canopy**: Healthy NDVI buffer confirmed (**+0.68**).\n• **Structure Detection**: 142 permanent buildings verified via SAR double-bounce radar backscatter.\n\nWhat specific spatial feature or zone would you like to inspect next?`,
      confidence: 96.4,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      evidenceThumb: userMsg.attachment.previewUrl || currentScenario.opticalImg,
      taskType: 'Vision-Language Feature Extraction',
      modelChain: 'ISRO-GeoVision-LLaVA v3.2 + Prithvi-EO 100M',
      executionSteps: currentScenario.chatHistory[1]?.executionSteps || []
    };

    setCurrentScenario(prev => ({
      ...prev,
      opticalImg: userMsg.attachment.previewUrl || prev.opticalImg,
      uploadedFile: userMsg.attachment,
      chatHistory: [userMsg, aiResponse]
    }));

    navigateToScreen('workspace');
  };

  const handleLoadDemo = () => {
    setCurrentScenario(SATELLITE_SCENARIOS[0]);
    navigateToScreen('workspace');
  };

  return (
    <SidebarProvider defaultOpen={true}>
      {/* ChatGPT-Style User History Sidebar */}
      <UserHistorySidebar 
        onNewChat={() => navigateToScreen('landing')}
        onSelectScenario={(scenarioId) => {
          const found = SATELLITE_SCENARIOS.find(s => s.id === scenarioId) || SATELLITE_SCENARIOS[0];
          setCurrentScenario(found);
          navigateToScreen('workspace');
        }}
        onNavigateScreen={navigateToScreen}
        activeScreen={activeScreen}
        currentScenarioId={currentScenario.id}
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
                onLoadDemo={handleLoadDemo}
                currentScenario={currentScenario}
              />
            )}

            {activeScreen === 'workspace' && (
              <Workspace 
                scenario={currentScenario}
                onNavigateScreen={navigateToScreen}
                onGoBack={handleGoBack}
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
