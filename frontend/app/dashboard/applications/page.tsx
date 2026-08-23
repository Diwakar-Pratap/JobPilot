'use client';

import { useEffect, useState } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

import { STATUSES, STATUS_CONFIG, KanbanColumn } from './_components';

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
