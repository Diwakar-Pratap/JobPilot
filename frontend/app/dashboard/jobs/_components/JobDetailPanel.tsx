'use client';

import { useState } from 'react';
import { getToken, getScoreColor } from './JobCard';

const API = '';

function JobDetailPanel({ job, onClose, onSave, onAutoApply }: any) {
  const [matchData, setMatchData] = useState<any>(null);
  const [matching, setMatching] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [generatingCL, setGeneratingCL] = useState(false);
  const [clTone, setClTone] = useState('professional');
  const [showCL, setShowCL] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!job) return null;
  const scoreColor = getScoreColor(matchData?.match_score || job.match_score);

  const handleMatch = async () => {
    setMatching(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/${job.id}/match`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatchData(data);
      } else {
        const err = await res.json();
        alert(err.detail || 'Match failed');
      }
    } catch (e) { alert('Failed to connect to AI'); }
    setMatching(false);
  };

  const handleGenerateCL = async () => {
    setGeneratingCL(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/${job.id}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tone: clTone }),
      });
      if (res.ok) {
        const data = await res.json();
        setCoverLetter(data.cover_letter);
        setShowCL(true);
      } else {
        const err = await res.json();
        alert(err.detail || 'Cover letter generation failed');
      }
    } catch (e) { alert('Failed to generate cover letter'); }
    setGeneratingCL(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayScore = matchData?.match_score || job.match_score;
  const matchingSkills = matchData?.matching_skills || [];
  const missingSkills = matchData?.missing_skills || [];
  const recommendation = matchData?.recommendation;

  return (
    <div className="animate-slide-in-right" style={{ position: 'fixed', top: 0, bottom: 0, right: 0, zIndex: 50, width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', background: '#0d1326', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 30px rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '20px', flexShrink: 0, overflow: 'hidden', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
          {job.company_logo ? <img src={job.company_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} /> : job.company[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{job.title}</h2>
          <p style={{ fontSize: '14px', marginTop: '4px', color: '#8892b0' }}>{job.company} · {job.location}</p>
        </div>
        <button onClick={onClose} style={{ fontSize: '20px', color: '#4a5480', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Match Score */}
        {displayScore ? (
          <div style={{ padding: '16px', borderRadius: '12px', background: `${scoreColor}10`, border: `1px solid ${scoreColor}25` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: scoreColor }}>AI Match Score</span>
                {recommendation && <span style={{ fontSize: '11px', marginLeft: '8px', color: '#8892b0' }}>— {recommendation}</span>}
              </div>
              <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '24px', fontWeight: 900, color: scoreColor }}>{displayScore}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${displayScore}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}cc)` }} />
            </div>
          </div>
        ) : (
          <button onClick={handleMatch} disabled={matching} className="btn-secondary"
            style={{ width: '100%', padding: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {matching ? (
              <><span className="animate-spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a5b4fc', borderRadius: '50%' }} /> Analyzing with AI...</>
            ) : '🤖 Match Me with AI'}
          </button>
        )}

        {/* Matching & Missing Skills */}
        {matchingSkills.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 600, color: '#6ee7b7', fontSize: '13px', marginBottom: '8px' }}>✓ Matching Skills ({matchingSkills.length})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {matchingSkills.map((s: string) => (
                <span key={s} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' }}>✓ {s}</span>
              ))}
            </div>
          </div>
        )}
        {missingSkills.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 600, color: '#fca5a5', fontSize: '13px', marginBottom: '8px' }}>⚠ Missing Skills ({missingSkills.length})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {missingSkills.map((s: string) => (
                <span key={s} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>✗ {s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Quick info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { icon: '🏢', label: 'Work Mode', value: job.work_mode },
            { icon: '💼', label: 'Job Type', value: job.job_type },
            { icon: '💰', label: 'Salary', value: job.salary_display },
            { icon: '⭐', label: 'Level', value: job.experience_level },
          ].filter(i => i.value).map((i) => (
            <div key={i.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '12px', marginBottom: '4px', color: '#4a5480' }}>{i.icon} {i.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'white', textTransform: 'capitalize' }}>{i.value}</div>
            </div>
          ))}
        </div>

        {/* Skills Required */}
        {job.skills_required && job.skills_required.length > 0 && (
          <div>
            <h3 style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>Skills Required</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {job.skills_required.map((skill: string) => {
                const isMatch = matchingSkills.includes(skill);
                return (
                  <span key={skill} style={{
                    fontSize: '12px', padding: '4px 12px', borderRadius: '999px',
                    background: isMatch ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)',
                    color: isMatch ? '#6ee7b7' : '#a5b4fc',
                    border: `1px solid ${isMatch ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`,
                  }}>
                    {isMatch ? '✓ ' : ''}{skill}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        {job.description && (
          <div>
            <h3 style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>Job Description</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#8892b0' }}>
              {job.description}
            </p>
          </div>
        )}

        {/* Cover Letter Section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
          <h3 style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '12px' }}>✉️ AI Cover Letter</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {['professional', 'conversational', 'concise'].map(tone => (
              <button key={tone} onClick={() => setClTone(tone)}
                style={{
                  fontSize: '12px', padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                  background: clTone === tone ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  color: clTone === tone ? '#a5b4fc' : '#8892b0',
                  border: `1px solid ${clTone === tone ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  textTransform: 'capitalize',
                }}>
                {tone}
              </button>
            ))}
          </div>
          <button onClick={handleGenerateCL} disabled={generatingCL} className="btn-secondary"
            style={{ width: '100%', padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {generatingCL ? (
              <><span className="animate-spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a5b4fc', borderRadius: '50%' }} /> Generating...</>
            ) : `✨ Generate ${clTone} Cover Letter`}
          </button>

          {showCL && coverLetter && (
            <div style={{ marginTop: '12px' }} className="animate-fade-in">
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '13px', lineHeight: 1.7, color: '#c8cce0', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                {coverLetter}
              </div>
              <button onClick={copyToClipboard}
                style={{ marginTop: '8px', fontSize: '12px', padding: '6px 16px', borderRadius: '8px', background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', color: copied ? '#6ee7b7' : '#a5b4fc', border: `1px solid ${copied ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`, cursor: 'pointer' }}>
                {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          id={`detail-auto-apply-${job.id}`}
          onClick={() => onAutoApply(job)}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
          ⚡ Auto Apply with AI
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onSave(job.id)} className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}>
            📌 Save Job
          </button>
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textDecoration: 'none' }}>
            Open in Browser ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default JobDetailPanel;
export { JobDetailPanel };
