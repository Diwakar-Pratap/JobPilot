'use client';

import { useEffect, useState } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', emoji: '✨', model: 'gemini-2.0-flash', badge: 'Free', badgeColor: '#06d6a0', desc: 'Best free option. Fast, smart, 1M token context. Recommended for most users.', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza...' },
  { id: 'groq', name: 'Groq', emoji: '⚡', model: 'llama-3.1-70b-versatile', badge: 'Free', badgeColor: '#06d6a0', desc: 'Ultra-fast inference. Llama 3.1 70B running on Groq silicon.', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_...' },
  { id: 'openai', name: 'OpenAI', emoji: '🤖', model: 'gpt-4o-mini', badge: 'Paid', badgeColor: '#f59e0b', desc: 'GPT-4o Mini. High quality, best for complex resume parsing.', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-...' },
  { id: 'nvidia', name: 'NVIDIA NIM', emoji: '🖥️', model: 'llama-3.1-70b', badge: 'Free', badgeColor: '#06d6a0', desc: 'NVIDIA inference platform. Free credits for powerful open models.', keyUrl: 'https://build.nvidia.com/', keyHint: 'nvapi-...' },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'ok'|'err'>('ok');
  const [activeTab, setActiveTab] = useState('profile');

  // Profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');

  // Job Preferences
  const [targetRoles, setTargetRoles] = useState('');
  const [targetLocations, setTargetLocations] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [workPreference, setWorkPreference] = useState('');
  const [yearsExp, setYearsExp] = useState('');

  // AI config
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [aiKey, setAiKey] = useState('');
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setName(data.name || ''); setPhone(data.phone || ''); setLocation(data.location || '');
        setLinkedinUrl(data.linkedin_url || ''); setGithubUrl(data.github_url || '');
        setPortfolioUrl(data.portfolio_url || '');
        setTargetRoles(data.target_roles || ''); setTargetLocations(data.target_locations || '');
        setExpectedSalary(data.expected_salary || ''); setWorkPreference(data.work_preference || '');
        setYearsExp(data.years_of_experience ? String(data.years_of_experience) : '');
        setSelectedProvider(data.ai_provider || 'gemini');
      }
    } catch (e) {}
    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving('profile');
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone, location, linkedin_url: linkedinUrl, github_url: githubUrl, portfolio_url: portfolioUrl }),
      });
      if (res.ok) { showToast('✓ Profile updated successfully'); localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user') || '{}'), name, email: profile.email })); }
      else { const d = await res.json(); showToast(`❌ ${d.detail}`, 'err'); }
    } catch (e) { showToast('❌ Network error', 'err'); }
    setSaving('');
  };

  const savePreferences = async () => {
    setSaving('prefs');
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/job-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_roles: targetRoles, target_locations: targetLocations,
          expected_salary: expectedSalary, work_preference: workPreference,
          years_of_experience: yearsExp ? parseInt(yearsExp) : null,
        }),
      });
      if (res.ok) showToast('✓ Preferences saved!');
      else { const d = await res.json(); showToast(`❌ ${d.detail}`, 'err'); }
    } catch (e) { showToast('❌ Network error', 'err'); }
    setSaving('');
  };

  const saveAIProvider = async () => {
    if (!aiKey.trim()) { showToast('❌ Please enter an API key', 'err'); return; }
    setSaving('ai');
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/ai-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: selectedProvider, api_key: aiKey }),
      });
      const data = await res.json();
      if (res.ok) { showToast(`✓ ${data.message || 'AI provider saved!'}`); setProfile({ ...profile, ai_provider: selectedProvider, has_ai_key: true }); }
      else showToast(`❌ ${data.detail || 'Failed to save key'}`, 'err');
    } catch (e) { showToast('❌ Network error', 'err'); }
    setSaving('');
  };

  const testAI = async () => {
    setTestingAI(true); setAiTestResult(null);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/test-ai`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAiTestResult(data);
    } catch (e) { setAiTestResult({ status: 'error', message: 'Network error' }); }
    setTestingAI(false);
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { showToast('❌ Passwords do not match', 'err'); return; }
    setSaving('password');
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (res.ok) { showToast('✓ Password changed'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
      else { const d = await res.json(); showToast(`❌ ${d.detail}`, 'err'); }
    } catch (e) { showToast('❌ Network error', 'err'); }
    setSaving('');
  };

  const tabs = [
    { id: 'profile', label: '👤 Profile', icon: '👤' },
    { id: 'prefs', label: '🎯 Job Preferences', icon: '🎯' },
    { id: 'ai', label: '🤖 AI Provider', icon: '🤖' },
    { id: 'password', label: '🔒 Security', icon: '🔒' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13.5px',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--text-heavy)', outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'all 0.2s',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block',
    fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase',
  };

  if (loading) return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="shimmer" style={{ height: '48px', borderRadius: '14px', marginBottom: '24px' }} />
      {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: '120px', borderRadius: '14px', marginBottom: '16px' }} />)}
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="animate-slide-in-right" style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          padding: '12px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif",
          background: toastType === 'ok' ? 'rgba(6,214,160,0.15)' : 'rgba(239,68,68,0.15)',
          border: toastType === 'ok' ? '1px solid rgba(6,214,160,0.3)' : '1px solid rgba(239,68,68,0.3)',
          color: toastType === 'ok' ? '#34d399' : '#f87171',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your profile, preferences, and AI configuration</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif", border: 'none', cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(124,110,247,0.2), rgba(124,110,247,0.1))' : 'transparent',
              color: activeTab === tab.id ? '#c4b5fd' : '#7b8ab8',
              boxShadow: activeTab === tab.id ? '0 0 0 1px rgba(124,110,247,0.25)' : 'none',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* ─── Profile Tab ─── */}
      {activeTab === 'profile' && (
        <div className="premium-card animate-fade-in" style={{ padding: '28px' }}>
          <h2 className="section-title" style={{ marginBottom: '24px' }}>Personal Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Diwakar Kumar"
                onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210"
                onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
              />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="Bengaluru, India"
                onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
              />
            </div>
            <div>
              <label style={labelStyle}>Email (Read-only)</label>
              <input style={{ ...inputStyle, opacity: 0.5 }} value={profile.email || ''} disabled />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'LinkedIn URL', val: linkedinUrl, set: setLinkedinUrl, ph: 'linkedin.com/in/...' },
              { label: 'GitHub URL', val: githubUrl, set: setGithubUrl, ph: 'github.com/...' },
              { label: 'Portfolio URL', val: portfolioUrl, set: setPortfolioUrl, ph: 'yoursite.com' },
            ].map(f => (
              <div key={f.label}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                  onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={saveProfile} disabled={saving === 'profile'} style={{ minWidth: '160px' }}>
            {saving === 'profile' ? '⏳ Saving...' : '✓ Save Profile'}
          </button>
        </div>
      )}

      {/* ─── Job Preferences Tab ─── */}
      {activeTab === 'prefs' && (
        <div className="premium-card animate-fade-in" style={{ padding: '28px' }}>
          <h2 className="section-title" style={{ marginBottom: '8px' }}>Job Search Preferences</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>These settings control what jobs the AI searches for and which alerts you receive.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>🎯 Target Roles (comma separated)</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} value={targetRoles}
                onChange={e => setTargetRoles(e.target.value)}
                placeholder="Python Developer, Backend Engineer, Data Engineer"
                onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
              />
              <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '4px' }}>Used for LinkedIn search, job matching, and WhatsApp alerts</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>📍 Preferred Locations</label>
                <input style={inputStyle} value={targetLocations} onChange={e => setTargetLocations(e.target.value)}
                  placeholder="Bengaluru, Remote, Hyderabad"
                  onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                  onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                />
                <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '4px' }}>Comma-separated. Posts matching these cities are prioritized.</p>
              </div>
              <div>
                <label style={labelStyle}>💰 Expected Salary</label>
                <input style={inputStyle} value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)}
                  placeholder="₹15-25 LPA or $80k-120k"
                  onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                  onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>🏢 Work Preference</label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={workPreference.includes('remote')}
                      onChange={e => {
                        if (e.target.checked) {
                          const current = workPreference ? workPreference.split(',').filter(x => x !== 'NA') : [];
                          setWorkPreference([...current, 'remote'].join(','));
                        } else {
                          const current = workPreference.split(',').filter(x => x !== 'remote');
                          setWorkPreference(current.join(','));
                        }
                      }}
                    />
                    Remote
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={workPreference.includes('hybrid')}
                      onChange={e => {
                        if (e.target.checked) {
                          const current = workPreference ? workPreference.split(',').filter(x => x !== 'NA') : [];
                          setWorkPreference([...current, 'hybrid'].join(','));
                        } else {
                          const current = workPreference.split(',').filter(x => x !== 'hybrid');
                          setWorkPreference(current.join(','));
                        }
                      }}
                    />
                    Hybrid
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={workPreference.includes('onsite')}
                      onChange={e => {
                        if (e.target.checked) {
                          const current = workPreference ? workPreference.split(',').filter(x => x !== 'NA') : [];
                          setWorkPreference([...current, 'onsite'].join(','));
                        } else {
                          const current = workPreference.split(',').filter(x => x !== 'onsite');
                          setWorkPreference(current.join(','));
                        }
                      }}
                    />
                    On-site
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!workPreference || workPreference === 'NA' || workPreference.includes('NA')}
                      onChange={e => {
                        if (e.target.checked) {
                          setWorkPreference('NA');
                        } else {
                          setWorkPreference('');
                        }
                      }}
                    />
                    NA (Any)
                  </label>
                </div>
              </div>
              <div>
                <label style={labelStyle}>📅 Years of Experience</label>
                <input style={inputStyle} type="number" min="0" max="50" value={yearsExp}
                  onChange={e => setYearsExp(e.target.value)}
                  placeholder="4"
                  onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                  onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                />
                <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '4px' }}>Used to filter jobs. E.g. 4 years = shows only 3-6 yr roles</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button className="btn-primary" onClick={savePreferences} disabled={saving === 'prefs'} style={{ minWidth: '180px' }}>
              {saving === 'prefs' ? '⏳ Saving...' : '✓ Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* ─── AI Provider Tab ─── */}
      {activeTab === 'ai' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="premium-card" style={{ padding: '28px' }}>
            <h2 className="section-title" style={{ marginBottom: '8px' }}>AI Provider</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Choose your AI engine for resume parsing, job matching, and smart search.
              {profile.has_ai_key && <span style={{ color: '#34d399', marginLeft: '8px', fontWeight: 600 }}>● Connected</span>}
            </p>

            {/* Provider cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                  style={{
                    padding: '16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                    background: selectedProvider === p.id ? 'rgba(124,110,247,0.1)' : 'rgba(255,255,255,0.03)',
                    border: selectedProvider === p.id ? '1px solid rgba(124,110,247,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedProvider === p.id ? '0 0 0 1px rgba(124,110,247,0.15), inset 0 0 20px rgba(124,110,247,0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{p.emoji}</span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'white', fontSize: '14px' }}>{p.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, background: `${p.badgeColor}18`, color: p.badgeColor, border: `1px solid ${p.badgeColor}30`, fontFamily: "'Space Grotesk', sans-serif" }}>{p.badge}</span>
                      {selectedProvider === p.id && <span style={{ fontSize: '12px', color: '#c4b5fd' }}>●</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{p.desc}</div>
                  <div style={{ fontSize: '10.5px', color: '#3d4a70', marginTop: '6px', fontFamily: "'Space Grotesk', sans-serif" }}>Model: {p.model}</div>
                </button>
              ))}
            </div>

            {/* API Key input */}
            {(() => {
              const prov = PROVIDERS.find(p => p.id === selectedProvider)!;
              return (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label style={labelStyle}>{prov.emoji} {prov.name} API Key</label>
                    <a href={prov.keyUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: '#7c6ef7', textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                      Get free key ↗
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
                      type="password" value={aiKey} onChange={e => setAiKey(e.target.value)}
                      placeholder={prov.keyHint}
                      onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                      onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                    />
                    <button className="btn-primary" onClick={saveAIProvider} disabled={saving === 'ai'} style={{ minWidth: '120px', padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {saving === 'ai' ? '⏳ Testing...' : '✓ Save & Test'}
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '8px' }}>Key is encrypted and stored securely. Never shared with third parties.</p>
                </div>
              );
            })()}

            {/* Test connection */}
            {profile.has_ai_key && (
              <div style={{ marginTop: '16px' }}>
                <button className="btn-secondary" onClick={testAI} disabled={testingAI} style={{ fontSize: '13px' }}>
                  {testingAI ? '⏳ Testing...' : '🧪 Test Current Connection'}
                </button>
                {aiTestResult && (
                  <div className="animate-fade-in" style={{
                    marginTop: '12px', padding: '12px 16px', borderRadius: '10px', fontSize: '13px',
                    background: aiTestResult.status === 'connected' ? 'rgba(6,214,160,0.08)' : 'rgba(239,68,68,0.08)',
                    border: aiTestResult.status === 'connected' ? '1px solid rgba(6,214,160,0.2)' : '1px solid rgba(239,68,68,0.2)',
                    color: aiTestResult.status === 'connected' ? '#34d399' : '#f87171',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {aiTestResult.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info card */}
          <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(124,110,247,0.06)', border: '1px solid rgba(124,110,247,0.15)' }}>
            <p style={{ fontSize: '12.5px', color: '#c4b5fd', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, marginBottom: '4px' }}>💡 Recommended: Google Gemini (Free)</p>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Get your free Gemini API key at <a href="https://aistudio.google.com/apikey" target="_blank" style={{ color: '#7c6ef7' }}>aistudio.google.com/apikey</a>. 
              No credit card required. 1 million token context window for free.
            </p>
          </div>
        </div>
      )}

      {/* ─── Security Tab ─── */}
      {activeTab === 'password' && (
        <div className="premium-card animate-fade-in" style={{ padding: '28px' }}>
          <h2 className="section-title" style={{ marginBottom: '8px' }}>Change Password</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Use a strong password with at least 8 characters.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
            {[
              { label: 'Current Password', val: currentPassword, set: setCurrentPassword },
              { label: 'New Password', val: newPassword, set: setNewPassword },
              { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword },
            ].map(f => (
              <div key={f.label}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="password" value={f.val} onChange={e => f.set(e.target.value)}
                  onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                  onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                />
              </div>
            ))}
            <button className="btn-primary" onClick={changePassword} disabled={saving === 'password'} style={{ marginTop: '8px', minWidth: '160px' }}>
              {saving === 'password' ? '⏳ Changing...' : '🔒 Change Password'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
