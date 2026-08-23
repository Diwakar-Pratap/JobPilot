'use client';
import React, { useState } from 'react';

const API = '';
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''; }

export function ATSMatcher({ primaryResume }: { primaryResume: any }) {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || !primaryResume) return;
    setLoading(true);
    setResult(null);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/resume/${primaryResume.id}/analyze-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_description: jobDescription })
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        alert('Failed to analyze resume');
      }
    } catch (e) {
      alert('Network error');
    }
    setLoading(false);
  };

  if (!primaryResume || primaryResume.parse_status !== 'done') {
    return <div style={{ padding: '24px', color: '#8892b0' }}>Please wait for your resume to be parsed by AI before using the ATS Matcher.</div>;
  }

  return (
    <div className="premium-card" style={{ padding: '24px', marginTop: '24px' }}>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', marginBottom: '16px' }}>
        🎯 ATS Resume Tailor
      </h3>
      <p style={{ color: '#8892b0', fontSize: '13px', marginBottom: '16px' }}>
        Paste a job description below to see how well your resume matches. AI will suggest missing skills and specific resume improvements.
      </p>
      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="Paste Job Description here..."
        style={{
          width: '100%', height: '120px', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px',
          color: 'white', fontSize: '14px', marginBottom: '16px', resize: 'vertical'
        }}
      />
      <button 
        onClick={handleAnalyze} 
        disabled={loading || !jobDescription.trim()}
        className="btn-primary"
        style={{ width: '100%', marginBottom: '24px' }}
      >
        {loading ? '🧠 AI is analyzing...' : 'Analyze Match Score'}
      </button>

      {result && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: `conic-gradient(#10b981 ${result.match_score}%, rgba(255,255,255,0.1) 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ 
                width: '70px', height: '70px', borderRadius: '50%', background: 'var(--surface-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: 700, color: '#10b981'
              }}>
                {result.match_score}%
              </div>
            </div>
            <div>
              <h4 style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>ATS Match Score</h4>
              <p style={{ color: '#8892b0', fontSize: '13px' }}>Based on keyword & semantic overlap</p>
            </div>
          </div>

          {result.missing_skills?.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#ef4444', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>❌ Missing Skills to Add</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.missing_skills.map((s: string, i: number) => (
                  <span key={i} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.matching_skills?.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: '#10b981', fontSize: '14px', marginBottom: '8px', fontWeight: 600 }}>✅ Matching Skills</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.matching_skills.map((s: string, i: number) => (
                  <span key={i} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {result.suggestions?.length > 0 && (
            <div>
              <h4 style={{ color: 'white', fontSize: '14px', marginBottom: '12px', fontWeight: 600 }}>💡 Resume Improvement Suggestions</h4>
              <ul style={{ paddingLeft: '20px', color: '#a5b4fc', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.suggestions.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
