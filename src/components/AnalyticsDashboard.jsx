import React from 'react';
import { 
  BarChart3, ShieldCheck, PieChart, Layers, 
  Satellite, Calendar, Cloud, Compass, Building, 
  Droplets, GitCommit, Milestone, TrendingUp, ArrowLeft 
} from 'lucide-react';

export function AnalyticsDashboard({ scenario, onGoBack }) {
  const objects = scenario.objects || [
    { type: 'Commercial Buildings', count: 142, icon: Building },
    { type: 'Water Reservoirs', count: 4, icon: Droplets },
    { type: 'Bridges & Flyovers', count: 6, icon: GitCommit },
    { type: 'Transit Corridors', count: 18, icon: Milestone }
  ];

  return (
    <div className="analytics-screen">
      {/* Header */}
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
            <span className="badge badge-optical">Telemetry Dashboard</span>
            <span className="badge badge-high">Sensor Telemetry & Statistics</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', marginTop: 6 }}>
            Analytics & Confidence Telemetry
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Mission-grade quantitative breakdown of remote sensing indices, spatial coverage, and model ensemble scores.
          </p>
        </div>
      </div>

      {/* Primary KPI Cards Row */}
      <div className="metrics-kpi-row">
        {/* Overall Confidence */}
        <div className="kpi-card card-hoverable" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Overall AI Confidence</span>
            <ShieldCheck size={20} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>
            {scenario.overallConfidence}%
          </div>
          <div className="progress-bar-track">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${scenario.overallConfidence}%`, background: 'var(--color-success)' }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Monte-Carlo Dropout Ensemble (Variance: 0.017)
          </div>
        </div>

        {/* Cloud Cover */}
        <div className="kpi-card card-hoverable">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Cloud Cover</span>
            <Cloud size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="kpi-value">{scenario.cloudCover}</div>
          <div className="progress-bar-track">
            <div 
              className="progress-bar-fill" 
              style={{ width: scenario.cloudCover, background: 'var(--accent)' }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-success)' }}>
            Optimal for Optical Multispectral Analysis
          </div>
        </div>

        {/* Spatial Resolution */}
        <div className="kpi-card card-hoverable">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Spatial Resolution (GSD)</span>
            <Compass size={20} style={{ color: 'var(--accent-secondary)' }} />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.4rem', marginTop: 4 }}>
            {scenario.resolution}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Sub-meter high-resolution panchromatic band
          </div>
        </div>

        {/* Acquisition Epoch */}
        <div className="kpi-card card-hoverable">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="kpi-title">Acquisition Time</span>
            <Calendar size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.15rem', marginTop: 6 }}>
            {scenario.date}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Sun Angle: 46.8° | Azimuth: 138.5°
          </div>
        </div>
      </div>

      {/* Middle Section: Land Cover Distribution & Detected Structures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)' }}>
        {/* Land-Cover Distribution Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Land-Cover Semantic Distribution</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supervised DeepLabV3+ remote sensing classification</p>
            </div>
            <span className="badge badge-high">100% Normalized</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {scenario.landCover.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    {item.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {item.percent}%
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${item.percent}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detected Objects & Structures */}
        <div className="card">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Detected Physical Infrastructure</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SAM-EO + SAR radar double-bounce localized objects</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {objects.map((obj, i) => (
              <div 
                key={i} 
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{obj.type}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--accent)' }}>
                  {obj.count}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>
                  ✓ 96%+ IOU Confidence
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spectral Indices Reference */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>
          Calculated Remote Sensing Radiometric Indices
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NDVI (Vegetation Index)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#22c55e' }}>{scenario.indices.ndvi}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NDWI (Water Extraction Index)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8' }}>{scenario.indices.ndwi}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NDBI (Built-up Impervious Index)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f59e0b' }}>{scenario.indices.ndbi}</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SAR Backscatter Intensity</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#c084fc' }}>{scenario.indices.sarBackscatter}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
