'use client';

import { useEffect, useState, useRef } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

function SkillTag({ skill, matched }: { skill: string; matched?: boolean }) {
  return (
    <span style={{
      fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 500,
      background: matched ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.1)',
      color: matched ? '#6ee7b7' : '#a5b4fc',
      border: `1px solid ${matched ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`,
    }}>
      {matched && '✓ '}{skill}
    </span>
  );
}

function ParsedProfileView({ data, aiProfile }: any) {
  if (!data) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {/* Header info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, flexShrink: 0, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
          {data.name?.[0] || '?'}
        </div>
        <div>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', fontSize: '20px' }}>{data.name}</h3>
          <p style={{ fontSize: '13px', marginTop: '2px', color: '#8892b0' }}>{data.email} · {data.phone}</p>
          <p style={{ fontSize: '13px', color: '#8892b0' }}>{data.location}</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {data.linkedin_url && <a href={data.linkedin_url} target="_blank" className="badge badge-blue" style={{ fontSize: '11px' }}>LinkedIn ↗</a>}
            {data.github_url && <a href={data.github_url} target="_blank" className="badge badge-gray" style={{ fontSize: '11px' }}>GitHub ↗</a>}
          </div>
        </div>
        {aiProfile?.resume_score && (
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div className="gradient-text" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 900 }}>{aiProfile.resume_score}</div>
            <div style={{ fontSize: '11px', color: '#4a5480' }}>Resume Score</div>
          </div>
        )}
      </div>

      {/* AI Career Summary */}
      {aiProfile?.career_summary && (
        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a5b4fc' }}>🤖 AI Career Summary</p>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#c8cce0' }}>{aiProfile.career_summary}</p>
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div>
          <h4 style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>Skills ({data.skills.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {data.skills.map((skill: string) => <SkillTag key={skill} skill={skill} />)}
          </div>
        </div>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <div>
          <h4 style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>Experience</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {data.experience.map((exp: any, i: number) => (
              <div key={i} style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'white', fontSize: '14px' }}>{exp.title}</div>
                    <div style={{ fontSize: '13px', color: '#8892b0' }}>{exp.company}</div>
                  </div>
                  <div style={{ fontSize: '12px', textAlign: 'right', color: '#4a5480' }}>
                    {exp.start_date} — {exp.end_date || 'Present'}
                  </div>
                </div>
                {exp.description && (
                  <p style={{ fontSize: '12px', marginTop: '8px', lineHeight: 1.5, color: '#4a5480' }}>{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div>
          <h4 style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>Education</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.education.map((edu: any, i: number) => (
              <div key={i} style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: 600, color: 'white', fontSize: '14px' }}>{edu.degree} in {edu.field}</div>
                <div style={{ fontSize: '13px', color: '#8892b0' }}>{edu.institution}</div>
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#4a5480' }}>
                  {edu.start_date} — {edu.end_date} {edu.gpa && `· GPA: ${edu.gpa}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {aiProfile?.improvement_suggestions && aiProfile.improvement_suggestions.length > 0 && (
        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fcd34d' }}>💡 AI Improvement Tips</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {aiProfile.improvement_suggestions.map((s: string, i: number) => (
              <div key={i} style={{ fontSize: '13px', color: '#c8cce0' }}>• {s}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AIChat({ resumeId }: { resumeId?: string }) {
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    "What are my strongest skills?",
    "How can I improve my resume?",
    "What roles am I best suited for?",
    "What skills should I learn next?",
    "Write a professional summary for me",
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    const token = getToken();
    try {
      const res = await fetch(`${API}/api/resume/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, resume_id: resumeId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Failed to reach AI. Is the backend running?' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '420px' }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '16px' }}>🤖</span>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: 'white', fontSize: '14px' }}>AI Career Coach</span>
        <span style={{ fontSize: '11px', color: '#4a5480' }}>Ask anything about your resume</span>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p style={{ fontSize: '13px', color: '#4a5480', marginBottom: '16px' }}>Ask the AI about your resume, career, or job search</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {suggestedQuestions.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.5,
              background: m.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              color: m.role === 'user' ? '#e8eaf6' : '#c8cce0',
              border: m.role === 'user' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
              borderBottomRightRadius: m.role === 'user' ? '4px' : '14px',
              borderBottomLeftRadius: m.role === 'ai' ? '4px' : '14px',
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '4px', padding: '12px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4a5480', animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
        <input className="input-field" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about your resume..." style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => sendMessage()} disabled={loading || !input.trim()}
          style={{ padding: '10px 16px', fontSize: '13px' }}>
          {loading ? '...' : '➤'}
        </button>
      </div>
    </div>
  );
}

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

          {/* Upload dropzone */}
          <div id="resume-upload-zone"
            style={{
              borderRadius: '16px', border: '2px dashed', padding: '32px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
              borderColor: dragOver ? '#6366f1' : 'rgba(255,255,255,0.1)',
              background: dragOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
              transform: dragOver ? 'scale(1.02)' : 'scale(1)',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={handleFileChange} />
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>{uploading ? '⏳' : '📄'}</div>
            <div style={{ fontWeight: 600, color: 'white', marginBottom: '4px', fontSize: '14px' }}>
              {uploading ? 'Uploading...' : 'Drop your resume here'}
            </div>
            <div style={{ fontSize: '12px', marginBottom: '16px', color: '#4a5480' }}>PDF or DOCX · Max 10MB</div>
            <button className="btn-primary" style={{ fontSize: '13px', padding: '8px 20px' }} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Browse File'}
            </button>
          </div>

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
                  <div key={r.id} className="glass-card"
                    onClick={() => setPrimaryResume(r)}
                    style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderColor: r.id === primaryResume?.id ? 'rgba(99,102,241,0.4)' : undefined }}>
                    <span style={{ fontSize: '20px' }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: r.parse_status === 'done' ? '#6ee7b7' : r.parse_status === 'parsing' ? '#fcd34d' : '#64748b' }}>
                          {r.parse_status === 'done' ? '✓ Parsed' : r.parse_status === 'parsing' ? `⏳ Parsing (${r.parse_percent || 10}%)` : r.parse_status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                        </span>
                        {r.is_primary && <span className="badge badge-brand" style={{ fontSize: '10px' }}>Primary</span>}
                      </div>
                    </div>
                    {r.parse_status === 'done' && (
                      <button onClick={e => { e.stopPropagation(); handleReparse(r.id); }}
                        style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', color: '#4a5480', background: 'rgba(255,255,255,0.04)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        🔄
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Profile Card */}
          {primaryResume?.ai_profile && (
            <div className="premium-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>🤖</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', fontSize: '14px' }}>AI Profile Insights</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#8892b0' }}>Years Experience</span>
                  <span style={{ color: 'white', fontWeight: 500 }}>{primaryResume.parsed_data?.years_of_experience || '?'} yrs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#8892b0' }}>Seniority</span>
                  <span style={{ color: 'white', fontWeight: 500, textTransform: 'capitalize' }}>{primaryResume.parsed_data?.seniority_level || '?'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#8892b0' }}>Resume Score</span>
                  <span className="gradient-text" style={{ fontWeight: 700 }}>{primaryResume.ai_profile?.resume_score || '?'}/100</span>
                </div>
              </div>
              {primaryResume.ai_profile?.target_roles && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '11px', marginBottom: '8px', color: '#4a5480' }}>Suggested roles to search:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {primaryResume.ai_profile.target_roles.slice(0, 5).map((r: string) => (
                      <span key={r} className="badge badge-brand" style={{ fontSize: '10px' }}>{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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

              {/* AI Chat */}
              {primaryResume.parse_status === 'done' && (
                <div className="premium-card" style={{ overflow: 'hidden' }}>
                  <AIChat resumeId={primaryResume.id} />
                </div>
              )}
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
    </div>
  );
}
