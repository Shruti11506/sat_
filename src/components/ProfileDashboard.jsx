import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  MessageSquare,
  PencilLine,
  Radar,
  RefreshCw,
  Satellite,
  ScanSearch,
  Sparkles,
  Star,
  Trash2,
  Upload,
  XCircle,
  Zap
} from 'lucide-react';
import {
  getProfileDashboard,
  updateProfile,
  uploadProfileAvatar,
  removeProfileAvatar
} from '../lib/apiClient';
import './ProfileDashboard.css';

// Profile / analytics screen. Every value comes from GET /profile/dashboard
// (aggregated from stored rows in Postgres); a failed load shows an error,
// never sample numbers. See backend/app/services/profile_service.py.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Colour level thresholds per view: [low, medium, high] lower bounds.
// Daily follows 1-2 / 3-5 / 6+ queries.
const LEVELS = {
  daily: [1, 3, 6],
  weekly: [1, 5, 15],
  monthly: [1, 10, 30]
};

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function levelFor(count, thresholds) {
  if (!count) return 0;
  if (count >= thresholds[2]) return 3;
  if (count >= thresholds[1]) return 2;
  return 1;
}

// "YYYY-MM-DD" as a LOCAL calendar date (new Date(iso) would parse it as UTC).
function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStamp(iso) {
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function plural(n, word) {
  if (n === 1) return `${n} ${word}`;
  // query -> queries, but day -> days
  return `${n} ${/[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`}`;
}

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function planLabel(plan) {
  const value = plan || 'free';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} Plan`;
}

