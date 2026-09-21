import React, { useState } from 'react';
import { 
  Layers, Crosshair, ZoomIn, ZoomOut, RotateCcw, 
  Info, Eye, Sparkles, ShieldCheck, Activity, ArrowLeft 
} from 'lucide-react';

export function FusionViewer({ scenario, onGoBack }) {
  const [zoom, setZoom] = useState(1);
  const [crosshairPos, setCrosshairPos] = useState({ x: 50, y: 50, active: false });
  const [highlightClass, setHighlightClass] = useState(null); // 'water', 'urban', 'veg'

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCrosshairPos({ x, y, active: true });
  };

  const handleMouseLeave = () => {
    setCrosshairPos(prev => ({ ...prev, active: false }));
  };

  const panels = [
    {
      id: 'optical',
      title: 'Optical RGB (Cartosat-3 / Sentinel-2)',
      sensorTag: '0.28m High-Res Multispectral',
      badgeClass: 'badge-optical',
      desc: 'True color reflection. Sensitive to cloud obstruction and shadow effects.',
      img: scenario.opticalImg || '/assets/optical_satellite.jpg'
    },
    {
      id: 'sar',
      title: 'SAR Radar (RISAT-1A / Sentinel-1)',
      sensorTag: 'C-Band 5.4 GHz Polarimetric',
      badgeClass: 'badge-sar',
      desc: 'All-weather radar backscatter. Black calm water, bright urban double-bounce.',
      img: scenario.sarImg || '/assets/sar_radar.jpg'
    },
    {
      id: 'fusion',
      title: 'AI Multimodal Fusion Output',
      sensorTag: 'ISRO-GeoVision Neural Blend',
      badgeClass: 'badge-high',
      desc: 'Deep learning fusion of optical spectral bands with radar penetration layers.',
      img: scenario.fusionImg || '/assets/fusion_output.jpg'
    }
  ];

  return (
    <div className="fusion-screen-layout">
      {/* Screen Title & Linked Zoom Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {onGoBack && (
            <button 
              className="btn btn-secondary btn-back-nav"
              onClick={onGoBack}
              title="Back to Chat Interface"
              style={{ marginTop: 4, padding: '8px 14px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={15} />
              <span>Back to Chat</span>
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-geotiff">Multimodal Fusion</span>
              <span className="badge badge-high">Synchronized Viewports</span>
            </div>
            <h2 style={{ fontSize: '1.8rem', marginTop: 6 }}>
              Optical + SAR Radar Fusion Engine
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Hover your cursor across any panel to see synchronized crosshairs and radar backscatter correlation in real-time.
            </p>
          </div>
        </div>

        {/* Global Linked Zoom Controls */}
        <div className="hud-controls-group" style={{ padding: '6px 10px' }}>
          <button className="hud-btn" onClick={() => setZoom(prev => Math.max(0.8, prev - 0.2))} title="Zoom Out All Panels">
            <ZoomOut size={16} />
          </button>
          <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', padding: '0 8px' }}>
            Sync Zoom: {Math.round(zoom * 100)}%
          </span>
          <button className="hud-btn" onClick={() => setZoom(prev => Math.min(3, prev + 0.2))} title="Zoom In All Panels">
            <ZoomIn size={16} />
          </button>
          <button className="hud-btn" onClick={() => setZoom(1)} title="Reset Zoom">
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* 3 Synchronized Panels Grid */}
      <div className="fusion-panels-grid">
        {panels.map((p) => (
          <div key={p.id} className="fusion-panel-card">
            {/* Header with Sensor Tag */}
            <div className="fusion-panel-header">
              <span className={`badge ${p.badgeClass}`} style={{ boxShadow: 'var(--shadow-md)' }}>
                {p.title}
              </span>
              <span className="hud-pill" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                {p.sensorTag}
              </span>
            </div>

            {/* Viewport with Synchronized Mouse Handler and Linked Zoom */}
            <div 
              className="fusion-viewport"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div 
                style={{
                  width: '100%',
                  height: '100%',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.1s ease-out'
                }}
              >
                <img 
                  src={p.img} 
                  alt={p.title} 
                  className="fusion-viewport-img"
                  style={{
                    filter: highlightClass === 'water' && p.id === 'fusion'
                      ? 'contrast(1.6) brightness(1.2)' 
                      : highlightClass === 'urban' && p.id === 'fusion'
                      ? 'hue-rotate(45deg) saturate(1.8)'
                      : 'none'
                  }}
                />

                {/* Synchronized Crosshair Marker */}
                {crosshairPos.active && (
                  <div 
                    className="sync-crosshair"
                    style={{
                      left: `${crosshairPos.x}%`,
                      top: `${crosshairPos.y}%`
                    }}
                  >
                    <div className="crosshair-h" />
                    <div className="crosshair-v" />
                  </div>
                )}
              </div>
            </div>

            {/* Panel Caption */}
            <div style={{
              padding: '8px 12px',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Class Legend & Interactive Highlighting Bar */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Multimodal Class Legend (Click to highlight):</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            className={`query-chip ${highlightClass === 'water' ? 'active' : ''}`}
            onClick={() => setHighlightClass(highlightClass === 'water' ? null : 'water')}
            style={{ borderColor: '#38bdf8', color: highlightClass === 'water' ? '#fff' : '#38bdf8', background: highlightClass === 'water' ? '#38bdf8' : 'transparent' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
            Water Bodies (SAR Specular Black)
          </button>

          <button 
            className={`query-chip ${highlightClass === 'urban' ? 'active' : ''}`}
            onClick={() => setHighlightClass(highlightClass === 'urban' ? null : 'urban')}
            style={{ borderColor: '#f59e0b', color: highlightClass === 'urban' ? '#fff' : '#f59e0b', background: highlightClass === 'urban' ? '#f59e0b' : 'transparent' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            Built-up Structures (Double-Bounce)
          </button>

          <button 
            className={`query-chip ${highlightClass === 'veg' ? 'active' : ''}`}
            onClick={() => setHighlightClass(highlightClass === 'veg' ? null : 'veg')}
            style={{ borderColor: '#22c55e', color: highlightClass === 'veg' ? '#fff' : '#22c55e', background: highlightClass === 'veg' ? '#22c55e' : 'transparent' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            Dense Canopy (Optical NDVI +0.68)
          </button>
        </div>
      </div>
    </div>
  );
}
