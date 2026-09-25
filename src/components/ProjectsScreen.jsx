import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, Plus, Search, MessageSquare, FileText, 
  Trash2, Edit3, ArrowLeft, ExternalLink, Calendar, 
  Sparkles, Check, Sliders, Upload, ShieldCheck, 
  HardDrive, FileUp, X, FolderTree, Layers, ChevronRight
} from 'lucide-react';
import { 
  getStoredProjects, saveStoredProjects, getActiveProjectId, 
  setActiveProjectId, createProject, updateProject, deleteProject,
  addKnowledgeFileToProject, removeKnowledgeFileFromProject 
} from '../lib/projectsStorage';

const EMOJI_OPTIONS = ['📁', '🚨', '🏙️', '🌊', '🌾', '🛰️', '🌋', '🚢', '🗺️', '🌲'];
const COLOR_OPTIONS = ['#3b82f6', '#ef4444', '#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899'];

const INSTRUCTION_PRESETS = [
  {
    title: 'Disaster Rapid Response',
    text: 'You are an emergency disaster relief remote sensing specialist. Always calculate flood inundation boundaries using NDWI, prioritize detecting severed bridges and submerged road networks, and report affected area in square kilometers with 95% confidence intervals.'
  },
  {
    title: 'Cadastral & Urban Compliance',
    text: 'Analyze municipal satellite scenes for cadastral compliance. Cross-reference SAR double-bounce radar backscatter with optical Cartosat bands to count building structures and flag unauthorized encroachments beyond the designated green buffer zone.'
  },
  {
    title: 'Coastal Wetlands Ecology',
    text: 'Focus on coastal wetland ecology. Compute NDVI canopy health metrics and compare with historical shoreline vectors. Flag areas with severe mangrove dieback or siltation in tidal river deltas.'
  },
  {
    title: 'Agricultural Crop & NDVI Health',
    text: 'Analyze vegetation health indices (NDVI, SAVI, NDRE). Classify crop vigor, flag drought/water stress patterns, and calculate estimated yield variance across agricultural parcels.'
  }
];

