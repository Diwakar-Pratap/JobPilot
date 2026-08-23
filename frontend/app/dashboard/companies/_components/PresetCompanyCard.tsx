export function PresetCompanyCard({ c, isTracked, addCompany, adding }: any) {
  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, overflow: 'hidden', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
        <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e: any) => { e.target.style.display = 'none'; e.target.parentElement.textContent = c.name[0]; }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-heavy)', fontSize: '14px' }}>{c.name}</div>
        <div style={{ fontSize: '11px', color: '#4a5480' }}>{c.industry}</div>
      </div>
      <button
        id={`track-${c.name.toLowerCase()}`}
        onClick={() => !isTracked && addCompany({ name: c.name, career_url: c.career_url, logo_url: c.logo_url, industry: c.industry })}
        disabled={isTracked || adding}
        className={isTracked ? '' : 'btn-primary'}
        style={isTracked
          ? { fontSize: '12px', padding: '6px 12px', borderRadius: '8px', fontWeight: 500, flexShrink: 0, background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)', cursor: 'default' }
          : { fontSize: '12px', padding: '6px 12px', flexShrink: 0 }
        }>
        {isTracked ? '✓ Tracking' : '+ Track'}
      </button>
    </div>
  );
}
