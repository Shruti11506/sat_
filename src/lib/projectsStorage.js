/**
 * SatQuery AI - ChatGPT-Style Projects Storage & Manager
 * Allows grouping conversations, custom instructions, and AOI knowledge files
 * in dedicated project workspaces.
 */

const STORAGE_KEY_PROJECTS = 'satquery-projects';
const STORAGE_KEY_ACTIVE_PROJECT = 'satquery-active-project-id';

export const PRESET_PROJECTS = [
  {
    id: 'proj-disaster-relief',
    name: 'Sentinel-2 Disaster Relief AOI',
    description: 'Emergency flood response, inundated zone extraction, and critical evacuation route mapping across floodplains.',
    icon: '🚨',
    color: '#ef4444',
    customInstructions: 'You are an emergency disaster relief remote sensing intelligence specialist. Always calculate flood inundation boundaries using NDWI, prioritize detecting severed bridges and submerged road networks, and report affected area in square kilometers with 95% confidence intervals.',
    knowledgeFiles: [
      { id: 'kf-1', name: 'Assam_Flood_AOI_ZoneB.geojson', size: '1.4 MB', type: 'vector', date: '2026-09-21' },
      { id: 'kf-2', name: 'Disaster_Relief_Standard_Operating_Procedure.pdf', size: '3.8 MB', type: 'document', date: '2026-09-22' },
      { id: 'kf-3', name: 'Brahmaputra_Basin_Elevation_DEM.tif', size: '18.2 MB', type: 'raster', date: '2026-09-23' }
    ],
    conversationIds: [],
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-24T14:30:00Z'
  },
  {
    id: 'proj-urban-cadastral',
    name: 'Urban Growth & Cadastral 2026',
    description: 'Metropolitan municipal boundary monitoring, informal settlement expansion, and building footprint density analysis.',
    icon: '🏙️',
    color: '#3b82f6',
    customInstructions: 'Analyze municipal satellite scenes for cadastral compliance. Cross-reference SAR double-bounce radar backscatter with optical Cartosat bands to count building structures and flag unauthorized encroachments beyond the designated green buffer zone.',
    knowledgeFiles: [
      { id: 'kf-4', name: 'Metro_Cadastral_MasterPlan_2026.geojson', size: '5.2 MB', type: 'vector', date: '2026-09-18' },
      { id: 'kf-5', name: 'Building_Density_Threshold_Guidelines.pdf', size: '2.1 MB', type: 'document', date: '2026-09-19' }
    ],
    conversationIds: [],
    createdAt: '2026-09-18T08:30:00Z',
    updatedAt: '2026-09-25T11:15:00Z'
  },
  {
    id: 'proj-wetlands-coastal',
    name: 'Coastal Wetlands & NDWI Index',
    description: 'Sundarbans coastal erosion, tidal inundation cycles, and mangrove canopy health monitoring using high-res multispectral imagery.',
    icon: '🌊',
    color: '#06b6d4',
    customInstructions: 'Focus on coastal wetland ecology. Compute NDVI canopy health metrics and compare with historical shoreline vectors. Flag areas with severe mangrove dieback or siltation in tidal river deltas.',
    knowledgeFiles: [
      { id: 'kf-6', name: 'Sundarbans_Tidal_Zones_EPSG4326.shp', size: '8.4 MB', type: 'vector', date: '2026-09-15' },
      { id: 'kf-7', name: 'Coastal_Salinity_GroundTruth_Data.csv', size: '420 KB', type: 'tabular', date: '2026-09-17' }
    ],
    conversationIds: [],
    createdAt: '2026-09-15T12:00:00Z',
    updatedAt: '2026-09-23T16:45:00Z'
  }
];

export function getStoredProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(PRESET_PROJECTS));
      return PRESET_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : PRESET_PROJECTS;
  } catch (err) {
    console.warn('[SatQuery] Error loading stored projects, falling back to presets:', err);
    return PRESET_PROJECTS;
  }
}

export function saveStoredProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch (err) {
    console.error('[SatQuery] Error saving projects to localStorage:', err);
  }
}

export function getActiveProjectId() {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT) || null;
  } catch {
    return null;
  }
}

export function setActiveProjectId(id) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_PROJECT);
    }
  } catch (err) {
    console.error('[SatQuery] Error setting active project id:', err);
  }
}

export function getActiveProject() {
  const projects = getStoredProjects();
  const activeId = getActiveProjectId();
  if (!activeId) return null;
  return projects.find(p => p.id === activeId) || null;
}

export function createProject(projectData) {
  const projects = getStoredProjects();
  const newProject = {
    id: `proj-${Date.now()}`,
    name: projectData.name || 'Untitled Project',
    description: projectData.description || '',
    icon: projectData.icon || '📁',
    color: projectData.color || '#3b82f6',
    customInstructions: projectData.customInstructions || '',
    knowledgeFiles: projectData.knowledgeFiles || [],
    conversationIds: projectData.conversationIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const updated = [newProject, ...projects];
  saveStoredProjects(updated);
  return newProject;
}

export function updateProject(projectId, updates) {
  const projects = getStoredProjects();
  const updated = projects.map(p => {
    if (p.id === projectId) {
      return {
        ...p,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });
  saveStoredProjects(updated);
  return updated.find(p => p.id === projectId) || null;
}

export function deleteProject(projectId) {
  const projects = getStoredProjects();
  const updated = projects.filter(p => p.id !== projectId);
  saveStoredProjects(updated);
  if (getActiveProjectId() === projectId) {
    setActiveProjectId(null);
  }
  return updated;
}

export function addChatToProject(projectId, conversationId) {
  if (!projectId || !conversationId) return;
  const projects = getStoredProjects();
  const updated = projects.map(p => {
    if (p.id === projectId) {
      const ids = p.conversationIds || [];
      if (!ids.includes(conversationId)) {
        return {
          ...p,
          conversationIds: [conversationId, ...ids],
          updatedAt: new Date().toISOString()
        };
      }
    }
    return p;
  });
  saveStoredProjects(updated);
}

export function addKnowledgeFileToProject(projectId, fileData) {
  const projects = getStoredProjects();
  const updated = projects.map(p => {
    if (p.id === projectId) {
      const files = p.knowledgeFiles || [];
      return {
        ...p,
        knowledgeFiles: [
          {
            id: `kf-${Date.now()}`,
            name: fileData.name,
            size: fileData.size,
            type: fileData.type || 'document',
            date: new Date().toISOString().split('T')[0]
          },
          ...files
        ],
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });
  saveStoredProjects(updated);
}

export function removeKnowledgeFileFromProject(projectId, fileId) {
  const projects = getStoredProjects();
  const updated = projects.map(p => {
    if (p.id === projectId) {
      return {
        ...p,
        knowledgeFiles: (p.knowledgeFiles || []).filter(f => f.id !== fileId),
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });
  saveStoredProjects(updated);
}
