'use client';

import { useEffect, useState } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

const PRESET_COMPANIES = [
  { name: 'Google', career_url: 'https://boards.greenhouse.io/google', logo_url: 'https://logo.clearbit.com/google.com', industry: 'Technology' },
  { name: 'OpenAI', career_url: 'https://jobs.lever.co/openai', logo_url: 'https://logo.clearbit.com/openai.com', industry: 'AI' },
  { name: 'Stripe', career_url: 'https://boards.greenhouse.io/stripe', logo_url: 'https://logo.clearbit.com/stripe.com', industry: 'Fintech' },
  { name: 'Netflix', career_url: 'https://jobs.lever.co/netflix', logo_url: 'https://logo.clearbit.com/netflix.com', industry: 'Entertainment' },
  { name: 'Anthropic', career_url: 'https://jobs.lever.co/anthropic', logo_url: 'https://logo.clearbit.com/anthropic.com', industry: 'AI' },
  { name: 'Figma', career_url: 'https://boards.greenhouse.io/figma', logo_url: 'https://logo.clearbit.com/figma.com', industry: 'Design' },
  { name: 'Vercel', career_url: 'https://boards.greenhouse.io/vercel', logo_url: 'https://logo.clearbit.com/vercel.com', industry: 'Developer Tools' },
  { name: 'NVIDIA', career_url: 'https://boards.greenhouse.io/nvidia', logo_url: 'https://logo.clearbit.com/nvidia.com', industry: 'Semiconductors' },
  { name: 'Cloudflare', career_url: 'https://jobs.lever.co/cloudflare', logo_url: 'https://logo.clearbit.com/cloudflare.com', industry: 'Networking' },
  { name: 'Databricks', career_url: 'https://boards.greenhouse.io/databricks', logo_url: 'https://logo.clearbit.com/databricks.com', industry: 'Data' },
  { name: 'GitHub', career_url: 'https://jobs.lever.co/github', logo_url: 'https://logo.clearbit.com/github.com', industry: 'Developer Tools' },
  { name: 'Apple', career_url: 'https://jobs.apple.com', logo_url: 'https://logo.clearbit.com/apple.com', industry: 'Technology' },
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ name: '', career_url: '', website_url: '', industry: '', is_dream: false });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/companies`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCompanies(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const addCompany = async (data: any) => {
    setAdding(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) { showToast(`✓ ${data.name} added to watchlist!`); fetchCompanies(); }
      else { const err = await res.json(); showToast(`❌ ${err.detail || 'Failed'}`); }
    } catch (e) { showToast('❌ Failed to add company'); }
    setAdding(false);
  };

  const removeCompany = async (id: string) => {
    const token = getToken();
    await fetch(`${API}/api/companies/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    showToast('Company removed');
    fetchCompanies();
  };

  const toggleTracking = async (id: string) => {
    const token = getToken();
    await fetch(`${API}/api/companies/${id}/toggle-tracking`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchCompanies();
  };

  const syncCompany = async (id: string, name: string) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/companies/${id}/scrape`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`🔄 Started syncing ${name}...`);
        fetchCompanies();
        // Poll for updates a few times to get the scraping done status
        let count = 0;
        const interval = setInterval(async () => {
          const r = await fetch(`${API}/api/companies`, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const data = await r.json();
            setCompanies(data);
            const comp = data.find((x: any) => x.id === id);
            if (!comp || comp.scrape_status !== 'scraping' || count > 8) {
              clearInterval(interval);
            }
          }
          count++;
        }, 3000);
      } else {
        showToast('❌ Failed to trigger sync');
      }
    } catch (e) {
      showToast('❌ Failed to sync company');
    }
  };

  const trackedIds = new Set(companies.map(c => c.name.toLowerCase()));
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#8892b0', marginBottom: '6px' };

  return (
    <div style={{ maxWidth: '1152px', margin: '0 auto' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '4px' }}>Company Watchlist</h1>
          <p style={{ fontSize: '14px', color: '#8892b0' }}>Track companies and get alerted to new job openings</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? '✕ Cancel' : '+ Add Company'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="premium-card animate-fade-in" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '16px' }}>Add Custom Company</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Company Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="input-field" placeholder="e.g. My Dream Company" />
            </div>
            <div>
              <label style={labelStyle}>Industry</label>
              <input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                className="input-field" placeholder="e.g. Technology" />
            </div>
            <div>
              <label style={labelStyle}>Career Page URL</label>
              <input value={form.career_url} onChange={e => setForm(p => ({ ...p, career_url: e.target.value }))}
                className="input-field" placeholder="https://company.com/careers" />
            </div>
            <div>
              <label style={labelStyle}>Website URL</label>
              <input value={form.website_url} onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))}
                className="input-field" placeholder="https://company.com" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <input type="checkbox" id="is-dream" checked={form.is_dream}
              onChange={e => setForm(p => ({ ...p, is_dream: e.target.checked }))} />
            <label htmlFor="is-dream" style={{ fontSize: '13px', color: '#c8cce0' }}>🌟 Mark as Dream Company</label>
          </div>
          <button onClick={() => addCompany(form)} disabled={!form.name || adding}
            className="btn-primary" style={{ marginTop: '16px', opacity: adding ? 0.7 : 1 }}>
            {adding ? 'Adding...' : '+ Add Company'}
          </button>
        </div>
      )}

      {/* Tracked Companies */}
      {companies.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '16px' }}>Tracking ({companies.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {companies.map(c => (
              <div key={c.id} className="premium-card" style={{ padding: '16px' }}>
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
            ))}
          </div>
        </div>
      )}

      {/* Preset Companies */}
      <div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '16px' }}>Top Companies to Track</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {PRESET_COMPANIES.map(c => {
            const isTracked = trackedIds.has(c.name.toLowerCase());
            return (
              <div key={c.name} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-slide-in-right" style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
          padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: 'white',
          background: 'linear-gradient(135deg, #1a2040, #242d55)',
          border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