function Avatar({ user, previewUrl, small = false }) {
  const src = previewUrl ?? user?.avatar_url;
  return (
    <div className={`pf-avatar${small ? ' pf-avatar-sm' : ''}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initialsOf(user?.display_name)}
    </div>
  );
}

// ---- Heatmap -----------------------------------------------------------------

function buildWeeks(activity) {
  const weeks = [];
  for (let i = 0; i < activity.length; i += 7) {
    const days = activity.slice(i, i + 7).map((d) => ({ ...d, day: parseDay(d.date) }));
    weeks.push({
      days,
      start: days[0].day,
      total: days.reduce((sum, d) => sum + d.query_count, 0)
    });
  }
  return weeks;
}

function buildMonths(activity) {
  const months = [];
  activity.forEach((d) => {
    const day = parseDay(d.date);
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = months[months.length - 1];
    if (last && last.key === key) last.total += d.query_count;
    else months.push({ key, month: day.getMonth(), year: day.getFullYear(), total: d.query_count });
  });
  return months;
}

function ActivityHeatmap({ activity }) {
  const [view, setView] = useState('daily');
  const [tip, setTip] = useState(null);

  const weeks = useMemo(() => buildWeeks(activity), [activity]);
  const months = useMemo(() => buildMonths(activity), [activity]);
  const total = useMemo(() => activity.reduce((sum, d) => sum + d.query_count, 0), [activity]);
  const activeDays = useMemo(() => activity.filter((d) => d.query_count > 0).length, [activity]);

  const showTip = (event, text) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ text, x: rect.left + rect.width / 2, y: rect.top });
  };
  const hideTip = () => setTip(null);

  // A month label sits above the first week column that starts in that month.
  const monthLabels = weeks.map((week, i) => {
    const prev = weeks[i - 1];
    if (i === 0 || week.start.getMonth() !== prev.start.getMonth()) {
      // Skip a label squeezed into the very first partial column.
      if (i === 0 && weeks[1] && weeks[1].start.getMonth() !== week.start.getMonth()) return '';
      return MONTHS[week.start.getMonth()];
    }
    return '';
  });

  const thresholds = LEVELS[view];
  const summary = `${plural(total, 'query')} on ${plural(activeDays, 'day')} in the last year`;

  return (
    <section className="pf-card" aria-labelledby="pf-activity-title">
      <div className="pf-card-head">
        <div>
          <div className="pf-card-title" id="pf-activity-title">
            <CalendarDays size={17} /> Query Activity
          </div>
          <div className="pf-card-sub">{summary}</div>
        </div>
        <div className="pf-tabs" role="tablist" aria-label="Activity granularity">
          {['daily', 'weekly', 'monthly'].map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className="pf-tab"
              onClick={() => setView(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-heatmap-scroll">
        {view === 'daily' && (
          <div className="pf-heatmap" role="img" aria-label={`Daily query heatmap: ${summary}`}>
            <span />
            <div className="pf-heat-months" aria-hidden="true">
              {monthLabels.map((label, i) => <span key={i}>{label}</span>)}
            </div>
            <div className="pf-heat-days" aria-hidden="true">
              <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
            </div>
            <div className="pf-heat-grid" onMouseLeave={hideTip}>
              {weeks.flatMap((week) => week.days).map((d) => (
                <div
                  key={d.date}
                  className="pf-cell"
                  data-level={levelFor(d.query_count, thresholds)}
                  onMouseEnter={(e) => showTip(e, <><strong>{plural(d.query_count, 'query')}</strong> · {formatDay(d.day)}</>)}
                />
              ))}
            </div>
          </div>
        )}

        {view === 'weekly' && (
          <div role="img" aria-label={`Weekly query activity: ${summary}`}>
            <div className="pf-strip" onMouseLeave={hideTip}>
              {weeks.map((week) => (
                <div
                  key={week.days[0].date}
                  className="pf-cell"
                  data-level={levelFor(week.total, thresholds)}
                  onMouseEnter={(e) => showTip(e, <><strong>{plural(week.total, 'query')}</strong> · week of {week.start.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</>)}
                />
              ))}
            </div>
            <div className="pf-strip-labels" aria-hidden="true">
              {weeks.map((week, i) => <span key={i}>{monthLabels[i]}</span>)}
            </div>
          </div>
        )}

        {view === 'monthly' && (
          <div role="img" aria-label={`Monthly query activity: ${summary}`}>
            <div className="pf-strip pf-strip-monthly" onMouseLeave={hideTip}>
              {months.map((m) => (
                <div
                  key={m.key}
                  className="pf-cell"
                  data-level={levelFor(m.total, thresholds)}
                  onMouseEnter={(e) => showTip(e, <><strong>{plural(m.total, 'query')}</strong> · {MONTHS[m.month]} {m.year}</>)}
                >
                  {m.total}
                </div>
              ))}
            </div>
            <div className="pf-strip-labels" aria-hidden="true">
              {months.map((m) => <span key={m.key}>{MONTHS[m.month]}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="pf-heat-foot">
        <span>
          {total === 0
            ? 'Start analyzing satellite scenes to build your activity.'
            : `Each ${view === 'daily' ? 'square is a day' : view === 'weekly' ? 'cell is a week' : 'cell is a month'}; brighter means more queries.`}
        </span>
        <span className="pf-legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3].map((level) => <span key={level} className="pf-cell" data-level={level} />)}
          More
        </span>
      </div>

      {tip && (
        <div className="pf-tooltip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      )}
    </section>
  );
}

// ---- Cards -------------------------------------------------------------------

function StatTile({ icon: Icon, color, value, unit, label }) {
  return (
    <div className="pf-card pf-stat">
      <div className="pf-stat-icon" style={{ color }}>
        <Icon size={19} />
      </div>
      <div>
        <div className="pf-stat-value">
          {value}
          {unit && <span className="pf-stat-unit">{unit}</span>}
        </div>
        <div className="pf-stat-label">{label}</div>
      </div>
    </div>
  );
}

function InsightsCard({ insights }) {
  const hasData = insights.total_queries > 0 || insights.scenes_uploaded > 0;
  const rows = [
    { icon: Layers, color: 'var(--pf-good)', label: 'Most used data type', value: insights.most_used_data_type },
    { icon: ScanSearch, color: 'var(--pf-violet)', label: 'Most common task', value: insights.most_common_task },
    { icon: MessageSquare, color: 'var(--accent)', label: 'Total queries', value: insights.total_queries },
    { icon: Upload, color: 'var(--pf-cyan)', label: 'Scenes uploaded', value: insights.scenes_uploaded },
    { icon: Satellite, color: 'var(--pf-cyan)', label: 'Scenes analyzed', value: insights.scenes_analyzed },
    { icon: CheckCircle2, color: 'var(--pf-good)', label: 'Successful analyses', value: insights.successful_analyses },
    { icon: XCircle, color: 'var(--pf-bad)', label: 'Failed analyses', value: insights.failed_analyses },
    { icon: Clock, color: 'var(--pf-amber)', label: 'Awaiting processing', value: insights.pending_analyses },
    {
      icon: Zap,
      color: 'var(--pf-amber)',
      label: 'Avg. queries per active day',
      value: insights.avg_queries_per_active_day
    }
  ];

  return (
    <section className="pf-card" aria-labelledby="pf-insights-title">
      <div className="pf-card-head">
        <div className="pf-card-title" id="pf-insights-title"><BarChart3 size={17} /> Query Insights</div>
      </div>
      {!hasData ? (
        <div className="pf-empty"><BarChart3 size={22} />No analysis data available yet.</div>
      ) : (
        <div className="pf-insights">
          {rows.map(({ icon: Icon, color, label, value }) => (
            <div className="pf-insight" key={label}>
              <Icon size={16} style={{ color }} />
              <span className="pf-insight-label">{label}</span>
              <span className={`pf-insight-value${value === null || value === undefined ? ' is-muted' : ''}`}>
                {value === null || value === undefined ? 'Not enough data' : value}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturesCard({ features }) {
  const max = Math.max(1, ...features.map((f) => f.query_count));
  return (
    <section className="pf-card" aria-labelledby="pf-features-title">
      <div className="pf-card-head">
        <div className="pf-card-title" id="pf-features-title"><Star size={17} /> Most Used Features</div>
      </div>
      {features.length === 0 ? (
        <div className="pf-empty"><Star size={22} />No queries yet. Feature usage appears after your first question.</div>
      ) : (
        <>
          <div className="pf-bars">
            {features.map((f) => (
              <div className="pf-bar-row" key={f.feature}>
                <span className="pf-bar-name" title={f.feature}>{f.feature}</span>
                <div className="pf-bar-track" aria-hidden="true">
                  <div className="pf-bar-fill" style={{ width: `${(f.query_count / max) * 100}%` }} />
                </div>
                <span className="pf-bar-count">
                  {f.query_count} <span>{f.query_count === 1 ? 'query' : 'queries'}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="pf-footnote">Grouped by keywords in your queries. A query can count toward more than one feature.</div>
        </>
      )}
    </section>
  );
}

const DATA_TYPE_ICONS = {
  optical_rgb: Satellite,
  multispectral: Layers,
  sar: Radar,
  optical_sar: Sparkles,
  unclassified: ScanSearch
};

function RemoteSensingCard({ usage, scenesUploaded }) {
  return (
    <section className="pf-card" aria-labelledby="pf-usage-title">
      <div className="pf-card-head">
        <div>
          <div className="pf-card-title" id="pf-usage-title"><Satellite size={17} /> Remote Sensing Usage</div>
          <div className="pf-card-sub">Share of your {plural(scenesUploaded, 'uploaded scene')} by data type</div>
        </div>
      </div>
      {scenesUploaded === 0 ? (
        <div className="pf-empty"><Satellite size={22} />No satellite scenes analyzed yet.</div>
      ) : (
        <>
          <div className="pf-usage">
            {usage.map((u) => {
              const Icon = DATA_TYPE_ICONS[u.data_type] || Satellite;
              return (
                <div className="pf-usage-tile" key={u.data_type} data-empty={u.scenes === 0}>
                  <div className="pf-usage-head">
                    <Icon size={16} />
                    <span>{u.label}</span>
                    <span className="pf-usage-pct">{u.percentage}%</span>
                  </div>
                  <div className="pf-bar-track" aria-hidden="true">
                    <div className="pf-bar-fill" style={{ width: `${u.percentage}%` }} />
                  </div>
                  <div className="pf-usage-meta">
                    <span><strong>{u.scenes}</strong> {u.scenes === 1 ? 'scene' : 'scenes'}</span>
                    <span><strong>{u.query_count}</strong> {u.query_count === 1 ? 'query' : 'queries'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pf-footnote">
            Classified from each upload's sensor, source and filename. JPEG, PNG and WEBP files with no other hint count as Optical / RGB.
          </div>
        </>
      )}
    </section>
  );
}

function RecentActivityCard({ items }) {
  return (
    <section className="pf-card" aria-labelledby="pf-recent-title">
      <div className="pf-card-head">
        <div className="pf-card-title" id="pf-recent-title"><Activity size={17} /> Recent Activity</div>
      </div>
      {items.length === 0 ? (
        <div className="pf-empty"><Activity size={22} />Start analyzing satellite scenes to build your activity.</div>
      ) : (
        <div className="pf-recent">
          {items.map((item) => (
            <div className="pf-recent-item" key={`${item.kind}-${item.id}`}>
              <div className="pf-recent-icon">
                {item.kind === 'upload' ? <Upload size={16} /> : <MessageSquare size={16} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="pf-recent-type">{item.activity_type}</div>
                <div className="pf-recent-label" title={item.label}>
                  {item.kind === 'query' ? `“${item.label}”` : item.label}
                </div>
              </div>
              <div className="pf-recent-side">
                <span className="pf-status" data-status={item.status}>{item.status}</span>
                <span className="pf-recent-time">{formatStamp(item.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Edit profile --------------------------------------------------------------

function EditProfileDialog({ open, onOpenChange, user, onSaved }) {
  const [form, setForm] = useState({ display_name: '', username: '', headline: '', bio: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open || !user) return;
    setForm({
      display_name: user.display_name || '',
      username: user.username || '',
      headline: user.headline || '',
      bio: user.bio || ''
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setError(null);
  }, [open, user]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setError('Profile photos must be JPG, PNG or WEBP.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Profile photos must be 5 MB or smaller.');
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let latest = user;
      if (photoFile) latest = await uploadProfileAvatar(photoFile);
      else if (removePhoto && user.avatar_url) latest = await removeProfileAvatar();

      const changes = {};
      Object.entries(form).forEach(([key, value]) => {
        if ((value || '') !== (user[key] || '')) changes[key] = value;
      });
      if (Object.keys(changes).length) latest = await updateProfile(changes);

      onSaved(latest);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const shownPreview = removePhoto ? null : photoPreview;
  const avatarUser = removePhoto ? { ...user, avatar_url: null } : user;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pf-dialog-overlay" />
        <Dialog.Content className="pf-dialog">
          <Dialog.Title className="pf-dialog-title">Edit Profile</Dialog.Title>
          <Dialog.Description className="pf-dialog-desc">
            How you appear across your SatQuery workspace.
          </Dialog.Description>

          <form className="pf-form" onSubmit={handleSave}>
            <div className="pf-photo-row">
              <Avatar user={avatarUser} previewUrl={shownPreview} small />
              <div className="pf-photo-actions">
                <button type="button" className="pf-btn" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                  <Camera size={14} /> {user?.avatar_url || photoFile ? 'Change photo' : 'Upload photo'}
                </button>
                {(photoFile || (user?.avatar_url && !removePhoto)) && (
                  <button
                    type="button"
                    className="pf-btn pf-btn-danger"
                    disabled={saving}
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true); }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept={AVATAR_TYPES.join(',')} hidden onChange={pickPhoto} />
            </div>

            <div className="pf-field">
              <label htmlFor="pf-display-name">Display name</label>
              <input id="pf-display-name" className="pf-input" value={form.display_name} onChange={setField('display_name')} maxLength={60} required />
            </div>

            <div className="pf-field">
              <label htmlFor="pf-username">Username</label>
              <div className="pf-input-wrap">
                <span className="pf-input-prefix">@</span>
                <input
                  id="pf-username"
                  className="pf-input"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/^@/, '') }))}
                  maxLength={30}
                  pattern="[a-z0-9_]{3,30}"
                  title="3-30 characters: lowercase letters, digits or underscores"
                  required
                />
              </div>
            </div>

            <div className="pf-field">
              <label htmlFor="pf-headline">Headline</label>
              <input id="pf-headline" className="pf-input" value={form.headline} onChange={setField('headline')} maxLength={60} placeholder="e.g. Remote Sensing Analyst" />
            </div>

            <div className="pf-field">
              <label htmlFor="pf-bio">Bio</label>
              <textarea id="pf-bio" className="pf-textarea" value={form.bio} onChange={setField('bio')} maxLength={160} rows={3} />
              <div className="pf-field-hint"><span /><span>{form.bio.length}/160</span></div>
            </div>

            {error && <div className="pf-form-error" role="alert">{error}</div>}

            <div className="pf-dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="pf-btn" disabled={saving}>Cancel</button>
              </Dialog.Close>
              <button type="submit" className="pf-btn pf-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- Screen --------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="pf-page" aria-busy="true" aria-label="Loading profile analytics">
      <div className="pf-skel" style={{ height: 210, borderRadius: 16 }} />
      <div className="pf-stats">
        {[0, 1, 2, 3].map((i) => <div key={i} className="pf-skel" style={{ height: 76 }} />)}
      </div>
      <div className="pf-skel" style={{ height: 210 }} />
      <div className="pf-grid-2">
        <div className="pf-skel" style={{ height: 300 }} />
        <div className="pf-skel" style={{ height: 300 }} />
      </div>
    </div>
  );
}

export function ProfileDashboard({ onProfileUpdated }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  // Held in a ref so a new callback identity from the parent never refetches.
  const onProfileUpdatedRef = useRef(onProfileUpdated);
  useEffect(() => { onProfileUpdatedRef.current = onProfileUpdated; }, [onProfileUpdated]);

  const load = useCallback(() => {
    setStatus('loading');
    setError(null);
    getProfileDashboard()
      .then((dashboard) => {
        setData(dashboard);
        setStatus('ready');
        onProfileUpdatedRef.current?.(dashboard.user);
      })
      .catch((err) => {
        console.error('[SatQuery] Failed to load profile analytics:', err);
        setData(null);
        setError(err);
        setStatus('error');
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (user) => {
    // Only the profile changed -- swap it in without refetching the analytics.
    setData((d) => (d ? { ...d, user } : d));
    onProfileUpdatedRef.current?.(user);
  };

  if (status === 'loading') return <DashboardSkeleton />;

  if (status === 'error' || !data) {
    const detail = error?.code === 'SCHEMA_NOT_MIGRATED' ? error.message : null;
    return (
      <div className="pf-page">
        <div className="pf-card pf-error" role="alert">
          <AlertCircle size={26} />
          <div className="pf-error-title">Unable to load profile analytics.</div>
          {detail && <div className="pf-error-detail">{detail}</div>}
          <button className="pf-btn" onClick={load}><RefreshCw size={14} /> Retry</button>
        </div>
      </div>
    );
  }

  const { user, stats, insights } = data;

  return (
    <div className="pf-page">
      <section className="pf-hero" aria-label="Profile">
        <div className="pf-hero-image" aria-hidden="true" />
        <div className="pf-hero-orbit" aria-hidden="true" />
        <div className="pf-hero-body">
          <Avatar user={user} />
          <div className="pf-hero-text">
            <h1 className="pf-name">{user.display_name}</h1>
            <div className="pf-handle-row">
              <span>@{user.username}</span>
              <span className="pf-plan">{planLabel(user.plan)}</span>
            </div>
            {user.headline && <div className="pf-headline">{user.headline}</div>}
            {user.bio && <p className="pf-bio">{user.bio}</p>}
            <div className="pf-hero-actions">
              <button className="pf-btn" onClick={() => setEditing(true)}>
                <PencilLine size={14} /> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="pf-stats">
        <StatTile icon={MessageSquare} color="var(--accent)" value={stats.total_queries} label="Total Queries" />
        <StatTile icon={Layers} color="var(--pf-good)" value={stats.scenes_analyzed} label="Scenes Analyzed" />
        <StatTile icon={Clock} color="var(--pf-violet)" value={stats.current_streak} unit={stats.current_streak === 1 ? 'day' : 'days'} label="Current Streak" />
        <StatTile icon={Flame} color="var(--pf-amber)" value={stats.longest_streak} unit={stats.longest_streak === 1 ? 'day' : 'days'} label="Longest Streak" />
      </div>

      <ActivityHeatmap activity={data.activity} />

      <div className="pf-grid-2">
        <InsightsCard insights={insights} />
        <FeaturesCard features={data.features} />
      </div>

      <RemoteSensingCard usage={data.remote_sensing_usage} scenesUploaded={insights.scenes_uploaded} />

      <RecentActivityCard items={data.recent_activity} />

      <EditProfileDialog open={editing} onOpenChange={setEditing} user={user} onSaved={handleSaved} />
    </div>
  );
}

export default ProfileDashboard;
