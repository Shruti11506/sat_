import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sun, Moon, Home, Layers, Eye, GitCompare, Sparkles, 
  BarChart3, FileText
} from 'lucide-react';
import { ChitravitsEmblem } from './ui/ChitravitsLogo';

export const SCREENS = [
  { id: 'landing', label: 'Home', icon: Home },
  { id: 'workspace', label: 'AI Workspace', icon: Sparkles },
  { id: 'viewer', label: 'Image Viewer', icon: Eye },
  { id: 'change', label: 'Change Detection', icon: GitCompare },
  { id: 'fusion', label: 'Optical + SAR Fusion', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'report', label: 'Report', icon: FileText }
];

export function Navbar({ activeScreen, setActiveScreen, theme, toggleTheme }) {
  const [cursorPos, setCursorPos] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const tabRefs = useRef({});

  // Function to align cursor with active tab
  const syncToActive = () => {
    const activeEl = tabRefs.current[activeScreen];
    if (activeEl) {
      setCursorPos({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        opacity: 1,
      });
    }
  };

  useEffect(() => {
    // Small delay to allow CSS layout / font loading
    const timer = setTimeout(syncToActive, 40);
    window.addEventListener('resize', syncToActive);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', syncToActive);
    };
  }, [activeScreen]);

  return (
    <header className="app-navbar">
      {/* Brand Logo & Title: Unchanged Logo Badge with SatQuery Name */}
      <div 
        className="brand-section" 
        onClick={() => setActiveScreen('landing')}
        title="SatQuery AI"
      >
        <div className="brand-logo-badge">
          <ChitravitsEmblem size={44} />
        </div>
        <span className="brand-title">
          Sat<span className="brand-title-accent">Query</span> <span className="brand-title-ai">AI</span>
        </span>
      </div>

      {/* Screen Navigation Tabs with Persistent Active Pill and Darker White Hover */}
      <nav className="nav-tabs-pill-container" aria-label="Application screens">
        <ul className="nav-tabs-pill">
          {SCREENS.map((screen) => {
            const Icon = screen.icon;
            const isActive = activeScreen === screen.id;

            return (
              <li
                key={screen.id}
                ref={(el) => (tabRefs.current[screen.id] = el)}
                onClick={() => setActiveScreen(screen.id)}
                className={`nav-tab-pill-item ${isActive ? 'active' : ''}`}
                title={screen.label}
              >
                <Icon size={13} style={{ color: 'inherit', flexShrink: 0 }} />
                <span style={{ color: 'inherit' }}>{screen.label}</span>
              </li>
            );
          })}

          {/* Framer Motion Sliding Pill Cursor — Stays locked to Active Screen */}
          <motion.li
            className="nav-pill-cursor"
            animate={{
              left: cursorPos.left,
              width: cursorPos.width,
              opacity: cursorPos.opacity,
            }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 30,
            }}
          />
        </ul>
      </nav>

      {/* Right Side Actions: Theme Toggle Button */}
      <div className="nav-actions">
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
  );
}
