import React, { useState } from 'react';
import { 
  Upload, FileUp, Sparkles, ArrowRight, CheckCircle2,
  Satellite, Layers, Database, Compass
} from 'lucide-react';
import { ChitravitsEmblem } from './ui/ChitravitsLogo';
import { SUGGESTED_QUERIES } from '../data/mockData';
import { uploadImagery } from '../lib/apiClient';

export function LandingHero({ onStartAnalysis, onStartConversation }) {
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

  const processFile = async (file) => {
    setIsValidating(true);
    const isImageFile = file.type?.startsWith('image/') && !file.name.endsWith('.tif') && !file.name.endsWith('.tiff');
    const previewUrl = isImageFile ? URL.createObjectURL(file) : '/assets/optical_satellite.jpg';

    // sensor/crs/bands are intentionally left unset -- a plain browser file
    // carries no real sensor or CRS metadata, and none is fabricated (see
    // backend README "no dummy data" scope).
    const filePayload = {
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type || 'image/tiff',
      previewUrl: previewUrl
    };

    // Real upload to Supabase Storage (bucket: Satquery) via FastAPI, into a
    // new conversation (titled "New Chat" -- the filename never becomes the
    // title). The "Parsing GeoTIFF Metadata..." loading state covers this
    // real network call. If it fails, imageryId stays null and the chat
    // shows the honest upload error.
    try {
      const conversationId = await onStartConversation();
      const result = await uploadImagery(file, { name: file.name, conversationId });
      console.info('[SatQuery] Image uploaded to Supabase Storage:', result.bucket, result.storage_path);
      filePayload.imageryId = result.id;
      filePayload.conversationId = conversationId;
    } catch (err) {
      console.error('[SatQuery] Image upload to backend failed:', err);
    }

    setUploadedFile(filePayload);
    setIsValidating(false);
    // Only a query the user actually typed is submitted; an upload alone
    // opens the chat and waits for the first question.
    onStartAnalysis(prompt, filePayload);
  };

  const handleAnalyze = () => {
    if (!prompt.trim() && !uploadedFile) return;
    onStartAnalysis(prompt, uploadedFile);
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
              <span className="badge badge-geotiff">{uploadedFile.name?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
              {uploadedFile.sensor && <span className="badge badge-optical">{uploadedFile.sensor}</span>}
              {uploadedFile.crs && <span className="badge badge-high">{uploadedFile.crs}</span>}
              {!uploadedFile.imageryId && <span className="badge" title="Backend upload failed">Not saved to backend</span>}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Size: {uploadedFile.size} | Ready for conversational query
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
              Supports GeoTIFF, Multi-spectral TIFF, PNG, or JPEG up to 50 MB
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
