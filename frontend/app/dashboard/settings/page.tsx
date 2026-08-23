'use client';

import { useEffect, useState } from 'react';
import { ProfileForm, JobPreferencesForm, AiProviderForm, SecurityForm } from './_components';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

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
        <ProfileForm 
          name={name} setName={setName} phone={phone} setPhone={setPhone} 
          location={location} setLocation={setLocation} profile={profile} 
          linkedinUrl={linkedinUrl} setLinkedinUrl={setLinkedinUrl} 
          githubUrl={githubUrl} setGithubUrl={setGithubUrl} 
          portfolioUrl={portfolioUrl} setPortfolioUrl={setPortfolioUrl} 
          saving={saving} saveProfile={saveProfile} 
        />
      )}

      {/* ─── Job Preferences Tab ─── */}
      {activeTab === 'prefs' && (
        <JobPreferencesForm 
          targetRoles={targetRoles} setTargetRoles={setTargetRoles} 
          targetLocations={targetLocations} setTargetLocations={setTargetLocations} 
          expectedSalary={expectedSalary} setExpectedSalary={setExpectedSalary} 
          workPreference={workPreference} setWorkPreference={setWorkPreference} 
          yearsExp={yearsExp} setYearsExp={setYearsExp} 
          saving={saving} savePreferences={savePreferences} 
        />
      )}

      {/* ─── AI Provider Tab ─── */}
      {activeTab === 'ai' && (
        <AiProviderForm 
          profile={profile} selectedProvider={selectedProvider} setSelectedProvider={setSelectedProvider} 
          aiKey={aiKey} setAiKey={setAiKey} saving={saving} saveAIProvider={saveAIProvider} 
          testingAI={testingAI} testAI={testAI} aiTestResult={aiTestResult} 
        />
      )}

      {/* ─── Security Tab ─── */}
      {activeTab === 'password' && (
        <SecurityForm 
          currentPassword={currentPassword} setCurrentPassword={setCurrentPassword} 
          newPassword={newPassword} setNewPassword={setNewPassword} 
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} 
          saving={saving} changePassword={changePassword} 
        />
      )}
    </div>
  );
}
