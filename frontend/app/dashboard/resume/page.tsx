'use client';

import { useEffect, useState, useRef } from 'react';
import { ResumeUploader, ResumeCard, AiProfileView, ParsedProfileView, AIChat, ATSMatcher } from './_components';

const API = '';
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''; }

export default function ResumePage() {
  const [resumes, setResumes] = useState<any[]>([]);
  const [primaryResume, setPrimaryResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Target roles states
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [savingRoles, setSavingRoles] = useState(false);

  // Parsing progress states
  const [parsingPercent, setParsingPercent] = useState<number>(0);
  const [parsingStep, setParsingStep] = useState<string>('');

  const getStepText = (percent: number) => {
    if (percent <= 5) return 'Uploading and preparing document...';
    if (percent <= 10) return 'Extracting document text...';
    if (percent <= 30) return 'Segmenting sections & analyzing format...';
    if (percent <= 60) return 'Extracting profile, experience, and skills...';
    if (percent <= 90) return 'Generating AI career insights & resume score...';
    return 'Completing final updates...';
  };

  useEffect(() => {
    fetchResumes();
    fetchTargetRoles();
  }, []);

  const fetchTargetRoles = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.target_roles) {
          setTargetRoles(data.target_roles.split(',').map((r: string) => r.trim()).filter(Boolean));
        }
      }
    } catch (e) {}
  };

  const saveTargetRoles = async (rolesList: string[]) => {
    setSavingRoles(true);
    const token = getToken();
    try {
      const rolesStr = rolesList.join(', ');
      await fetch(`${API}/api/settings/job-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_roles: rolesStr }),
      });
    } catch (e) {}
    setSavingRoles(false);
  };

  const addRole = (role: string) => {
    const trimmed = role.trim();
    if (trimmed && !targetRoles.includes(trimmed)) {
      const updated = [...targetRoles, trimmed];
      setTargetRoles(updated);
      saveTargetRoles(updated);
    }
    setNewRoleInput('');
  };

  const removeRole = (role: string) => {
    const updated = targetRoles.filter(r => r !== role);
    setTargetRoles(updated);
    saveTargetRoles(updated);
  };

  const fetchResumes = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/resume/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setResumes(data);
        const primary = data.find((r: any) => r.is_primary) || data[0] || null;
        setPrimaryResume(primary);
        
        // If there's any parsing resume, auto-start polling
        const parsing = data.find((r: any) => r.parse_status === 'parsing');
        if (parsing) {
          setParsingPercent(parsing.parse_percent || 5);
          setParsingStep(getStepText(parsing.parse_percent || 5));
          pollProgress(parsing.id);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  const pollProgress = (resumeId: string) => {
    const token = getToken();
    let attempts = 0;
    
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/api/resume/`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setResumes(data);
          
          const current = data.find((r: any) => r.id === resumeId);
          if (current) {
            setPrimaryResume(current);
            setParsingPercent(current.parse_percent || 5);
            setParsingStep(getStepText(current.parse_percent || 5));
            
            if (current.parse_status === 'done' || current.parse_status === 'failed' || attempts > 60) {
              clearInterval(poll);
              if (current.parse_status === 'done') {
                setParseProgress('✓ Resume parsed successfully!');
                setTimeout(() => setParseProgress(''), 4000);
                fetchTargetRoles();
              } else if (current.parse_status === 'failed') {
                setParseProgress('❌ Parsing failed.');
                setTimeout(() => setParseProgress(''), 4000);
              }
              setParsingPercent(0);
              setParsingStep('');
              // Final refresh
              const finalRes = await fetch(`${API}/api/resume/`, { headers: { Authorization: `Bearer ${token}` } });
              if (finalRes.ok) {
                const finalData = await finalRes.json();
                setResumes(finalData);
                setPrimaryResume(finalData.find((r: any) => r.id === resumeId) || finalData[0] || null);
              }
            }
          } else {
            clearInterval(poll);
          }
        }
      } catch (e) {
        clearInterval(poll);
      }
    }, 1500);
  };

  const uploadResume = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setParseProgress('Uploading...');
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/api/resume/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setParseProgress('✓ Uploaded! AI is parsing your resume...');
        setParsingPercent(5);
        setParsingStep(getStepText(5));
        pollProgress(data.id);
      } else {
        const err = await res.json();
        setParseProgress(`❌ ${err.detail || 'Upload failed'}`);
      }
    } catch (e) {
      setParseProgress('❌ Upload failed. Is the backend running?');
    }
    setUploading(false);
  };

  const handleFileDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) uploadResume(file); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) uploadResume(file); };

  const handleReparse = async (resumeId: string) => {
    const token = getToken();
    setParseProgress('🔄 Re-parsing with AI...');
    setParsingPercent(5);
    setParsingStep(getStepText(5));
    const res = await fetch(`${API}/api/resume/${resumeId}/reparse`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      pollProgress(resumeId);
    } else {
      setParseProgress('❌ Re-parsing failed to start.');
      setTimeout(() => setParseProgress(''), 3000);
      setParsingPercent(0);
      setParsingStep('');
    }
  };

  return (
    <div style={{ maxWidth: '1024px', margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>My Resume</h1>
        <p style={{ fontSize: '14px', color: '#8892b0' }}>Upload your resume and let AI build your complete career profile</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '24px' }}>
        {/* Left: Upload + Resumes list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Target Roles Card */}
          <div className="premium-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>🎯</span>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', fontSize: '14px', margin: 0 }}>Target Roles</h3>
              {savingRoles && <span style={{ fontSize: '11px', color: '#6ee7b7', marginLeft: 'auto' }}>Saving...</span>}
            </div>
            
            <p style={{ fontSize: '12px', color: '#8892b0', marginBottom: '12px', lineHeight: 1.4 }}>
              Define the job titles you are actively searching for. JobPilot uses these to auto-filter matches and scrape LinkedIn.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {targetRoles.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#4a5480', fontStyle: 'italic' }}>No roles added yet. Add one below!</span>
              ) : (
                targetRoles.map(role => (
                  <span key={role} style={{
                    fontSize: '12px', padding: '4px 12px', borderRadius: '999px',
                    background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                    border: '1px solid rgba(99,102,241,0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}>
                    {role}
                    <button onClick={() => removeRole(role)}
                      style={{ background: 'none', border: 'none', color: '#4a5480', cursor: 'pointer', fontSize: '10px', padding: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#4a5480'}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Input field */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                value={newRoleInput}
                onChange={e => setNewRoleInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRole(newRoleInput);
                  }
                }}
                placeholder="Add role (e.g. Developer)..."
                style={{ fontSize: '13px', padding: '8px 12px' }}
              />
              <button
                onClick={() => addRole(newRoleInput)}
                disabled={!newRoleInput.trim()}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Add
              </button>
            </div>

            {/* Auto-detect option */}
            {primaryResume?.ai_profile?.target_roles && (
              <div style={{
                marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#8892b0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                  <span>💡 AI Suggested Roles:</span>
                  <span style={{ color: '#a5b4fc', fontWeight: 500 }}>
                    {primaryResume.ai_profile.target_roles}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const suggested = primaryResume.ai_profile.target_roles.split(',').map((r: string) => r.trim()).filter(Boolean);
                    const merged = Array.from(new Set([...targetRoles, ...suggested]));
                    setTargetRoles(merged);
                    saveTargetRoles(merged);
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '11px', alignSelf: 'flex-start' }}
                >
                  Apply Suggested Roles
                </button>
              </div>
            )}
          </div>

          <ResumeUploader
            dragOver={dragOver}
            setDragOver={setDragOver}
            uploading={uploading}
            handleFileDrop={handleFileDrop}
            fileRef={fileRef}
            handleFileChange={handleFileChange}
          />

          {/* Parse status */}
          {parseProgress && (
            <div className="animate-fade-in" style={{ padding: '12px', borderRadius: '12px', fontSize: '13px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              {parseProgress}
            </div>
          )}

          {/* Uploaded resumes */}
          {resumes.length > 0 && (
            <div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>Uploaded Resumes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {resumes.map(r => (
                  <ResumeCard
                    key={r.id}
                    resume={r}
                    primaryResume={primaryResume}
                    setPrimaryResume={setPrimaryResume}
                    handleReparse={handleReparse}
                  />
                ))}
              </div>
            </div>
          )}

          <AiProfileView primaryResume={primaryResume} />
        </div>

        {/* Right: Parsed Profile + AI Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: '96px', borderRadius: '12px' }} />)}
            </div>
          ) : primaryResume ? (
            <>
              <div className="premium-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white' }}>Parsed Profile</h3>
                  <span className={`badge ${primaryResume.parse_status === 'done' ? 'badge-green' : primaryResume.parse_status === 'parsing' ? 'badge-yellow' : 'badge-gray'}`}>
                    {primaryResume.parse_status === 'done' ? '✓ AI Parsed' : primaryResume.parse_status === 'parsing' ? '⏳ Parsing...' : 'Pending'}
                  </span>
                </div>

                {primaryResume.parse_status === 'done' && primaryResume.parsed_data ? (
                  <ParsedProfileView data={primaryResume.parsed_data} aiProfile={primaryResume.ai_profile} />
                ) : primaryResume.parse_status === 'parsing' ? (
                  <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }} className="animate-bounce-subtle">🤖</div>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '8px', fontSize: '18px' }}>
                      AI Resume Parsing in Progress
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                      {parsingStep || 'AI is reading your resume...'}
                    </p>
                    <div className="progress-bar" style={{ maxWidth: '280px', margin: '0 auto 8px', height: '8px' }}>
                      <div className="progress-fill" style={{ width: `${parsingPercent || 10}%` }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)' }}>
                      {parsingPercent || 10}% Completed
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', marginBottom: '8px' }}>Resume pending parse</h3>
                    <p style={{ fontSize: '14px', color: '#8892b0' }}>Add your OpenAI API key in Settings to enable AI parsing</p>
                  </div>
                )}
              </div>


            </>
          ) : (
            <div className="premium-card" style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', fontSize: '20px', marginBottom: '8px' }}>No Resume Yet</h3>
              <p style={{ fontSize: '14px', marginBottom: '24px', color: '#8892b0' }}>
                Upload your resume to get started. AI will extract all your information automatically.
              </p>
              <button onClick={() => fileRef.current?.click()} className="btn-primary">Upload Resume 📄</button>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat Full Width */}
      {primaryResume?.parse_status === 'done' && (
        <div className="premium-card" style={{ overflow: 'hidden', marginTop: '24px', width: '100%' }}>
          <AIChat resumeId={primaryResume.id} />
        </div>
      )}
    </div>
  );
}
