import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, Cpu, ChevronDown, ChevronUp, 
  Terminal, ShieldCheck, Play, RefreshCw, Layers, ArrowLeft 
} from 'lucide-react';

export function AgentPipeline({ scenario, onGoBack }) {
  const [expandedStep, setExpandedStep] = useState(2); // default expand Task Classification
  const [isRunning, setIsRunning] = useState(false);

  const pipelineSteps = [
    {
      id: 0,
      title: '1. Input Validation & CRS Sanitization',
      desc: 'Validated GeoTIFF container, header integrity, nodata masks, and EPSG:4326 geotransform matrix.',
      status: 'completed',
      duration: '12ms',
      model: 'GDAL Core v3.9',
      telemetry: {
        crs: 'EPSG:4326 (WGS 84 / Geographic 2D)',
        rasterSize: [4096, 4096],
        dataType: 'Float32 [4 Bands]',
        noDataValue: -9999.0,
        cloudCoverage: '3.8% (Passes <10% threshold)'
      }
    },
    {
      id: 1,
      title: '2. Sensor & Spectral Metadata Detection',
      desc: 'Extracted sensor ephemeris, radiometric calibration coefficients, and Ground Sampling Distance (GSD).',
      status: 'completed',
      duration: '24ms',
      model: 'ISRO-MetaEngine v2',
      telemetry: {
        sensorId: 'Cartosat-3 PAN+MS / RISAT-1A SAR',
        gsdPan: '0.28m / pixel',
        gsdMs: '1.12m / pixel',
        solarElevation: '46.82°',
        sunAzimuth: '138.45°',
        sarPolarization: 'Dual-Pol VV + VH (C-Band)'
      }
    },
    {
      id: 2,
      title: '3. Agentic Task & Intent Classification',
      desc: 'Zero-shot remote sensing query decomposition into multi-modal subtasks: VQA, Semantic Segmentation, and Encroachment Detection.',
      status: 'completed',
      duration: '48ms',
      model: 'IntentClassifier-LLM 7B',
      telemetry: {
        primaryIntent: 'VQA_WATER_URBAN_INTERACTION',
        subtasks: ['NDWI_BAND_RATIO', 'SAM_ZERO_SHOT_SEGMENTATION', 'SAR_DOUBLE_BOUNCE_URBAN'],
        targetClasses: ['Water_Reservoir', 'BuiltUp_Dense', 'Vegetation_Canopy', 'Encroachment_Buffer'],
        intentConfidence: 0.992
      }
    },
    {
      id: 3,
      title: '4. Model & Architecture Routing',
      desc: 'Dynamically routed query to ISRO-GeoVision multimodal backbone with Segment Anything for Earth Observation (SAM-EO).',
      status: 'completed',
      duration: '18ms',
      model: 'GeoRouter-Agent v4',
      telemetry: {
        visionBackbone: 'Prithvi-EO-100M-Multispectral',
        vqaModel: 'ISRO-GeoVision-LLaVA-v3.2-13B',
        segmentationHead: 'SAM-EO-ViT-Huge (Fine-tuned on Indian Terrains)',
        quantization: 'FP16 Precision TensorRT'
      }
    },
    {
      id: 4,
      title: '5. Tool & Python Geospatial Execution',
      desc: 'Executed band ratio mathematics (NDWI/NDBI) and RISAT SAR speckle suppression filter (Enhanced Frost 5x5).',
      status: 'completed',
      duration: '142ms',
      model: 'BandRatioEngine + GDAL_Warp',
      telemetry: {
        ndwiCalculated: '(Band_Green - Band_NIR) / (Band_Green + Band_NIR)',
        thresholdApplied: 'NDWI > 0.35 (Water Confidence Mask)',
        sarFilter: 'Enhanced Frost Filter 5x5 window (Speckle Index: 0.12)',
        featuresDetected: 142
      }
    },
    {
      id: 5,
      title: '6. Calibrated Confidence Estimation',
      desc: 'Evaluated Monte-Carlo Dropout ensemble variance across 10 forward passes to guarantee hallucination-free metrics.',
      status: 'completed',
      duration: '35ms',
      model: 'MCDropout-Ensemble-Scorer',
      telemetry: {
        rawScore: 0.981,
        ensembleVariance: 0.017,
        calibrationFactor: 'Temperature Scaling T=1.14',
        finalConfidence: '96.4% (High Calibrated Confidence)'
      }
    },
    {
      id: 6,
      title: '7. Final Evidence-Grounded Response Generation',
      desc: 'Compiled natural language explanation linking spatial bounding coordinates, area calculations, and policy recommendations.',
      status: 'completed',
      duration: '88ms',
      model: 'GeoLLM-Reasoner',
      telemetry: {
        tokensGenerated: 218,
        evidenceGroundingAnchors: 4,
        exportFormats: ['PDF_Report', 'GeoJSON', 'CloudOptimizedGeoTIFF']
      }
    }
  ];

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 800);
  };

  return (
    <div className="pipeline-screen">
      {/* Header */}
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
              <span className="badge badge-geotiff">Agentic Execution Trace</span>
              <span className="badge badge-high">7-Stage Real-Time Pipeline</span>
            </div>
            <h2 style={{ fontSize: '1.8rem', marginTop: 6 }}>
              SatQuery Multi-Agent Execution Pipeline
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Transparent, explainable AI pipeline trace from raw GeoTIFF ingestion to grounded vision-language response.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleRerun}>
            <RefreshCw size={15} className={isRunning ? 'isro-live-dot' : ''} />
            <span>Re-evaluate Pipeline</span>
          </button>
        </div>
      </div>

      {/* Vertical Pipeline Timeline */}
      <div className="pipeline-timeline">
        {pipelineSteps.map((step) => {
          const isExpanded = expandedStep === step.id;
          return (
            <div key={step.id} className="pipeline-step-node">
              {/* Timeline Connector Dot */}
              <div className={`pipeline-step-dot ${isRunning ? 'active' : ''}`} />

              {/* Node Header */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{step.title}</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, marginLeft: 28 }}>
                    {step.desc}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge badge-optical">
                    <Cpu size={12} />
                    <span>{step.model}</span>
                  </span>

                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)' }}>
                    {step.duration}
                  </span>

                  <button className="btn-icon" style={{ width: 28, height: 28 }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expandable Raw Telemetry JSON Details */}
              {isExpanded && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', marginBottom: 8, fontWeight: 600 }}>
                    <Terminal size={14} />
                    <span>Step Telemetry & Internal States:</span>
                  </div>
                  <pre style={{ color: 'var(--text-secondary)', overflowX: 'auto' }}>
                    {JSON.stringify(step.telemetry, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
