import React, { useState } from 'react';
import { 
  Upload, FileUp, Sparkles, ArrowRight, CheckCircle2, 
  Satellite, Layers, Database, Compass, Zap 
} from 'lucide-react';
import { ChitravitsEmblem } from './ui/ChitravitsLogo';
import { SUGGESTED_QUERIES } from '../data/mockData';

export function LandingHero({ onStartAnalysis, onLoadDemo, currentScenario }) {
  const [prompt, setPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    setIsValidating(true);
    const isImageFile = file.type?.startsWith('image/') && !file.name.endsWith('.tif') && !file.name.endsWith('.tiff');
    const previewUrl = isImageFile ? URL.createObjectURL(file) : '/assets/optical_satellite.jpg';

    const filePayload = {
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type || 'image/tiff',
      crs: 'EPSG:4326 (WGS84)',
      bands: 'B2, B3, B4, B8 (Multispectral)',
      sensor: 'Cartosat-3 High-Res (0.28m GSD)',
      previewUrl: previewUrl
    };

    setUploadedFile(filePayload);
    
    // Smooth brief parsing animation then immediately launch into conversational chat with image attached!
    setTimeout(() => {
      setIsValidating(false);
      onStartAnalysis(prompt || 'Analyze this satellite scene and extract critical land-cover structures', filePayload);
    }, 450);
  };

  const handleSampleDemo = () => {
    const demoPayload = {
      name: 'Bengaluru_Cartosat3_Optical_0.28m.tif',
      size: '142.8 MB',
      type: 'image/tiff',
      crs: 'EPSG:4326 (WGS84)',
      bands: 'B2, B3, B4, B8 (Multispectral)',
      sensor: 'Cartosat-3 (0.28m GSD) + RISAT-1A SAR',
      previewUrl: '/assets/optical_satellite.jpg'
    };
    onStartAnalysis(prompt || 'Analyze the water bodies and infrastructure in this Bengaluru satellite scene', demoPayload);
  };

  const handleAnalyze = () => {
    onStartAnalysis(prompt || 'Analyze this satellite scene and extract critical land-cover structures', uploadedFile);
  };

  return (
    <div className="landing-hero">
      {/* Main Hero Headline */}
      <h1 className="hero-tagline">
        Analyze Earth.<br />
        <span className="highlight-crossfade">
          <span className="highlight-light">Ask in Natural Language.</span>
          <span className="highlight-dark">Ask in Natural Language.</span>
        </span>
      </h1>

      {/* Drag & Drop Upload Zone */}
      <div 
        className={`upload-dropzone ${isDragging ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('satellite-file-input').click()}
      >
        <input 
          id="satellite-file-input" 
          type="file" 
          accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg" 
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {isValidating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="isro-live-dot" style={{ width: 14, height: 14 }}></div>
            <p style={{ color: 'var(--accent)', fontWeight: 600 }}>Parsing GeoTIFF Metadata & Georeferencing Bounds...</p>
          </div>
        ) : uploadedFile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div className="dropzone-icon-box" style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem' }}>{uploadedFile.name}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="badge badge-geotiff">GeoTIFF</span>
              <span className="badge badge-optical">{uploadedFile.sensor}</span>
              <span className="badge badge-high">{uploadedFile.crs}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Size: {uploadedFile.size} | Geotagged & ready for conversational query
            </p>
          </div>
        ) : (
          <div>
            <div className="dropzone-icon-box">
              <Upload size={30} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 6 }}>
              Drag & Drop your Satellite Scene here
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              Supports GeoTIFF, Multi-spectral TIFF, PNG, or JPEG up to 500 MB
            </p>
            <div style={{ display: 'inline-flex', gap: 10 }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={(e) => { e.stopPropagation(); document.getElementById('satellite-file-input').click(); }}
                title="Browse local files to upload GeoTIFF / TIFF / Satellite imagery"
              >
                <FileUp size={16} style={{ color: 'inherit', flexShrink: 0 }} />
                <span>Browse & Upload GeoTIFF / TIFF</span>
              </button>
              <button 
                type="button" 
                className="btn btn-outline"
                onClick={(e) => { e.stopPropagation(); handleSampleDemo(); }}
              >
                <Zap size={16} />
                Sample Demo (Bengaluru 0.28m)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Bar Input */}
      <div className="prompt-bar-wrapper" style={{ width: '100%', maxWidth: '780px', marginBottom: 'var(--space-5)' }}>
        <div className="prompt-input-row">
          <Sparkles size={20} style={{ color: 'var(--accent)', marginLeft: 8 }} />
          <textarea
            className="prompt-textarea"
            placeholder="Ask anything in plain English (e.g. 'Highlight water bodies and calculate urban growth')..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAnalyze();
              }
            }}
          />
          <button 
            className="btn btn-primary"
            onClick={handleAnalyze}
            title="Submit satellite query"
          >
            <span>Analyze</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Suggested Query Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Suggested Remote Sensing Inquiries
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 840 }}>
          {SUGGESTED_QUERIES.map((q, idx) => (
            <button 
              key={idx}
              className="query-chip"
              onClick={() => {
                setPrompt(q);
              }}
            >
              <Sparkles size={13} style={{ color: 'var(--accent)' }} />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
