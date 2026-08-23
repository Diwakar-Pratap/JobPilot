'use client';

import { useEffect, useState } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

import { PRESET_COMPANIES, AddCompanyForm, TrackedCompanyCard, PresetCompanyCard } from './_components';


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
        <AddCompanyForm form={form} setForm={setForm} addCompany={addCompany} adding={adding} />
      )}

      {/* Tracked Companies */}
      {companies.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '16px' }}>Tracking ({companies.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {companies.map(c => (
              <TrackedCompanyCard key={c.id} c={c} removeCompany={removeCompany} toggleTracking={toggleTracking} syncCompany={syncCompany} />

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
              <PresetCompanyCard key={c.name} c={c} isTracked={isTracked} addCompany={addCompany} adding={adding} />

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
