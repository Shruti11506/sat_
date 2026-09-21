import React, { useState, useRef } from 'react';
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Layers, 
  Eye, EyeOff, Crosshair, Sliders, MapPin, Compass, ArrowLeft 
} from 'lucide-react';

export function ImageViewer({ 
  imageUrl, 
  scenario, 
  showBBoxesDefault = true, 
  showSegmentationDefault = true,
  onInspectElement,
  onGoBack
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Layer Controls
  const [showBBoxes, setShowBBoxes] = useState(showBBoxesDefault);
  const [showSegmentation, setShowSegmentation] = useState(showSegmentationDefault);
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [activeBand, setActiveBand] = useState('rgb'); // 'rgb', 'false-color', 'ndwi', 'sar-overlay'

  // Live Coordinates HUD
  const [coords, setCoords] = useState({ lat: '12°58′23.4″N', lng: '77°35′45.1″E', elev: '920m' });
  const [selectedBox, setSelectedBox] = useState(null);

  const containerRef = useRef(null);

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.3, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.3, 0.7));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // primary click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    // Update live coordinates simulation based on normalized position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      
      const baseLat = 12.9716;
      const baseLng = 77.5946;
      const calcLat = (baseLat + (0.5 - relY) * 0.05).toFixed(4);
      const calcLng = (baseLng + (relX - 0.5) * 0.05).toFixed(4);
      const calcElev = Math.round(910 + (relY * 25));
      
      setCoords({
        lat: `${calcLat}°N`,
        lng: `${calcLng}°E`,
        elev: `${calcElev}m MSL`
      });
    }

    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Dynamic Scale Bar Calculation
  const scaleMeters = Math.round(500 / zoom);

  return (
    <div 
      className="image-viewer-container"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top HUD Controls */}
      <div className="viewer-top-hud">
        {/* Left: Sensor & Coordinates Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onGoBack && (
            <button 
              className="btn btn-secondary btn-back-nav"
              onClick={onGoBack}
              title="Back"
              style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
          )}
          <div className="hud-pill">
            <MapPin size={13} style={{ color: 'var(--accent)' }} />
            <span>{coords.lat}, {coords.lng}</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span>{coords.elev}</span>
          </div>
          <div className="hud-pill" style={{ display: 'flex', gap: 6 }}>
            <span className="badge badge-optical">{scenario.sensor}</span>
            <span className="badge badge-geotiff">{scenario.resolution}</span>
          </div>
        </div>

        {/* Right: Layer Opacity & Band Selector */}
        <div className="hud-controls-group">
          {/* Opacity Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', color: '#f8fafc', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <Sliders size={13} />
            <span>Opacity: {layerOpacity}%</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={layerOpacity}
              onChange={(e) => setLayerOpacity(Number(e.target.value))}
              style={{ width: 70, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>

          {/* Band Selector */}
          <select 
            value={activeBand} 
            onChange={(e) => setActiveBand(e.target.value)}
            style={{
              background: 'transparent',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer'
            }}
          >
            <option value="rgb" style={{ background: '#0f172a' }}>RGB True Color</option>
            <option value="false-color" style={{ background: '#0f172a' }}>NIR False Color</option>
            <option value="ndwi" style={{ background: '#0f172a' }}>NDWI Water Mask</option>
            <option value="sar-overlay" style={{ background: '#0f172a' }}>SAR Radar Fusion</option>
          </select>
        </div>
      </div>

      {/* Main Satellite Canvas Layer */}
      <div 
        className="satellite-canvas-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Base Satellite Imagery */}
        <img 
          src={
            activeBand === 'sar-overlay' 
              ? (scenario.fusionImg || imageUrl) 
              : activeBand === 'false-color'
              ? (scenario.afterImg || imageUrl)
              : imageUrl
          }
          alt={scenario.title}
          className="satellite-img-element"
          draggable={false}
          style={{
            filter: activeBand === 'ndwi' ? 'contrast(1.4) saturate(1.8) hue-rotate(180deg)' : 'none'
          }}
        />

        {/* Semantic Segmentation Mask Overlay */}
        {showSegmentation && (
          <svg 
            viewBox="0 0 1000 1000"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: layerOpacity / 100
            }}
          >
            {/* Water Body Polygon (Lake) */}
            <path
              d="M 120,380 C 100,420 80,480 110,540 C 140,600 220,590 250,550 C 270,510 280,440 240,400 C 200,360 140,350 120,380 Z"
              fill="rgba(56, 189, 248, 0.55)"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            {/* Secondary Reservoir Inundation */}
            <path
              d="M 140,780 C 180,750 320,770 420,840 C 460,880 380,940 320,930 C 240,920 120,910 140,780 Z"
              fill="rgba(56, 189, 248, 0.5)"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            {/* Urban High Density Cluster */}
            <rect
              x="130" y="80" width="310" height="230"
              rx="12"
              fill="rgba(245, 158, 11, 0.35)"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            {/* Botanical Canopy Mask */}
            <path
              d="M 520,490 C 600,460 780,470 820,560 C 840,640 760,720 660,700 C 580,680 500,620 520,490 Z"
              fill="rgba(34, 197, 94, 0.4)"
              stroke="#22c55e"
              strokeWidth="2"
            />
          </svg>
        )}

        {/* Bounding Boxes Layer */}
        {showBBoxes && scenario.boundingBoxes && scenario.boundingBoxes.map(box => (
          <div
            key={box.id}
            className={`bbox-overlay-box bbox-${box.type}`}
            style={{
              left: `${box.box.x}%`,
              top: `${box.box.y}%`,
              width: `${box.box.w}%`,
              height: `${box.box.h}%`,
              borderWidth: selectedBox?.id === box.id ? 3 : 2,
              boxShadow: selectedBox?.id === box.id ? '0 0 15px rgba(56, 189, 248, 0.8)' : 'none'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBox(box);
              if (onInspectElement) onInspectElement(box);
            }}
          >
            <div className="bbox-label" style={{ background: box.type === 'water' ? '#0284c7' : box.type === 'urban' ? '#d97706' : box.type === 'veg' ? '#16a34a' : '#9333ea' }}>
              {box.label} ({box.conf}%)
            </div>
          </div>
        ))}
      </div>

      {/* Bottom HUD: Layer Toggles, Zoom, and Scale Bar */}
      <div className="viewer-bottom-hud">
        {/* Left: Toggles for BBoxes & Segmentation */}
        <div className="hud-controls-group">
          <button 
            className={`hud-btn ${showBBoxes ? 'active' : ''}`}
            onClick={() => setShowBBoxes(!showBBoxes)}
            title="Toggle Bounding Boxes"
          >
            {showBBoxes ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button 
            className={`hud-btn ${showSegmentation ? 'active' : ''}`}
            onClick={() => setShowSegmentation(!showSegmentation)}
            title="Toggle Semantic Segmentation"
          >
            <Layers size={16} />
          </button>
          <div style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.2)', margin: '0 4px' }} />
          <span style={{ color: '#f8fafc', fontSize: '0.72rem', padding: '0 4px', fontFamily: 'var(--font-mono)' }}>
            Layers: {showBBoxes ? 'BBoxes' : ''} {showSegmentation ? '+ Mask' : ''}
          </span>
        </div>

        {/* Center: Selected Element Inspector Card */}
        {selectedBox && (
          <div className="hud-pill" style={{ gap: 12, border: '1px solid var(--accent)' }}>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selectedBox.label}</span>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{selectedBox.note}</div>
            </div>
            <button 
              className="btn-icon" 
              style={{ width: 22, height: 22, fontSize: '0.7rem' }}
              onClick={() => setSelectedBox(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Right: Zoom Controls & Scale Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Dynamic Scale Bar */}
          <div className="hud-pill scale-bar-widget">
            <div style={{ textAlign: 'center' }}>~{scaleMeters} m</div>
            <div className="scale-bar-line"></div>
          </div>

          <div className="hud-controls-group">
            <button className="hud-btn" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <span style={{ color: '#f8fafc', fontSize: '0.75rem', padding: '0 6px', fontFamily: 'var(--font-mono)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="hud-btn" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={16} />
            </button>
            <button className="hud-btn" onClick={handleReset} title="Reset View">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
