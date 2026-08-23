export function AddCompanyForm({ form, setForm, addCompany, adding }: any) {
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#8892b0', marginBottom: '6px' };
  return (
    <div className="premium-card animate-fade-in" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '16px' }}>Add Custom Company</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Company Name *</label>
          <input value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
            className="input-field" placeholder="e.g. My Dream Company" />
        </div>
        <div>
          <label style={labelStyle}>Industry</label>
          <input value={form.industry} onChange={e => setForm((p: any) => ({ ...p, industry: e.target.value }))}
            className="input-field" placeholder="e.g. Technology" />
        </div>
        <div>
          <label style={labelStyle}>Career Page URL</label>
          <input value={form.career_url} onChange={e => setForm((p: any) => ({ ...p, career_url: e.target.value }))}
            className="input-field" placeholder="https://company.com/careers" />
        </div>
        <div>
          <label style={labelStyle}>Website URL</label>
          <input value={form.website_url} onChange={e => setForm((p: any) => ({ ...p, website_url: e.target.value }))}
            className="input-field" placeholder="https://company.com" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
        <input type="checkbox" id="is-dream" checked={form.is_dream}
          onChange={e => setForm((p: any) => ({ ...p, is_dream: e.target.checked }))} />
        <label htmlFor="is-dream" style={{ fontSize: '13px', color: '#c8cce0' }}>🌟 Mark as Dream Company</label>
      </div>
      <button onClick={() => addCompany(form)} disabled={!form.name || adding}
        className="btn-primary" style={{ marginTop: '16px', opacity: adding ? 0.7 : 1 }}>
        {adding ? 'Adding...' : '+ Add Company'}
      </button>
    </div>
  );
}
