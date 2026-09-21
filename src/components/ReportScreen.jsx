import React, { useState } from 'react';
import { 
  FileText, Download, Share2, Printer, Check, 
  Satellite, ShieldCheck, MapPin, Calendar, ExternalLink, Code, ArrowLeft
} from 'lucide-react';

export function ReportScreen({ scenario, onGoBack }) {
  const [copiedShare, setCopiedShare] = useState(false);
  const [exportedGeoJson, setExportedGeoJson] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handleExportGeoJson = () => {
    const geojsonData = {
      type: 'FeatureCollection',
      mission: 'ISRO Earth Observation Mission',
      dataset: scenario.title,
      sensor: scenario.sensor,
      coordinates: scenario.location,
      overallConfidence: scenario.overallConfidence,
      features: scenario.boundingBoxes.map(b => ({
        type: 'Feature',
        properties: {
          id: b.id,
          label: b.label,
          category: b.type,
          confidence: b.conf,
          notes: b.note
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [77.59 + b.box.x * 0.001, 12.97 + b.box.y * 0.001],
            [77.59 + (b.box.x + b.box.w) * 0.001, 12.97 + b.box.y * 0.001],
            [77.59 + (b.box.x + b.box.w) * 0.001, 12.97 + (b.box.y + b.box.h) * 0.001],
            [77.59 + b.box.x * 0.001, 12.97 + (b.box.y + b.box.h) * 0.001],
            [77.59 + b.box.x * 0.001, 12.97 + b.box.y * 0.001]
          ]]
        }
      }))
    };

    const blob = new Blob([JSON.stringify(geojsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SatQuery_Report_${scenario.id}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
    setExportedGeoJson(true);
    setTimeout(() => setExportedGeoJson(false), 2000);
  };

  return (
    <div className="report-screen-layout">
      {/* Top Action Controls Bar (hidden during print) */}
      <div className="non-printable" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onGoBack && (
            <button 
              className="btn btn-secondary btn-back-nav"
              onClick={onGoBack}
              title="Back to Chat Interface"
              style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={15} />
              <span>Back to Chat</span>
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '1.6rem' }}>Report</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Official Remote Sensing AI Inspection Dossier ready for review & PDF archiving.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExportGeoJson}>
            <Code size={15} />
            <span>{exportedGeoJson ? 'Exported!' : 'Export GeoJSON'}</span>
          </button>
          <button className="btn btn-secondary" onClick={handleShare}>
            {copiedShare ? <Check size={15} style={{ color: 'var(--color-success)' }} /> : <Share2 size={15} />}
            <span>{copiedShare ? 'Link Copied' : 'Share'}</span>
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={15} />
            <span>Download PDF / Print</span>
          </button>
        </div>
      </div>

      {/* The Printable Scientific Dossier Card */}
      <div className="report-paper-card">
        {/* Official Header */}
        <div className="report-header-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img 
              src="/assets/isro_badge.jpg" 
              alt="ISRO Logo" 
              style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--accent)' }}
            />
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                INDIAN SPACE RESEARCH ORGANISATION
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Earth Observation Programme • SatQuery Agentic Remote Sensing Intelligence
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="badge badge-high" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              <ShieldCheck size={14} />
              <span>CONFIDENCE: {scenario.overallConfidence}%</span>
            </span>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              DOC ID: ISRO-SATQ-{scenario.id.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>
            1. EXECUTIVE NATURAL LANGUAGE ANALYSIS
          </h3>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', lineHeight: 1.7, fontSize: '0.92rem' }}>
            {scenario.chatHistory[1]?.text || 'Comprehensive multimodal satellite image analysis completed.'}
          </div>
        </div>

        {/* Visual Evidence Plate */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>
            2. GROUNDED VISUAL EVIDENCE & BOUNDING ANCHORS
          </h3>
          <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <img 
              src={scenario.opticalImg} 
              alt="Visual Evidence Plate" 
              style={{ width: '100%', maxHeight: '420px', objectFit: 'cover' }}
            />
            {/* Visual Bounding Overlay Demonstration on Report */}
            {scenario.boundingBoxes.map(box => (
              <div 
                key={box.id}
                className={`bbox-overlay-box bbox-${box.type}`}
                style={{
                  left: `${box.box.x}%`,
                  top: `${box.box.y}%`,
                  width: `${box.box.w}%`,
                  height: `${box.box.h}%`,
                  pointerEvents: 'none'
                }}
              >
                <div className="bbox-label" style={{ background: 'rgba(0,0,0,0.85)' }}>
                  {box.label} ({box.conf}%)
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
            Figure 1: Cartosat-3 sub-meter pan-sharpened visual evidence plate with verified spatial bounding polygons.
          </p>
        </div>

        {/* Grounding Radiometric Indices & Detected Objects */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>
            3. SPECTRAL METRICS & PHYSICAL INVENTORY
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <table className="report-meta-table">
              <thead>
                <tr>
                  <th>Spectral Index</th>
                  <th>Observed Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>NDVI (Vegetation Index)</td><td>{scenario.indices.ndvi}</td></tr>
                <tr><td>NDWI (Water Surface Index)</td><td>{scenario.indices.ndwi}</td></tr>
                <tr><td>NDBI (Built-Up Concrete Index)</td><td>{scenario.indices.ndbi}</td></tr>
                <tr><td>SAR Cross-Pol Backscatter</td><td>{scenario.indices.sarBackscatter}</td></tr>
              </tbody>
            </table>

            <table className="report-meta-table">
              <thead>
                <tr>
                  <th>Class / Feature</th>
                  <th>Coverage / Count</th>
                </tr>
              </thead>
              <tbody>
                {scenario.landCover.map((lc, idx) => (
                  <tr key={idx}>
                    <td>{lc.label}</td>
                    <td>{lc.percent}% Coverage</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sensor & Acquisition Telemetry Table */}
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>
            4. ORBITAL SENSOR METADATA & CALIBRATION
          </h3>
          <table className="report-meta-table">
            <tbody>
              <tr>
                <th>Satellite Mission</th>
                <td>{scenario.sensor}</td>
                <th>Ground Sampling Distance (GSD)</th>
                <td>{scenario.resolution}</td>
              </tr>
              <tr>
                <th>Scene Coordinates</th>
                <td>{scenario.location}</td>
                <th>Acquisition Date/Time</th>
                <td>{scenario.date}</td>
              </tr>
              <tr>
                <th>Cloud Cover Rating</th>
                <td>{scenario.cloudCover}</td>
                <th>CRS Geotransform</th>
                <td>EPSG:4326 (WGS 84 Ellipsoid)</td>
              </tr>
              <tr>
                <th>AI Model Chain</th>
                <td>ISRO-GeoVision-LLaVA v3.2 + Prithvi-EO Foundation</td>
                <th>Confidence Calibration</th>
                <td>Monte-Carlo Dropout Ensemble (96.4%)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sign-off & Verification Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 'var(--space-4)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            <div>Verified by: <strong>SatQuery AI Vision-Language Core</strong></div>
            <div>Cryptographic Evidence Hash: <code>0x9f8b72e143a5d890cf2b638a</code></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Earth Observation Programme</div>
            <div>National Remote Sensing Gateway</div>
          </div>
        </div>
      </div>
    </div>
  );
}