export function ProjectsScreen({ onGoBack, onStartProjectChat, onOpenConversation }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'instructions' | 'files'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectIcon, setProjectIcon] = useState('📁');
  const [projectColor, setProjectColor] = useState('#3b82f6');
  const [projectInstructions, setProjectInstructions] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // File Upload State inside Project
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  useEffect(() => {
    const loaded = getStoredProjects();
    setProjects(loaded);
    const activeId = getActiveProjectId();
    if (activeId) {
      const found = loaded.find(p => p.id === activeId);
      if (found) setActiveProject(found);
    }
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleOpenProject = (proj) => {
    setActiveProject(proj);
    setActiveProjectId(proj.id);
    setActiveTab('chats');
  };

  const handleBackToAllProjects = () => {
    setActiveProject(null);
    setActiveProjectId(null);
  };

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setProjectName('');
    setProjectDesc('');
    setProjectIcon('📁');
    setProjectColor('#3b82f6');
    setProjectInstructions('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proj, e) => {
    e?.stopPropagation();
    setEditingProject(proj);
    setProjectName(proj.name);
    setProjectDesc(proj.description || '');
    setProjectIcon(proj.icon || '📁');
    setProjectColor(proj.color || '#3b82f6');
    setProjectInstructions(proj.customInstructions || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    if (editingProject) {
      const updated = updateProject(editingProject.id, {
        name: projectName.trim(),
        description: projectDesc.trim(),
        icon: projectIcon,
        color: projectColor,
        customInstructions: projectInstructions.trim()
      });
      const all = getStoredProjects();
      setProjects(all);
      if (activeProject?.id === editingProject.id) {
        setActiveProject(updated);
      }
      showToast(`Project "${projectName}" updated successfully.`);
    } else {
      const created = createProject({
        name: projectName.trim(),
        description: projectDesc.trim(),
        icon: projectIcon,
        color: projectColor,
        customInstructions: projectInstructions.trim(),
        knowledgeFiles: [],
        conversationIds: []
      });
      const all = getStoredProjects();
      setProjects(all);
      setActiveProject(created);
      setActiveProjectId(created.id);
      showToast(`New Project "${projectName}" created!`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteProject = (projId, e) => {
    e?.stopPropagation();
    const updated = deleteProject(projId);
    setProjects(updated);
    if (activeProject?.id === projId) {
      setActiveProject(null);
    }
    showToast('Project deleted.');
  };

  const handleSaveInstructions = () => {
    if (!activeProject) return;
    const updated = updateProject(activeProject.id, {
      customInstructions: projectInstructions
    });
    setActiveProject(updated);
    setProjects(getStoredProjects());
    showToast('Project custom instructions saved.');
  };

  const handleFileUpload = (e) => {
    if (!activeProject || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    let type = 'document';
    if (file.name.endsWith('.geojson') || file.name.endsWith('.shp')) type = 'vector';
    if (file.name.endsWith('.tif') || file.name.endsWith('.tiff')) type = 'raster';

    setIsUploadingFile(true);
    setTimeout(() => {
      addKnowledgeFileToProject(activeProject.id, {
        name: file.name,
        size: sizeMb,
        type
      });
      const all = getStoredProjects();
      setProjects(all);
      const refreshed = all.find(p => p.id === activeProject.id);
      setActiveProject(refreshed);
      setIsUploadingFile(false);
      showToast(`File "${file.name}" added to project knowledge base.`);
    }, 400);
  };

  const handleRemoveFile = (fileId) => {
    if (!activeProject) return;
    removeKnowledgeFileFromProject(activeProject.id, fileId);
    const all = getStoredProjects();
    setProjects(all);
    const refreshed = all.find(p => p.id === activeProject.id);
    setActiveProject(refreshed);
    showToast('Knowledge file removed.');
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="projects-screen">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="model-toast animate-fadeIn">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Screen Header */}
      <div className="projects-header">
        <div className="header-left">
          <button 
            onClick={activeProject ? handleBackToAllProjects : onGoBack} 
            className="btn btn-secondary btn-icon-back"
            title="Go back"
          >
            <ArrowLeft size={16} />
            <span>{activeProject ? 'All Projects' : 'Back'}</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="screen-title">
                {activeProject ? activeProject.name : 'Projects'}
              </h2>
              <span className="badge-pill badge-pill-cyan">ChatGPT-Style Workspaces</span>
            </div>
            <p className="screen-subtitle">
              {activeProject 
                ? (activeProject.description || 'Dedicated project workspace for conversations, custom instructions, and knowledge files.')
                : 'Organize satellite intelligence, custom instructions, and AOI knowledge bases in dedicated project workspaces.'}
            </p>
          </div>
        </div>

        <div className="header-right">
          {activeProject ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => handleOpenEditModal(activeProject, e)}
                className="btn btn-secondary"
                title="Edit project details"
              >
                <Edit3 size={15} />
                <span>Edit Project</span>
              </button>
              <button 
                onClick={() => onStartProjectChat?.(activeProject)}
                className="btn btn-primary"
                title="Start a new chat inside this project"
              >
                <Plus size={15} />
                <span>New Project Chat</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              title="Create a new project workspace"
            >
              <Plus size={16} />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* View 1: All Projects Grid */}
      {!activeProject && (
        <div className="projects-catalog-container">
          {/* Search Bar */}
          <div className="projects-search-bar">
            <Search size={16} className="search-icon" />
            <input 
              type="text"
              placeholder="Search projects by name, mission, or AOI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Grid of Projects */}
          <div className="projects-grid">
            {filteredProjects.map((proj) => (
              <div 
                key={proj.id}
                onClick={() => handleOpenProject(proj)}
                className="project-card"
              >
                <div className="card-header">
                  <div 
                    className="project-icon-badge"
                    style={{ backgroundColor: `${proj.color || '#3b82f6'}20`, color: proj.color || '#3b82f6' }}
                  >
                    <span className="text-xl">{proj.icon || '📁'}</span>
                  </div>

                  <div className="card-menu-actions">
                    <button 
                      onClick={(e) => handleOpenEditModal(proj, e)}
                      className="btn-icon-subtle"
                      title="Edit project"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      className="btn-icon-subtle text-red-400 hover:text-red-300"
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="project-title">{proj.name}</h3>
                <p className="project-desc">{proj.description || 'No description provided.'}</p>

                <div className="project-meta-badges">
                  <span className="meta-badge">
                    <MessageSquare size={12} />
                    <span>{proj.conversationIds?.length || 0} Chats</span>
                  </span>
                  <span className="meta-badge">
                    <FileText size={12} />
                    <span>{proj.knowledgeFiles?.length || 0} Files</span>
                  </span>
                  {proj.customInstructions && (
                    <span className="meta-badge badge-has-instructions" title="Has custom instructions configured">
                      <Sparkles size={11} />
                      <span>Custom Prompt</span>
                    </span>
                  )}
                </div>

                <div className="card-footer">
                  <span className="updated-text">
                    Updated {proj.updatedAt ? new Date(proj.updatedAt).toLocaleDateString() : 'recently'}
                  </span>
                  <div className="open-arrow">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Create Card */}
            <div 
              onClick={handleOpenCreateModal}
              className="project-card create-new-card"
            >
              <div className="create-card-inner">
                <div className="plus-icon-circle">
                  <Plus size={24} />
                </div>
                <h4 className="font-semibold text-base mb-1">Create New Project</h4>
                <p className="text-xs text-muted text-center max-w-xs">
                  Set up custom instructions, attach AOI datasets, and isolate conversations for your mission.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Project Detail / Active Project Workspace */}
      {activeProject && (
        <div className="active-project-workspace">
          {/* Workspace Tabs */}
          <div className="project-tabs-nav">
            <button 
              onClick={() => setActiveTab('chats')}
              className={`project-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            >
              <MessageSquare size={15} />
              <span>Project Chats ({activeProject.conversationIds?.length || 0})</span>
            </button>

            <button 
              onClick={() => {
                setActiveTab('instructions');
                setProjectInstructions(activeProject.customInstructions || '');
              }}
              className={`project-tab-btn ${activeTab === 'instructions' ? 'active' : ''}`}
            >
              <Sparkles size={15} />
              <span>Custom Instructions</span>
              {activeProject.customInstructions && (
                <span className="tab-dot-active"></span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('files')}
              className={`project-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            >
              <HardDrive size={15} />
              <span>Project Knowledge Files ({activeProject.knowledgeFiles?.length || 0})</span>
            </button>
          </div>

          {/* Tab 1: Project Chats */}
          {activeTab === 'chats' && (
            <div className="project-tab-content">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="tab-heading">Conversations in this Project</h3>
                  <p className="tab-sub">All chats in this workspace automatically inherit this project's instructions and knowledge base.</p>
                </div>
                <button 
                  onClick={() => onStartProjectChat?.(activeProject)}
                  className="btn btn-primary"
                >
                  <Plus size={15} />
                  <span>Start New Chat</span>
                </button>
              </div>

              {activeProject.conversationIds && activeProject.conversationIds.length > 0 ? (
                <div className="project-chats-list">
                  {activeProject.conversationIds.map((cId, idx) => (
                    <div 
                      key={cId}
                      onClick={() => onOpenConversation?.({ id: cId, title: `Project Chat #${idx + 1}` })}
                      className="project-chat-row"
                    >
                      <div className="flex items-center gap-3">
                        <div className="chat-row-icon">
                          <MessageSquare size={16} className="text-blue-400" />
                        </div>
                        <div>
                          <h4 className="chat-row-title">Conversation #{cId.slice(0, 8)}</h4>
                          <span className="chat-row-meta">Tied to {activeProject.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="btn btn-xs btn-secondary">Open</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-box">
                  <div className="empty-icon-circle">
                    <MessageSquare size={32} className="text-muted" />
                  </div>
                  <h4 className="text-base font-semibold mb-1">No chats in this project yet</h4>
                  <p className="text-xs text-muted max-w-sm mb-4 text-center">
                    Start a conversation that specifically references this project's custom instructions and attached knowledge files.
                  </p>
                  <button 
                    onClick={() => onStartProjectChat?.(activeProject)}
                    className="btn btn-primary"
                  >
                    <Plus size={15} />
                    <span>Start First Project Chat</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Custom Instructions (ChatGPT-style) */}
          {activeTab === 'instructions' && (
            <div className="project-tab-content">
              <div className="mb-4">
                <h3 className="tab-heading">ChatGPT-Style Custom Project Instructions</h3>
                <p className="tab-sub">
                  What would you like SatQuery AI to know about this project and how should it formulate answers?
                </p>
              </div>

              {/* Instructions Presets */}
              <div className="mb-3">
                <span className="text-xs text-muted block mb-2 font-medium">Quick Preset Templates:</span>
                <div className="flex flex-wrap gap-2">
                  {INSTRUCTION_PRESETS.map((preset, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={() => setProjectInstructions(preset.text)}
                      className="btn btn-xs btn-secondary"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="instructions-card">
                <label className="form-label font-semibold flex items-center justify-between">
                  <span>Custom System Instructions for this Project:</span>
                  <span className="text-xs text-muted font-normal">Injected automatically into every query prompt</span>
                </label>
                <textarea 
                  rows={8}
                  value={projectInstructions}
                  onChange={(e) => setProjectInstructions(e.target.value)}
                  placeholder="E.g., You are an expert satellite remote sensing analyst working on cadastral zoning. Always calculate high-precision rooftop counts using SAR double-bounce backscatter and Cartosat-3 optical bands..."
                  className="form-textarea-instructions"
                />

                <div className="flex justify-end mt-3">
                  <button 
                    onClick={handleSaveInstructions}
                    className="btn btn-primary"
                  >
                    <Check size={15} />
                    <span>Save Instructions</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Knowledge Files */}
          {activeTab === 'files' && (
            <div className="project-tab-content">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="tab-heading">Project Knowledge Base & Files</h3>
                  <p className="tab-sub">Upload GeoJSON AOIs, shapefiles, DEM elevation rasters, or technical PDFs to provide context for this project.</p>
                </div>
                <label className="btn btn-primary cursor-pointer">
                  <FileUp size={15} />
                  <span>Upload Knowledge File</span>
                  <input 
                    type="file" 
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {activeProject.knowledgeFiles && activeProject.knowledgeFiles.length > 0 ? (
                <div className="knowledge-files-grid">
                  {activeProject.knowledgeFiles.map((file) => (
                    <div key={file.id} className="knowledge-file-card">
                      <div className="flex items-center gap-3">
                        <div className="file-icon-box">
                          <FileText size={18} className="text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="file-title">{file.name}</h4>
                          <span className="file-meta">{file.size} • {file.type} • {file.date}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleRemoveFile(file.id)}
                        className="btn-icon-subtle text-red-400 hover:text-red-300"
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-box">
                  <div className="empty-icon-circle">
                    <HardDrive size={32} className="text-muted" />
                  </div>
                  <h4 className="text-base font-semibold mb-1">No knowledge files uploaded</h4>
                  <p className="text-xs text-muted max-w-sm mb-4 text-center">
                    Upload AOI vector polygons, mission briefs, or reference rasters to enrich queries run in this project.
                  </p>
                  <label className="btn btn-primary cursor-pointer">
                    <FileUp size={15} />
                    <span>Upload First File</span>
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-scaleUp" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-icon-subtle">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="modal-body">
                {/* Project Name */}
                <div className="form-group mb-3">
                  <label className="form-label">Project Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="E.g., Sentinel-2 Disaster Relief AOI"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Description */}
                <div className="form-group mb-3">
                  <label className="form-label">Description (Optional)</label>
                  <input 
                    type="text"
                    placeholder="Brief objective of this satellite intelligence project..."
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Emoji Icon & Color */}
                <div className="form-row mb-3">
                  <div className="flex-1">
                    <label className="form-label">Icon</label>
                    <div className="emoji-picker-row">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button 
                          key={emoji}
                          type="button"
                          onClick={() => setProjectIcon(emoji)}
                          className={`emoji-btn ${projectIcon === emoji ? 'selected' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Color Theme</label>
                    <div className="color-picker-row">
                      {COLOR_OPTIONS.map((c) => (
                        <button 
                          key={c}
                          type="button"
                          onClick={() => setProjectColor(c)}
                          className={`color-dot-btn ${projectColor === c ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom Instructions */}
                <div className="form-group">
                  <label className="form-label">Project Custom Instructions</label>
                  <textarea 
                    rows={4}
                    placeholder="Specialized instructions for how SatQuery AI should respond to questions in this project..."
                    value={projectInstructions}
                    onChange={(e) => setProjectInstructions(e.target.value)}
                    className="form-textarea-sm"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
