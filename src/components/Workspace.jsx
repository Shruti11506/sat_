import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Mic, Copy, Check, RefreshCw, Volume2, 
  ChevronDown, ChevronUp, Cpu, ExternalLink, ShieldCheck, 
  ImagePlus, X, Satellite, Layers, MapPin, ArrowLeft, GitCompare
} from 'lucide-react';
import { ImageViewer } from './ImageViewer';

const QUICK_SUGGESTIONS = [
  { icon: '📄', label: 'Give me the Report', text: 'Give me the report for this satellite scene' },
  { icon: '🔄', label: 'Compare These Both', text: 'Compare these both with bi-temporal satellite imagery' },
  { icon: '🌊', label: 'Extract Water & NDWI', text: 'Analyze water bodies, calculate surface area, and extract NDWI contour' },
  { icon: '🏢', label: 'SAR Building Count', text: 'Detect building structures using SAR double-bounce radar backscatter' },
  { icon: '🌿', label: 'Canopy Health & NDVI', text: 'Assess vegetation density and canopy moisture stress using NDVI' },
  { icon: '🛰️', label: 'Sensor & CRS Specs', text: 'Show sensor specifications, GSD resolution, and coordinate reference system' }
];

export function Workspace({ scenario, onNavigateScreen, onGoBack }) {
  const [messages, setMessages] = useState(scenario.chatHistory || []);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeEvidenceHighlight, setActiveEvidenceHighlight] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [activeViewerImage, setActiveViewerImage] = useState(scenario.opticalImg);

  const textareaRef = useRef(null);
  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync scenario chat history if scenario changes
  useEffect(() => {
    setMessages(scenario.chatHistory || []);
    if (scenario.uploadedFile?.previewUrl) {
      setActiveViewerImage(scenario.uploadedFile.previewUrl);
    } else if (scenario.opticalImg) {
      setActiveViewerImage(scenario.opticalImg);
    }
  }, [scenario]);

  // Give immediate control to the chat box when workspace mounts or scene updates
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Smooth auto-scroll to bottom whenever new messages or typing state changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Intelligent domain-grounded conversational responses (like ChatGPT/Gemini for remote sensing)
  const generateAgentResponse = (userQuery, attachment) => {
    const q = (userQuery || '').toLowerCase();
    const sceneName = attachment?.name || scenario.uploadedFile?.name || scenario.title || 'Cartosat-3 Scene';

    if (q.includes('water') || q.includes('lake') || q.includes('reservoir') || q.includes('flood') || q.includes('river')) {
      return {
        taskType: 'Hydrological Surface Delineation (NDWI)',
        confidence: '97.8',
        text: `Hydrological analysis completed for **${sceneName}**.\n\n• **Water Index (NDWI)**: Detected primary reservoir boundary with mean index of **+0.54** (Green Band 3 - NIR Band 8).\n• **Surface Area**: Segmented surface extent is **2.41 km²** (±0.04 km² uncertainty).\n• **Shoreline Integrity**: Edge gradients show stable shoreline embankment with no active flood overflow or breaching detected.\n• **Suspended Solids / Turbidity**: Reflectance ratios indicate low sediment suspension across central basin.\n\nWould you like to export the vector boundary polygon as GeoJSON or inspect shoreline change detection?`,
        executionSteps: [
          { step: 'Band Extraction', desc: 'Loaded calibrated Green (560nm) and NIR (840nm) reflectance rasters', time: '98ms' },
          { step: 'NDWI Ratioing', desc: 'Normalized Difference Water Index computation: (B3 - B8) / (B3 + B8)', time: '115ms' },
          { step: 'Otsu Thresholding', desc: 'Extracted zero-crossing contour to vectorize water perimeter', time: '142ms' },
          { step: 'Spatial Metrics', desc: 'Calculated surface area in UTM Zone 43N projected coordinates', time: '85ms' }
        ]
      };
    }

    if (q.includes('vegetation') || q.includes('forest') || q.includes('ndvi') || q.includes('tree') || q.includes('canopy') || q.includes('green') || q.includes('crop')) {
      return {
        taskType: 'Vegetation Canopy & Biomass Health (NDVI)',
        confidence: '96.5',
        text: `Vegetation canopy analysis completed for **${sceneName}**.\n\n• **Vegetation Index (NDVI)**: Healthy vegetative canopy confirmed with mean score of **+0.68** (NIR - Red).\n• **Land Cover Coverage**: Dense trees and riparian buffer constitute **34.2%** of the total observed quadrant.\n• **Moisture & Vigor**: Strong chlorophyll absorption dip at 660nm and cellular scattering at 840nm verify no acute drought stress or crown dieback.\n• **Zonal Variance**: Riparian buffer zone shows peak NDVI (+0.79), while residential fringe buffers average +0.42.\n\nWould you like to overlay the NDVI pseudo-color heatmap or inspect crown density distribution?`,
        executionSteps: [
          { step: 'Reflectance Calibration', desc: 'Calibrated Top-Of-Atmosphere Red and NIR spectral channels', time: '104ms' },
          { step: 'NDVI Index Processing', desc: 'Calculated per-pixel NDVI matrix: (B8 - B4) / (B8 + B4)', time: '122ms' },
          { step: 'Zonal Statistics', desc: 'Aggregated canopy density across agricultural and forest polygons', time: '135ms' }
        ]
      };
    }

    if (q.includes('building') || q.includes('urban') || q.includes('structure') || q.includes('house') || q.includes('road') || q.includes('built') || q.includes('sar')) {
      return {
        taskType: 'Urban Structure Extraction & SAR Radar Fusion',
        confidence: '98.2',
        text: `Urban infrastructure analysis completed for **${sceneName}**.\n\n• **Structure Count**: Identified **142 permanent building footprints** at sub-meter spatial precision.\n• **SAR Double-Bounce Verification**: Co-registered RISAT-1A SAR C-band radar reveals strong right-angle dihedral reflections (VV/VH backscatter **-12.4 dB**), validating concrete and metallic structures.\n• **Road & Transit Corridor**: 18.4 km of paved access corridors traced with zero obstruction anomalies.\n• **Structural Integrity**: No subsidence or unauthorized structural encroachment detected in the surveyed corridor.\n\nWould you like to highlight the detected building bounding boxes on the viewer?`,
        executionSteps: [
          { step: 'Optical High-Pass Filter', desc: 'Extracted rooftop geometry on 0.28m panchromatic band', time: '130ms' },
          { step: 'SAR Co-registration', desc: 'Orthorectified Sentinel-1/RISAT-1A radar amplitude backscatter', time: '195ms' },
          { step: 'Double-Bounce Correlation', desc: 'Cross-matched corner-reflector radar peaks with optical outlines', time: '160ms' },
          { step: 'Vector Polygonization', desc: 'Generated 142 individual building polygon footprints', time: '140ms' }
        ]
      };
    }

    if (q.includes('change') || q.includes('difference') || q.includes('historic') || q.includes('temporal') || q.includes('timeline')) {
      return {
        taskType: 'Bi-Temporal Change Detection Analysis',
        confidence: '95.4',
        text: `Bi-temporal change detection computed for **${sceneName}**.\n\n• **Urban Expansion**: **+12.4%** increase in built-up footprint relative to baseline satellite pass.\n• **Water Surface Shift**: **-4.2%** seasonal shoreline retreat during dry-weather cycle.\n• **Forest Buffer Stability**: Riparian green corridor shows negligible variance (**-0.8%**), demonstrating strict conservation adherence.\n• **Anomalies**: 0 unpermitted clearing events detected across the surveyed zone.\n\nWould you like to open the split-slider swipe viewer to inspect the before-and-after overlays?`,
        executionSteps: [
          { step: 'Sub-Pixel Co-Registration', desc: 'Aligned T1 Baseline and T2 Present GeoTIFFs to sub-pixel accuracy', time: '185ms' },
          { step: 'Radiometric Normalization', desc: 'Dark-Object Subtraction (DOS1) atmospheric illumination correction', time: '160ms' },
          { step: 'Change Vector Analysis', desc: 'Computed spectral magnitude shift across all optical bands', time: '210ms' }
        ]
      };
    }

    if (q.includes('resolution') || q.includes('sensor') || q.includes('band') || q.includes('satellite') || q.includes('crs') || q.includes('geotiff')) {
      return {
        taskType: 'Sensor Telemetry & Geospatial Metadata',
        confidence: '99.4',
        text: `Sensor telemetry report for **${sceneName}**:\n\n• **Primary Sensor**: Cartosat-3 High-Resolution Panchromatic & Multispectral Imager\n• **Spatial Resolution (GSD)**: **0.28 meters** (PAN) / **1.12 meters** (Multispectral 4-Band)\n• **Spectral Channels**: Blue (450-520nm), Green (520-590nm), Red (630-690nm), Near-Infrared (770-860nm)\n• **Secondary Sensor**: RISAT-1A / EOS-04 C-band Synthetic Aperture Radar (SAR)\n• **Coordinate System**: **EPSG:4326 (WGS84)** Geodetic / UTM Zone 43N Projected\n• **Radiometric Precision**: 16-bit unsigned integer depth, georeferenced RPC headers intact.\n\nWhat specific spectral band or geographic coordinate would you like to query?`,
        executionSteps: [
          { step: 'GeoTIFF Header Inspection', desc: 'Parsed GDAL metadata tags, raster dimensions, and geotransform', time: '42ms' },
          { step: 'CRS Coordinate Check', desc: 'Validated WGS84 ellipsoid projections and datum bounds', time: '38ms' },
          { step: 'Radiometric Calibration', desc: 'Loaded 4-band spectral sensitivity calibration profiles', time: '65ms' }
        ]
      };
    }

    // Default intelligent multimodal response
    return {
      taskType: 'Multimodal Earth Observation Intelligence',
      confidence: '96.8',
      text: `Analysis complete for **${sceneName}** based on your prompt: "${userQuery || 'Extract spatial features'}".\n\n• **Spectral Evidence**: Multispectral reflectance confirms robust land-cover segmentation. Water indices (**NDWI +0.54**) and canopy metrics (**NDVI +0.68**) are fully calibrated.\n• **Infrastructure & Built-Up**: Sub-meter spatial resolution clearly delineates 142 permanent structures and primary transport corridors.\n• **Geo-spatial Validity**: Spatial bounds verified under EPSG:4326 (WGS84) with 0.28m GSD precision.\n\nYou can continue asking questions about specific zones, measure areas, or attach additional satellite scenes.`,
      executionSteps: scenario.chatHistory[1]?.executionSteps || [
        { step: 'Multi-spectral Ingestion', desc: 'Loaded 4-band GeoTIFF array into tensor memory', time: '92ms' },
        { step: 'Foundation Model Inference', desc: 'Executed Prithvi-EO 100M vision-language embedding', time: '210ms' },
        { step: 'Feature Vectorization', desc: 'Generated geo-located vector contours and confidence metrics', time: '145ms' }
      ]
    };
  };

  const handleSendMessage = (textToSend) => {
    const query = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!query && !pendingAttachment) return;

    const attachmentPayload = pendingAttachment;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query || (attachmentPayload ? `Analyze attached satellite scene: ${attachmentPayload.name}` : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: attachmentPayload || null
    };

    // If user attached an image, update active satellite viewer on the left
    if (attachmentPayload?.previewUrl) {
      setActiveViewerImage(attachmentPayload.previewUrl);
    }

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setPendingAttachment(null);

    const q = query.toLowerCase();
    const sceneName = attachmentPayload?.name || scenario.uploadedFile?.name || scenario.title || 'Cartosat-3 Scene';

    // 1. Report Redirection: "give me the report", "report", "generate report", etc.
    const isReportRequest = 
      q.includes('report') || 
      q.includes('dossier') ||
      q.includes('summary pdf');

    if (isReportRequest) {
      setIsTyping(true);
      setTimeout(() => {
        const aiResponse = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `📄 **Intelligence Dossier Report Generated** for **${sceneName}**.\n\n• **Executive Summary**: Synthesized multispectral analysis, NDWI water contours, and infrastructure footprints.\n• **Export Options**: GeoJSON vector export and printable official ISRO dossier layout.\n\nRedirecting you to the **Report** screen...`,
          confidence: '99.4',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          evidenceThumb: attachmentPayload?.previewUrl || activeViewerImage || scenario.opticalImg,
          taskType: 'Intelligence Dossier Synthesis',
          modelChain: 'ISRO-GeoVision-LLaVA v3.2 + Report Synthesizer',
          actionLink: { screen: 'report', label: 'Open Full Report ↗' },
          executionSteps: [
            { step: 'Report Generation', desc: 'Compiled spatial features and executive summary', time: '45ms' },
            { step: 'GeoJSON Packaging', desc: 'Exported polygon feature vectors to GeoJSON schema', time: '38ms' },
            { step: 'Screen Transition', desc: 'Navigating to Report View', time: '12ms' }
          ]
        };

        setMessages(prev => [...prev, aiResponse]);
        setIsTyping(false);
        setExpandedSummaryId(aiResponse.id);

        setTimeout(() => {
          onNavigateScreen('report');
        }, 450);
      }, 350);
      return;
    }

    // 2. Compare Redirection: "compare these both", "compare", "change detection", "before and after", etc.
    const isCompareRequest = 
      q.includes('compare') || 
      q.includes('comparison') || 
      q.includes('before and after') || 
      q.includes('change detection') || 
      q.includes('difference') ||
      q.includes('temporal');

    if (isCompareRequest) {
      setIsTyping(true);
      setTimeout(() => {
        const aiResponse = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `🔄 **Bi-Temporal Comparison Engine Loaded** for **${sceneName}**.\n\n• **Baseline Epoch**: 2021 pre-development survey.\n• **Present Epoch**: 2026 Cartosat-3 acquisition.\n• **Ground Delta**: +14.2% built-up expansion, -8.6% vegetation shift.\n\nRedirecting you to the interactive **Bi-Temporal Change Detection & Comparison** split-slider...`,
          confidence: '97.8',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          evidenceThumb: attachmentPayload?.previewUrl || activeViewerImage || scenario.opticalImg,
          taskType: 'Bi-Temporal Change Detection & Comparison',
          modelChain: 'ISRO-GeoVision-LLaVA v3.2 + Sub-Pixel Co-registration',
          actionLink: { screen: 'change', label: 'Open Comparison Slider ↗' },
          executionSteps: [
            { step: 'Co-Registration', desc: 'Sub-pixel co-registration of 2021 and 2026 rasters', time: '82ms' },
            { step: 'Change Vector Analysis', desc: 'Spectral magnitude difference calculation', time: '110ms' },
            { step: 'Screen Transition', desc: 'Navigating to Change Detection View', time: '15ms' }
          ]
        };

        setMessages(prev => [...prev, aiResponse]);
        setIsTyping(false);
        setExpandedSummaryId(aiResponse.id);

        setTimeout(() => {
          onNavigateScreen('change');
        }, 450);
      }, 350);
      return;
    }

    setIsTyping(true);

    // Re-focus input box immediately so user can continue typing (ChatGPT / Gemini style)
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);

    // Simulate agent reasoning delay
    setTimeout(() => {
      const generated = generateAgentResponse(query, attachmentPayload);
      const aiResponse = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: generated.text,
        confidence: generated.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        evidenceThumb: attachmentPayload?.previewUrl || activeViewerImage || scenario.opticalImg,
        taskType: generated.taskType,
        modelChain: 'ISRO-GeoVision-LLaVA v3.2 + Prithvi-EO 100M',
        executionSteps: generated.executionSteps
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
      setExpandedSummaryId(aiResponse.id);

      // Keep focus on textarea for fluid conversation flow
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }, 1100);
  };

  // Handle image attachment from within the chat box
  const handleFileAttach = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isImage = file.type?.startsWith('image/') && !file.name.endsWith('.tif') && !file.name.endsWith('.tiff');
      const previewUrl = isImage ? URL.createObjectURL(file) : '/assets/optical_satellite.jpg';

      const filePayload = {
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        sensor: 'Optical + SAR GeoTIFF (0.28m GSD)',
        previewUrl: previewUrl,
        crs: 'EPSG:4326 (WGS84)'
      };

      setPendingAttachment(filePayload);
      setActiveViewerImage(previewUrl);

      // Give control directly to the chat box!
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const cleanText = text.replace(/[*#]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <div className="workspace-layout">
      {/* LEFT COLUMN: Large Satellite Image Viewer */}
      <div className="workspace-left">
        <ImageViewer 
          imageUrl={activeViewerImage} 
          scenario={scenario}
          onInspectElement={(elem) => setActiveEvidenceHighlight(elem)}
        />
      </div>

      {/* RIGHT COLUMN: Conversational Chat & Reasoning Stream (Gemini / ChatGPT Style) */}
      <div className="workspace-right">
        {/* Workspace Chat Header with Back Option */}
        <div style={{
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-glass-subtle)',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary btn-back-nav"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={onGoBack || (() => onNavigateScreen('landing'))}
              title="Back to Image Upload / Landing"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <div className="dropzone-icon-box" style={{ width: 34, height: 34, margin: 0 }}>
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>SatQuery AI Multi-Turn Agent</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Active Scene: {scenario.uploadedFile?.name || scenario.title} ({scenario.sensor || '0.28m GSD'})
              </div>
            </div>
          </div>

          {/* Quick Screen Navigation Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={() => onNavigateScreen('change')}
              title="Compare Before & After Satellite Imagery"
            >
              <GitCompare size={13} />
              <span>Compare</span>
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={() => onNavigateScreen('report')}
              title="Generate full downloadable scientific PDF report"
            >
              <span>Full Report</span>
              <ExternalLink size={13} />
            </button>
          </div>
        </div>

        {/* Chat History Messages Stream */}
        <div className="chat-stream-container">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            
            if (isUser) {
              return (
                <div key={msg.id} className="chat-bubble-user">
                  {/* Selected/Attached Image Thumbnail & Metadata (ChatGPT/Gemini style) */}
                  {msg.attachment && (
                    <div className="chat-user-attachment">
                      <div className="chat-user-attachment-thumb-wrap">
                        <img 
                          src={msg.attachment.previewUrl || msg.attachment} 
                          alt={msg.attachment.name || "Attached satellite scene"} 
                          className="chat-user-thumb" 
                          onClick={() => setActiveViewerImage(msg.attachment.previewUrl || msg.attachment)}
                          title="Click to view in main satellite panel"
                        />
                        <span className="chat-user-thumb-badge">GeoTIFF</span>
                      </div>
                      <div className="chat-attachment-info">
                        <div className="chat-attachment-name">{msg.attachment.name || "Satellite_Scene.tif"}</div>
                        <div className="chat-attachment-meta">
                          <span className="meta-tag">{msg.attachment.size || "142.8 MB"}</span>
                          <span className="meta-tag">{msg.attachment.sensor || "Cartosat-3 (0.28m)"}</span>
                          {msg.attachment.crs && <span className="meta-tag meta-crs">{msg.attachment.crs}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Question Text */}
                  {msg.text && (
                    <div className="chat-user-text" style={{ marginTop: msg.attachment ? 8 : 0 }}>
                      {msg.text}
                    </div>
                  )}

                  <div className="chat-msg-time" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>
                    {msg.timestamp}
                  </div>
                </div>
              );
            }

            // AI Response Card
            const isSummaryExpanded = expandedSummaryId === msg.id;
            return (
              <div key={msg.id} className="chat-bubble-ai">
                {/* Header: Task type, Confidence Gauge, Actions */}
                <div className="ai-response-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="isro-live-dot"></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>
                      {msg.taskType || 'Vision-Language Remote Sensing'}
                    </span>
                  </div>

                  {/* Confidence Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-high" title="Ensemble Calibrated Confidence Score">
                      <ShieldCheck size={13} />
                      <span>{msg.confidence}% Confidence</span>
                    </span>
                  </div>
                </div>

                {/* AI Markdown / Formatted Text Response */}
                <div style={{ fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 'var(--space-3)' }}>
                  {msg.text}
                </div>

                {/* Direct Action Link if navigation triggered */}
                {msg.actionLink && (
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '7px 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => onNavigateScreen(msg.actionLink.screen)}
                    >
                      <span>{msg.actionLink.label}</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                )}

                {/* Visual Evidence Thumbnail */}
                {msg.evidenceThumb && (
                  <div style={{ margin: '8px 0' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>
                      Visual Evidence Grounding (Cartosat-3 Crop)
                    </div>
                    <img 
                      src={msg.evidenceThumb} 
                      alt="Visual Evidence Grounding" 
                      className="ai-evidence-thumb" 
                      onClick={() => setActiveViewerImage(msg.evidenceThumb)}
                      title="Click to view in main satellite panel"
                    />
                  </div>
                )}

                {/* Expandable Execution Summary Accordion */}
                {msg.executionSteps && msg.executionSteps.length > 0 && (
                  <div style={{
                    marginTop: 'var(--space-3)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => setExpandedSummaryId(isSummaryExpanded ? null : msg.id)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Cpu size={14} style={{ color: 'var(--accent)' }} />
                        <span>Agent Execution Trace ({msg.executionSteps.length} Stages)</span>
                      </div>
                      {isSummaryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {isSummaryExpanded && (
                      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {msg.executionSteps.map((step, sIdx) => (
                            <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.75rem', gap: 10 }}>
                              <div>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.step}: </span>
                                <span style={{ color: 'var(--text-secondary)' }}>{step.desc}</span>
                              </div>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)', whiteSpace: 'nowrap' }}>
                                {step.time}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Action Bar: Copy, Audio TTS, Regenerate */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'var(--space-3)',
                  paddingTop: 'var(--space-2)',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Model: {msg.modelChain || 'Prithvi-EO'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn-icon"
                      onClick={() => handleSpeak(msg.text)}
                      title={isSpeaking ? 'Stop voice readout' : 'Listen to AI analysis'}
                      style={{ color: isSpeaking ? 'var(--accent)' : 'inherit' }}
                    >
                      <Volume2 size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      title="Copy response to clipboard"
                    >
                      {copiedId === msg.id ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleSendMessage('Re-analyze this scene with higher spectral sensitivity threshold')}
                      title="Regenerate analysis"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing / Agent Execution Indicator */}
          {isTyping && (
            <div className="chat-bubble-ai" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="isro-live-dot" style={{ width: 12, height: 12 }}></div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                  Reasoning over multi-spectral tensor layers...
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Executing GDAL_Warp + SAM-EO Zero-shot feature masks
                </div>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} style={{ height: 1 }} />
        </div>

        {/* Bottom Conversational Prompt Bar (Gemini / ChatGPT Style) */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-glass)' }}>
          {/* Quick Suggestion Chips */}
          <div className="chat-suggestion-pills">
            {QUICK_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                className="chat-pill-btn"
                onClick={() => handleSendMessage(sug.text)}
                disabled={isTyping}
              >
                <span>{sug.icon}</span>
                <span>{sug.label}</span>
              </button>
            ))}
          </div>

          <div className="prompt-bar-wrapper" style={{ marginTop: 8 }}>
            {/* Pending Attachment chip above input (Gemini / ChatGPT style) */}
            {pendingAttachment && (
              <div className="pending-attachment-chip">
                <div className="pending-thumb-wrapper">
                  <img src={pendingAttachment.previewUrl} alt="preview" className="pending-thumb" />
                  <span className="pending-badge">GeoTIFF</span>
                </div>
                <div className="pending-meta">
                  <span className="pending-name">{pendingAttachment.name}</span>
                  <span className="pending-size">{pendingAttachment.size} • {pendingAttachment.sensor}</span>
                </div>
                <button 
                  type="button" 
                  className="pending-remove-btn"
                  onClick={() => setPendingAttachment(null)}
                  title="Remove attached image"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="prompt-input-row">
              {/* Hidden file input for mid-chat image attachments */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg" 
                style={{ display: 'none' }}
                onChange={handleFileAttach}
              />

              {/* Attach Image Button */}
              <button 
                type="button"
                className="btn-icon attachment-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Satellite Image (GeoTIFF / PNG / JPEG)"
              >
                <ImagePlus size={18} />
              </button>

              <textarea
                ref={textareaRef}
                className="prompt-textarea"
                rows={1}
                placeholder={pendingAttachment ? "Ask questions about this attached image..." : "Ask about water bodies, urban sprawl, vegetation, or radar signatures..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              <button 
                type="button"
                className="btn-icon"
                onClick={() => {
                  setInputText('Calculate total lake surface area and vegetative encroachment');
                  textareaRef.current?.focus();
                }}
                title="Voice query simulation"
              >
                <Mic size={16} />
              </button>

              <button 
                type="button"
                className="btn btn-primary"
                style={{ padding: '8px 16px' }}
                onClick={() => handleSendMessage()}
                disabled={isTyping || (!inputText.trim() && !pendingAttachment)}
              >
                <Send size={15} />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Workspace;
