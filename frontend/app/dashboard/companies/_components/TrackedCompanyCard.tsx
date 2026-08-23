export function TrackedCompanyCard({ c, removeCompany, toggleTracking, syncCompany }: any) {
  return (
    <div className="premium-card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0, overflow: 'hidden', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
          {c.logo_url ? <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e: any) => { e.target.style.display = 'none'; }} /> : c.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontWeight: 600, color: 'var(--text-heavy)', fontSize: '14px' }}>{c.name}</h4>
            {c.is_dream && <span style={{ color: '#fbbf24', fontSize: '12px' }}>🌟</span>}
          </div>
          <p style={{ fontSize: '12px', color: '#4a5480' }}>{c.industry}</p>
        </div>
        <button onClick={() => removeCompany(c.id)}
          style={{ fontSize: '12px', color: '#4a5480', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4a5480')}>
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', background: c.is_tracking ? '#6ee7b7' : '#64748b' }} />
          <span style={{ color: c.is_tracking ? '#6ee7b7' : '#4a5480' }}>
            {c.is_tracking ? 'Tracking' : 'Paused'}
          </span>
        </div>
        <span style={{ color: '#4a5480' }}>{c.jobs_found} jobs found</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', marginBottom: '12px' }}>
        <span style={{ color: c.scrape_status === 'error' ? '#fca5a5' : c.scrape_status === 'scraping' ? '#fbbf24' : '#4a5480', fontWeight: c.scrape_status === 'error' ? 600 : 'normal' }}>
          {c.scrape_status === 'scraping' ? '🔄 Syncing listings...' :
           c.scrape_status === 'error' ? '⚠️ Sync failed — click Sync to retry' :
           c.last_scraped ? `✓ Synced: ${new Date(c.last_scraped).toLocaleDateString()}` : 'Never synced'}
        </span>
        {c.scrape_status === 'error' && c.scrape_error && (
          <div style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', marginTop: '4px', fontSize: '10px', lineHeight: 1.3 }}>
            <strong>Error:</strong> {c.scrape_error}
            <div style={{ marginTop: '4px', color: '#93c5fd', fontSize: '9px' }}>
              💡 Tip: Check if the career URL is correct and public, or try syncing again.
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => toggleTracking(c.id)}
          className="btn-ghost" style={{ flex: 1, padding: '6px 4px', fontSize: '11px' }}>
          {c.is_tracking ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button onClick={() => syncCompany(c.id, c.name)} disabled={c.scrape_status === 'scraping'}
          className="btn-ghost" style={{ flex: 1, padding: '6px 4px', fontSize: '11px', opacity: c.scrape_status === 'scraping' ? 0.6 : 1 }}>
          {c.scrape_status === 'scraping' ? 'Syncing...' : c.scrape_status === 'error' ? '↩ Retry' : '🔄 Sync'}
        </button>
        {c.career_url && (
          <a href={c.career_url} target="_blank" rel="noopener noreferrer"
            className="btn-ghost" style={{ flex: 1, padding: '6px 4px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            Jobs ↗
          </a>
        )}
      </div>
    </div>
  );
}
