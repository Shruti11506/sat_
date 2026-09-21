// Mock data & pre-loaded scenarios for SatQuery AI

export const SATELLITE_SCENARIOS = [
  {
    id: 'bengaluru-urban',
    title: 'Bengaluru Tech Corridor & Lakes',
    subtitle: 'Cartosat-3 Optical (0.28m) + RISAT-1A SAR',
    location: '12°58′23″N, 77°35′45″E | EPSG:4326',
    date: '14 Feb 2026 05:42:10 UTC',
    opticalImg: '/assets/optical_satellite.jpg',
    sarImg: '/assets/sar_radar.jpg',
    fusionImg: '/assets/fusion_output.jpg',
    beforeImg: '/assets/temporal_before_2021.jpg',
    afterImg: '/assets/temporal_after_2026.jpg',
    cloudCover: '3.8%',
    resolution: '0.28m GSD PAN / 1.12m MS',
    sensor: 'Cartosat-3 + RISAT-1A C-band',
    overallConfidence: 96.4,
    landCover: [
      { label: 'Vegetation / Canopy', percent: 42, color: '#22c55e' },
      { label: 'Built-up / Concrete', percent: 34, color: '#f59e0b' },
      { label: 'Water Reservoirs', percent: 16, color: '#38bdf8' },
      { label: 'Barren / Open Soil', percent: 8, color: '#a855f7' },
    ],
    objects: [
      { type: 'Commercial Buildings', count: 142, icon: 'Building' },
      { type: 'Water Reservoirs', count: 4, icon: 'Droplets' },
      { type: 'Bridges & Flyovers', count: 6, icon: 'GitCommit' },
      { type: 'Transit Corridors', count: 18, icon: 'Milestone' }
    ],
    indices: {
      ndvi: '+0.68 (Healthy Vegetation)',
      ndwi: '+0.54 (Deep Open Water)',
      ndbi: '+0.32 (Dense Built-up)',
      sarBackscatter: '-14.8 dB (Roughness average)'
    },
    changeMetrics: {
      builtUpChange: '+14.2%',
      vegetationChange: '-8.6%',
      waterExpansion: '+3.1%',
      timeRange: '2021 — 2026 (5-Year Bi-temporal Delta)',
      summary: 'High-density urban development observed encroaching the northwestern buffer zone. 18.4 hectares of natural grassland converted to paved logistics and residential complexes.'
    },
    boundingBoxes: [
      { id: 'b1', label: 'Primary Reservoir (Ulsoor)', box: { x: 8, y: 34, w: 20, h: 26 }, type: 'water', conf: 98.6, note: 'Area: 1.48 km² | Deep clear water' },
      { id: 'b2', label: 'Secondary Catchment Lake', box: { x: 12, y: 76, w: 38, h: 22 }, type: 'water', conf: 97.2, note: 'Area: 2.10 km² | Eutrophic margins' },
      { id: 'b3', label: 'Urban Grid Cluster (High Density)', box: { x: 12, y: 7, w: 32, h: 24 }, type: 'urban', conf: 96.1, note: '84 Concrete Structures | SAR Double-bounce' },
      { id: 'b4', label: 'Arterial Ring Expressway', box: { x: 35, y: 1, w: 38, h: 95 }, type: 'infra', conf: 95.8, note: 'Multi-lane Highway + Flyover' },
      { id: 'b5', label: 'Botanical Reserve & Canopy', box: { x: 50, y: 48, w: 35, h: 25 }, type: 'veg', conf: 99.1, note: 'High NDVI (+0.74) Dense Canopy' }
    ],
    chatHistory: [
      {
        id: 'c1',
        sender: 'user',
        text: 'Analyze the water bodies and recent infrastructure expansion in this region. Are there any flood risk buffer encroachments?',
        timestamp: '11:42 AM'
      },
      {
        id: 'c2',
        sender: 'ai',
        text: 'I completed a multimodal analysis using **Cartosat-3 Optical (0.28m)** paired with **RISAT-1A C-band SAR**.\n\nKey Findings:\n1. **Water Bodies**: Identified 2 primary reservoirs with total surface area of **3.58 km²**. NDWI confirms water clarity index of +0.54.\n2. **Buffer Zone Encroachment**: Concrete surface coverage (NDBI +0.32) encroached 120m into the historical secondary catchment zone.\n3. **Radar Infiltration**: SAR cross-polarization (VH) indicates saturated subsurface soils along the eastern drainage canal, presenting moderate monsoon overflow vulnerability.',
        confidence: 96.4,
        timestamp: '11:43 AM',
        evidenceThumb: '/assets/optical_satellite.jpg',
        taskType: 'Vision-Language VQA & Segmentation',
        modelChain: 'ISRO-GeoVision-LLaVA v3.2 + Prithvi-EO 100M',
        executionSteps: [
          { step: 'Input Validation', desc: 'GeoTIFF EPSG:4326 metadata verified. 0 no-data pixels detected.', status: 'completed', time: '12ms', model: 'GDAL Core' },
          { step: 'Metadata Detection', desc: 'Sensor Cartosat-3 detected. 4 spectral bands calibrated (Blue, Green, Red, NIR).', status: 'completed', time: '24ms', model: 'MetadataEngine' },
          { step: 'Task Classification', desc: 'Identified complex multi-intent: Water body extraction + Urban encroachment VQA.', status: 'completed', time: '48ms', model: 'IntentClassifier-LLM' },
          { step: 'Model Selection', desc: 'Selected ISRO-GeoVision-LLaVA v3 with SAM-EO zero-shot segmentation head.', status: 'completed', time: '15ms', model: 'Router-v2' },
          { step: 'Tool Execution', desc: 'Ran Normalized Difference Water Index (NDWI) and RISAT SAR speckle filter (Lee 5x5).', status: 'completed', time: '142ms', model: 'BandRatioEngine' },
          { step: 'Confidence Estimation', desc: 'Monte-Carlo dropout ensemble variance 0.036. Calibrated score: 96.4%.', status: 'completed', time: '35ms', model: 'EnsembleScorer' },
          { step: 'Final Response Generation', desc: 'Evidence-grounded spatial narrative compiled with exact lat/long bounding coordinates.', status: 'completed', time: '88ms', model: 'GeoLLM-Reasoner' },
        ]
      }
    ]
  },
  {
    id: 'chilika-wetland',
    title: 'Chilika Lagoon Brackish Ecosystem',
    subtitle: 'Sentinel-2 L2A + Sentinel-1 SAR',
    location: '19°43′15″N, 85°20′45″E | EPSG:32645',
    date: '02 Mar 2026 04:15:22 UTC',
    opticalImg: '/assets/temporal_before_2021.jpg',
    sarImg: '/assets/sar_radar.jpg',
    fusionImg: '/assets/fusion_output.jpg',
    beforeImg: '/assets/temporal_before_2021.jpg',
    afterImg: '/assets/temporal_after_2026.jpg',
    cloudCover: '1.2%',
    resolution: '10m Multi-spectral',
    sensor: 'Sentinel-2 MSI + RISAT-1A',
    overallConfidence: 94.8,
    landCover: [
      { label: 'Brackish Water', percent: 62, color: '#38bdf8' },
      { label: 'Wetland Flora', percent: 24, color: '#22c55e' },
      { label: 'Tidal Sandflats', percent: 10, color: '#f59e0b' },
      { label: 'Coastal Villages', percent: 4, color: '#a855f7' },
    ],
    objects: [
      { type: 'Aquaculture Enclosures', count: 76, icon: 'Grid' },
      { type: 'Fishing Vessels', count: 32, icon: 'Anchor' },
      { type: 'Sandbars & Inlets', count: 8, icon: 'Waves' },
      { type: 'Mangrove Patches', count: 19, icon: 'Trees' }
    ],
    indices: {
      ndvi: '+0.52 (Mangrove & Marsh)',
      ndwi: '+0.81 (Brackish Estuary)',
      ndbi: '-0.28 (Minimal Concrete)',
      sarBackscatter: '-18.2 dB (Smooth Water)'
    },
    changeMetrics: {
      builtUpChange: '+3.1%',
      vegetationChange: '+4.2%',
      waterExpansion: '-1.4%',
      timeRange: '2021 — 2026 (Hydrological Cycle)',
      summary: 'Expansion of wetland reed beds observed in Nalabana sanctuary. Aquaculture barricade expansion detected along the northern channel via radar specular anomalies.'
    },
    boundingBoxes: [
      { id: 'c1', label: 'Nalabana Island Bird Sanctuary', box: { x: 30, y: 35, w: 40, h: 30 }, type: 'veg', conf: 97.4, note: 'Protected wetland zone' },
      { id: 'c2', label: 'Northern Fishing Aquaculture Pens', box: { x: 10, y: 15, w: 25, h: 25 }, type: 'urban', conf: 92.8, note: 'Illegal nylon pen structures' }
    ],
    chatHistory: [
      {
        id: 'ch1',
        sender: 'user',
        text: 'Identify aquaculture boundary violations in the protected migratory sector.',
        timestamp: '09:12 AM'
      },
      {
        id: 'ch2',
        sender: 'ai',
        text: 'Analysis detected **76 aquaculture enclosures** occupying 3.84 km² within the buffer zone. SAR backscatter highlights reflective stakes and net lines undetectable in optical cloudy conditions.',
        confidence: 94.8,
        timestamp: '09:13 AM',
        evidenceThumb: '/assets/temporal_before_2021.jpg',
        taskType: 'Maritime & Wetland Object Detection',
        modelChain: 'ISRO-GeoVision-LLaVA v3.2 + SAM-EO',
        executionSteps: [
          { step: 'Input Validation', desc: 'Sentinel-2 cloud mask checked. Clear observation conditions.', status: 'completed', time: '10ms', model: 'GDAL Core' },
          { step: 'Metadata Detection', desc: 'EPSG:32645 UTM Zone 45N projected.', status: 'completed', time: '18ms', model: 'MetadataEngine' },
          { step: 'Task Classification', desc: 'Maritime structure localization + legal boundary cross-referencing.', status: 'completed', time: '42ms', model: 'IntentClassifier-LLM' },
          { step: 'Model Selection', desc: 'SAR CFAR detector + Vision-Language validation model.', status: 'completed', time: '16ms', model: 'Router-v2' },
          { step: 'Tool Execution', desc: 'Extracted high-frequency specular radar peaks.', status: 'completed', time: '135ms', model: 'SAR-CFAR' },
          { step: 'Confidence Estimation', desc: 'Ensemble score 94.8% with 0.95 IOU bounding accuracy.', status: 'completed', time: '30ms', model: 'EnsembleScorer' },
          { step: 'Final Response Generation', desc: 'Generated geo-tagged infraction report.', status: 'completed', time: '75ms', model: 'GeoLLM-Reasoner' },
        ]
      }
    ]
  }
];

export const SUGGESTED_QUERIES = [
  'Describe this satellite scene in detail',
  'Detect land-cover distribution and vegetation health',
  'Compare Optical RGB with SAR radar penetration',
  'Detect 5-year bi-temporal urban & water changes',
  'Highlight water bodies and flood inundation risk',
  'Identify all road networks and industrial clusters'
];
