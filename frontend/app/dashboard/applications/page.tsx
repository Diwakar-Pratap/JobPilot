'use client';

import { useEffect, useState } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

const STATUSES = ['saved', 'pending', 'applied', 'interview', 'offer', 'rejected'];
const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  saved:     { label: 'Saved',      icon: '📌', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  pending:   { label: 'Pending',    icon: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  applied:   { label: 'Applied',    icon: '📤', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  interview: { label: 'Interview',  icon: '🎙️', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  offer:     { label: 'Offer',      icon: '🏆', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  rejected:  { label: 'Rejected',   icon: '✗',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

function AppCard({ app, onStatusChange, onDelete }: any) {
  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.saved;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="glass-card" style={{ padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Company logo */}
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
          {app.job?.company_logo ? (
            <img src={app.job.company_logo} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : app.job?.company?.[0] || '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className="font-semibold text-white text-sm leading-tight truncate">{app.job?.title || 'Unknown Role'}</h4>
          <p className="text-xs mt-0.5" style={{ color: '#8892b0' }}>{app.job?.company}</p>
          {app.job?.location && (
            <p className="text-xs mt-0.5" style={{ color: '#4a5480' }}>📍 {app.job.location}</p>
          )}
          {app.match_score && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#a5b4fc' }}>⚡ {app.match_score}% match</p>
          )}
          {app.applied_at && (
            <p className="text-xs mt-1" style={{ color: '#4a5480' }}>
              Applied {new Date(app.applied_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="btn-ghost px-2 py-1 text-sm" style={{ color: '#4a5480' }}>
            ⋮
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '32px', zIndex: 10, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', background: '#0d1326', border: '1px solid rgba(255,255,255,0.08)', minWidth: '150px' }}>
              {STATUSES.filter(s => s !== app.status).map(s => (
                <button key={s} onClick={() => { onStatusChange(app.id, s); setMenuOpen(false); }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', background: 'transparent', border: 'none', cursor: 'pointer', color: '#c8cce0' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {STATUS_CONFIG[s].icon} Move to {STATUS_CONFIG[s].label}
                </button>
              ))}
              <div className="divider" />
              <button onClick={() => { onDelete(app.id); setMenuOpen(false); }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fca5a5' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                🗑️ Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {app.auto_applied && <span className="badge badge-purple">🤖 Auto-Applied</span>}
        {app.job?.work_mode && <span className="badge badge-gray capitalize">{app.job.work_mode}</span>}
        {app.job?.salary_display && <span className="text-xs" style={{ color: '#4a5480' }}>💰 {app.job.salary_display}</span>}
      </div>
    </div>
  );
}

function KanbanColumn({ status, apps, onStatusChange, onDelete }: any) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '280px', width: '288px' }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingLeft: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-base">{cfg.icon}</span>
          <span className="font-display font-bold text-white text-sm">{cfg.label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: cfg.bg, color: cfg.color }}>
            {apps.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, borderRadius: '16px', padding: '8px', minHeight: '192px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        {apps.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '128px', textAlign: 'center' }}>
            <div className="text-2xl mb-2 opacity-30">{cfg.icon}</div>
            <p className="text-xs" style={{ color: '#4a5480' }}>No applications</p>
          </div>
        ) : (
          apps.map((app: any) => (
            <AppCard key={app.id} app={app} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [stats, setStats] = useState<any>({});

  useEffect(() => { fetchApps(); }, []);

  const fetchApps = async () => {
    const token = getToken();
    try {
      const [appsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/applications/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/applications/stats/summary`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (appsRes.ok) setApps(await appsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {}
    setLoading(false);
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    const token = getToken();
    await fetch(`${API}/api/applications/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchApps();
  };

  const handleDelete = async (appId: string) => {
    const token = getToken();
    await fetch(`${API}/api/applications/${appId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchApps();
  };

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = apps.filter(a => a.status === s);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Applications Tracker</h1>
          <p className="page-subtitle">Track every job application in your pipeline</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setView('kanban')}
            className="btn-ghost"
            style={{ padding: '8px 12px', fontSize: '13px', color: view === 'kanban' ? '#c4b5fd' : undefined }}>
            ⊞ Kanban
          </button>
          <button onClick={() => setView('list')}
            className="btn-ghost"
            style={{ padding: '8px 12px', fontSize: '13px', color: view === 'list' ? '#c4b5fd' : undefined }}>
            ☰ List
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = grouped[s]?.length || 0;
          return (
            <div key={s} className="premium-card p-3 text-center">
              <div className="text-xl mb-1">{cfg.icon}</div>
              <div className="font-display font-bold text-lg text-white">{count}</div>
              <div className="text-xs" style={{ color: '#4a5480' }}>{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
          {STATUSES.map(s => <div key={s} className="shimmer" style={{ minWidth: '280px', height: '256px', borderRadius: '16px', flexShrink: 0 }} />)}
        </div>
      ) : view === 'kanban' ? (
        <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', minWidth: 'max-content' }}>
            {STATUSES.map(s => (
              <KanbanColumn
                key={s}
                status={s}
                apps={grouped[s] || []}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Status</th>
                <th>Match</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => {
                const cfg = STATUS_CONFIG[app.status];
                return (
                  <tr key={app.id}>
                    <td>
                      <div className="font-medium text-white">{app.job?.title || '—'}</div>
                    </td>
                    <td style={{ color: '#8892b0' }}>{app.job?.company || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td>
                      {app.match_score ? (
                        <span className="font-medium" style={{ color: app.match_score >= 80 ? '#10b981' : '#f59e0b' }}>
                          {app.match_score}%
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ color: '#4a5480' }}>
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select onChange={e => handleStatusChange(app.id, e.target.value)} value={app.status}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#c8cce0', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {STATUSES.map(s => <option key={s} value={s} className="bg-dark-900">{STATUS_CONFIG[s].label}</option>)}
                        </select>
                        <button onClick={() => handleDelete(app.id)} className="text-xs px-2 py-1 rounded-lg"
                          style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {apps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 24px' }}>
              <div className="text-4xl mb-3">📋</div>
              <p className="font-semibold text-white mb-1">No applications yet</p>
              <p className="text-sm" style={{ color: '#4a5480' }}>Save or apply to jobs to track them here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
