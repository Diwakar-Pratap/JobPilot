import { useState } from 'react';
import { STATUSES, STATUS_CONFIG } from './constants';

export function AppCard({ app, onStatusChange, onDelete }: any) {
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
