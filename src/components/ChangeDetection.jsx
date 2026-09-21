import React, { useState, useRef } from 'react';
import { 
  GitCompare, Calendar, TrendingUp, TrendingDown, 
  Layers, AlertTriangle, CheckCircle2, Download, RefreshCw, ArrowLeft 
} from 'lucide-react';

export function ChangeDetection({ scenario, onGoBack }) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [selectedEpoch, setSelectedEpoch] = useState('2021-2026');

  const containerRef = useRef(null);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPos = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (xPos / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e) => {
    if (!containerRef.current || !e.touches[0]) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPos = e.touches[0].clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (xPos / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const metrics = scenario.changeMetrics || {
    builtUpChange: '+14.2%',
    vegetationChange: '-8.6%',
    waterExpansion: '+3.1%',
    timeRange: '2021 — 2026 (5-Year Bi-temporal Delta)',
    summary: 'High-density urban development observed encroaching the northwestern buffer zone.'
  };

  return (
    <div className="change-detection-view">
      {/* Header & Controls Bar */}
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
              <span className="badge badge-optical">Bi-Temporal Delta</span>
              <span className="badge badge-high">Sensor: Cartosat-2/3 & Sentinel-2</span>
            </div>
            <h2 style={{ fontSize: '1.8rem', marginTop: 6 }}>
              Bi-Temporal Remote Sensing Change Analysis
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Compare baseline pre-development imagery with latest satellite acquisition. Drag slider to inspect ground delta.
            </p>
          </div>
        </div>

        {/* Timeline Selector & Heatmap Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className={`btn ${showHeatmap ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowHeatmap(!showHeatmap)}
          >
            <Layers size={16} />
            <span>{showHeatmap ? 'Hide Heatmap Delta' : 'Show Change Heatmap'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            <Calendar size={15} style={{ color: 'var(--accent)' }} />
            <select 
              value={selectedEpoch} 
              onChange={(e) => setSelectedEpoch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="2021-2026" style={{ background: 'var(--bg-card)' }}>Epoch 2021 (T1) vs 2026 (T2)</option>
              <option value="2023-2026" style={{ background: 'var(--bg-card)' }}>Epoch 2023 (T1) vs 2026 (T2)</option>
              <option value="2018-2026" style={{ background: 'var(--bg-card)' }}>Epoch 2018 (T1) vs 2026 (T2)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Split Comparison Slider */}
      <div 
        className="change-split-slider-container"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchMove={handleTouchMove}
      >
        {/* Layer 1: After Image (Full width background) */}
        <img 
          src={scenario.afterImg || '/assets/temporal_after_2026.jpg'} 
          alt="After 2026 Satellite Scene" 
          className="slider-img-layer"
        />

        {/* Heatmap Overlay (Rendered over the after scene) */}
        {showHeatmap && (
          <svg
            viewBox="0 0 1000 1000"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            {/* New Industrial Expansion in Northwest (Amber/Red) */}
            <rect
              x="50" y="40" width="340" height="280"
              rx="16"
              fill="rgba(239, 68, 68, 0.45)"
              stroke="#ef4444"
              strokeWidth="3"
            />
            {/* New Southwest Residential Urban Encroachments (Amber) */}
            <path
              d="M 40,460 C 120,440 240,480 260,680 C 240,750 80,780 40,750 Z"
              fill="rgba(245, 158, 11, 0.45)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            {/* Lake Shoreline Alteration / Wetland Loss (Cyan/Azure) */}
            <path
              d="M 480,620 C 540,640 600,720 540,780 C 480,740 460,680 480,620 Z"
              fill="rgba(56, 189, 248, 0.5)"
              stroke="#38bdf8"
              strokeWidth="2"
            />
          </svg>
        )}

        {/* Layer 2: Before Image (Clipped by slider position) */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            width: `${sliderPosition}%`,
            overflow: 'hidden',
            borderRight: '2px solid var(--accent)',
            zIndex: 10
          }}
        >
          <img 
            src={scenario.beforeImg || '/assets/temporal_before_2021.jpg'} 
            alt="Before 2021 Satellite Scene" 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: containerRef.current ? containerRef.current.clientWidth : '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />

          {/* Label Badge on Left (Before) */}
          <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 12 }}>
            <span className="badge" style={{ background: 'rgba(0, 0, 0, 0.75)', color: '#fff', fontSize: '0.85rem', padding: '6px 14px' }}>
              📍 T1: Baseline Epoch (2021)
            </span>
          </div>
        </div>

        {/* Label Badge on Right (After) */}
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 12 }}>
          <span className="badge" style={{ background: 'rgba(0, 0, 0, 0.75)', color: 'var(--accent)', fontSize: '0.85rem', padding: '6px 14px' }}>
            🛰️ T2: Current Epoch (2026)
          </span>
        </div>

        {/* Draggable Divider Handle */}
        <div 
          className="slider-handle-divider"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="slider-handle-knob">
            <GitCompare size={20} />
          </div>
        </div>
      </div>

      {/* Change Metrics KPI Cards Grid */}
      <div className="change-stats-grid">
        <div className="card card-hoverable">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Built-up Expansion</span>
            <TrendingUp size={20} style={{ color: 'var(--color-error)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-error)' }}>
            {metrics.builtUpChange}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            +18.4 km² new concrete surfaces detected in northwest zone.
          </p>
        </div>

        <div className="card card-hoverable">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Vegetation Reduction</span>
            <TrendingDown size={20} style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            {metrics.vegetationChange}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            -11.2 km² canopy lost due to industrial park access roads.
          </p>
        </div>

        <div className="card card-hoverable">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Water Body Variance</span>
            <CheckCircle2 size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>
            {metrics.waterExpansion}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Seasonal catchment runoff expansion in eastern shoreline.
          </p>
        </div>
      </div>

      {/* AI Grounded Narrative Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="isro-live-dot"></div>
          <h3 style={{ fontSize: '1.1rem' }}>Automated Bi-Temporal Narrative & Ecological Impact</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.92rem' }}>
          {metrics.summary} Cross-referencing Cartosat-2 (2021) with Cartosat-3 (2026) reveals that 
          the lake buffer protection corridor has experienced a <strong>14.2% expansion</strong> in impervious asphalt and concrete. 
          Runoff retention potential has decreased by <strong>8.6%</strong>, increasing localized flash flood vulnerability during extreme precipitation events.
        </p>
      </div>
    </div>
  );
}
