'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

const WORK_MODES = ['remote', 'hybrid', 'onsite'];
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship'];
const SORT_OPTIONS = [
  { value: 'newest', label: '🕐 Newest First' },
  { value: 'match', label: '🎯 Best Match' },
  { value: 'salary', label: '💰 Salary High→Low' },
];

// Compute a local keyword match % between job and user's target roles
function computeLocalMatch(job: any, targetRoles: string[]): number {
  if (!targetRoles.length) return 0;
  const jobText = `${job.title} ${(job.skills_required || []).join(' ')} ${job.description || ''}`.toLowerCase();
  let totalKeywords = 0;
  let matchedKeywords = 0;
  for (const role of targetRoles) {
    const words = role.toLowerCase().split(/[\s,/]+/).filter(w => w.length > 2);
    for (const word of words) {
      totalKeywords++;
      if (jobText.includes(word)) matchedKeywords++;
    }
  }
  if (totalKeywords === 0) return 0;
  return Math.round((matchedKeywords / totalKeywords) * 100);
}

function getScoreColor(score: number | null) {
  if (!score) return '#4a5480';
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#f59e0b';
  if (score >= 50) return '#6366f1';
  return '#ef4444';
}

function getWorkModeColor(mode: string) {
  if (mode === 'remote') return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' };
  if (mode === 'hybrid') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
  return { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' };
}

function MatchRing({ score }: { score: number }) {
  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="22" cy="22" r="16" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '11px', fontWeight: 800, color,
      }}>
        {score}%
      </div>
    </div>
  );
}

function JobCard({ job, onSave, onAutoApply, onViewDetails, matchPercent }: any) {
  const workColors = getWorkModeColor(job.work_mode || 'onsite');
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!job.application_status);
  const displayMatch = job.match_score || matchPercent || 0;

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) return;
    setSaving(true);
    await onSave(job.id);
    setSaving(false);
    setSaved(true);
  };

  const handleAutoApply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setApplying(true);
    await onAutoApply(job);
    setApplying(false);
  };

  return (
    <div className="premium-card" style={{ padding: '20px', cursor: 'pointer', position: 'relative' }} onClick={() => onViewDetails(job)}>
      {/* Bookmark/Save icon — top right */}
      <button
        id={`save-job-${job.id}`}
        onClick={handleSave}
        disabled={saving || saved}
        title={saved ? 'Saved' : 'Save job'}
        style={{
          position: 'absolute', top: '14px', right: '14px',
          width: '32px', height: '32px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', cursor: saved ? 'default' : 'pointer',
          background: saved ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${saved ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
          color: saved ? '#a5b4fc' : '#4a5480',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { if (!saved) { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)'; (e.currentTarget as HTMLElement).style.color = '#a5b4fc'; } }}
        onMouseLeave={e => { if (!saved) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#4a5480'; } }}
      >
        {saving ? '...' : saved ? '🔖' : '🏷️'}
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', paddingRight: '40px' }}>
        {/* Company Logo */}
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
          {job.company_logo ? (
            <img src={job.company_logo} alt={job.company} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e: any) => { e.target.style.display = 'none'; e.target.parentElement.textContent = job.company[0]; }} />
          ) : job.company[0]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'white', fontSize: '13px', lineHeight: 1.3, marginBottom: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {job.title}
          </h3>
          <p style={{ color: '#8892b0', fontSize: '13px', fontWeight: 500 }}>{job.company}</p>
        </div>

        {/* Match Ring */}
        {displayMatch > 0 && <MatchRing score={displayMatch} />}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {job.work_mode && (
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 500, color: workColors.color, background: workColors.bg, border: `1px solid ${workColors.border}` }}>
            {job.work_mode === 'remote' ? '🏠' : job.work_mode === 'hybrid' ? '🔀' : '🏢'} {job.work_mode}
          </span>
        )}
        {job.job_type && (
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: '#8892b0', border: '1px solid rgba(255,255,255,0.08)' }}>{job.job_type}</span>
        )}
        {job.location && (
          <span style={{ fontSize: '11px', color: '#4a5480' }}>📍 {job.location}</span>
        )}
      </div>

      {/* Salary */}
      {job.salary_display && (
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#c8cce0' }}>
          💰 {job.salary_display}
        </div>
      )}

      {/* Skills preview */}
      {job.skills_required && job.skills_required.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {job.skills_required.slice(0, 4).map((skill: string) => (
            <span key={skill} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.15)' }}>
              {skill}
            </span>
          ))}
          {job.skills_required.length > 4 && (
            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', color: '#4a5480' }}>
              +{job.skills_required.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Source badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: '#4a5480', border: '1px solid rgba(255,255,255,0.06)', textTransform: 'capitalize' }}>
          via {job.source}
        </span>
        {job.posted_at && (
          <span style={{ fontSize: '11px', color: '#4a5480' }}>
            {new Date(job.posted_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* CTA Buttons */}
      {job.application_status && job.application_status !== 'saved' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: '11px', padding: '4px 12px', borderRadius: '999px', fontWeight: 600,
            background: job.application_status === 'applied' ? 'rgba(16,185,129,0.15)' :
                        job.application_status === 'interview' ? 'rgba(99,102,241,0.15)' :
                        job.application_status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
            color: job.application_status === 'applied' ? '#6ee7b7' :
                   job.application_status === 'interview' ? '#a5b4fc' :
                   job.application_status === 'rejected' ? '#fca5a5' : '#a5b4fc',
          }}>
            {job.application_status === 'applied' ? '✓ Applied' :
             job.application_status === 'interview' ? '🎙️ Interview' :
             job.application_status === 'rejected' ? '✗ Rejected' : '📌 Saved'}
          </span>
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: '#8892b0', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}>
            View ↗
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
          <button
            id={`auto-apply-${job.id}`}
            onClick={handleAutoApply}
            disabled={applying}
            style={{
              flex: 1, padding: '9px 0', fontSize: '12px', fontWeight: 600, borderRadius: '10px',
              background: applying ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', border: 'none', cursor: applying ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: applying ? 'none' : '0 4px 15px rgba(99,102,241,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {applying ? 'Starting...' : '⚡ Auto Apply'}
          </button>
          <a
            href={job.url || job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, padding: '9px 0', fontSize: '12px', fontWeight: 600, borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              color: '#c8cce0', border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#c8cce0'; }}
            onClick={e => e.stopPropagation()}
          >
            ✍️ Manual Apply
          </a>
        </div>
      )}
    </div>
  );
}


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

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [jobType, setJobType] = useState('');
  const [experience, setExperience] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [autoApplyJob, setAutoApplyJob] = useState<any>(null);
  const [autoApplyStatus, setAutoApplyStatus] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Target roles state (auto-loaded from user settings)
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('all');
  const [totalJobs, setTotalJobs] = useState(0);

  // Job preferences edit states
  const [showPreferences, setShowPreferences] = useState(false);
  const [targetRolesInput, setTargetRolesInput] = useState('');
  const [targetLocationsInput, setTargetLocationsInput] = useState('');
  const [expectedSalaryInput, setExpectedSalaryInput] = useState('');
  const [workPreferenceInput, setWorkPreferenceInput] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // LinkedIn / Naukri / Wellfound states
  const [activeTab, setActiveTab] = useState('match'); // 'match' | 'linkedin' | 'naukri' | 'wellfound'
  const [linkedinMode, setLinkedinMode] = useState('jobs'); // 'jobs' | 'posts'
  const [liResults, setLiResults] = useState<any[]>([]);
  const [liPosts, setLiPosts] = useState<any[]>([]);
  const [naukriResults, setNaukriResults] = useState<any[]>([]);
  const [wellfoundResults, setWellfoundResults] = useState<any[]>([]);

  // Per-platform daemon state
  const [liDaemonStatus, setLiDaemonStatus] = useState<any>(null);
  const [liDaemonStarting, setLiDaemonStarting] = useState(false);
  const [naukriDaemonStatus, setNaukriDaemonStatus] = useState<any>(null);
  const [naukriDaemonStarting, setNaukriDaemonStarting] = useState(false);
  const [wfDaemonStatus, setWfDaemonStatus] = useState<any>(null);
  const [wfDaemonStarting, setWfDaemonStarting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Fetch user's target roles on mount
  useEffect(() => {
    const fetchProfileAndStatus = async () => {
      const token = getToken();
      try {
        const res = await fetch(`${API}/api/settings/profile`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.target_roles) {
            const roles = data.target_roles.split(',').map((r: string) => r.trim()).filter(Boolean);
            setTargetRoles(roles);
            setTargetRolesInput(data.target_roles || '');
            if (roles.length > 0) {
              if (activeRoleFilter === 'all') {
                setActiveRoleFilter(roles[0]);
              }
            }
          }
          setTargetLocationsInput(data.target_locations || '');
          setExpectedSalaryInput(data.expected_salary || '');
          setWorkPreferenceInput(data.work_preference || '');
          if (data.years_of_experience !== undefined && data.years_of_experience !== null) {
            setExperience(String(data.years_of_experience));
          }
        }
      } catch (e) {}
    };
    fetchProfileAndStatus();
  }, []);

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/settings/job-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_roles: targetRolesInput,
          target_locations: targetLocationsInput,
          expected_salary: expectedSalaryInput,
          work_preference: workPreferenceInput,
        }),
      });
      if (res.ok) {
        showToast('✓ Job preferences updated!');
        const roles = targetRolesInput.split(',').map((r: string) => r.trim()).filter(Boolean);
        setTargetRoles(roles);
        if (roles.length > 0) {
          setActiveRoleFilter(roles[0]);
        } else {
          setActiveRoleFilter('all');
        }
        fetchJobs();
        setShowPreferences(false);
      } else {
        const d = await res.json();
        showToast(`❌ ${d.detail || 'Failed to save settings'}`);
      }
    } catch (e) {
      showToast('❌ Error saving preferences');
    }
    setSavingPrefs(false);
  };


  // ─── LinkedIn daemon helpers ───────────────────────────────────────────────
  const fetchDaemonStatus = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/linkedin/daemon-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLiDaemonStatus(await res.json());
    } catch (e) {}
  };

  const startDaemonBrowser = async () => {
    setLiDaemonStarting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/linkedin/daemon-start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('✓ LinkedIn scraper browser launched!'); fetchDaemonStatus(); }
      else { const err = await res.json(); showToast(`❌ ${err.detail || 'Failed to start LinkedIn browser'}`); }
    } catch (e) { showToast('❌ Connection error'); }
    setLiDaemonStarting(false);
  };

  const stopDaemonBrowser = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/linkedin/daemon-stop`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('✓ LinkedIn scraper stopped'); fetchDaemonStatus(); }
    } catch (e) {}
  };

  // ─── Naukri daemon helpers ──────────────────────────────────────────────────
  const fetchNaukriDaemonStatus = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/naukri/daemon-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNaukriDaemonStatus(await res.json());
    } catch (e) {}
  };

  const startNaukriDaemon = async () => {
    setNaukriDaemonStarting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/naukri/daemon-start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('✓ Naukri scraper browser launched!'); fetchNaukriDaemonStatus(); }
      else { const err = await res.json(); showToast(`❌ ${err.detail || 'Failed to start Naukri browser'}`); }
    } catch (e) { showToast('❌ Connection error'); }
    setNaukriDaemonStarting(false);
  };

  const stopNaukriDaemon = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/naukri/daemon-stop`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('✓ Naukri scraper stopped'); fetchNaukriDaemonStatus(); }
    } catch (e) {}
  };

  // ─── Wellfound daemon helpers ───────────────────────────────────────────────
  const fetchWfDaemonStatus = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/wellfound/daemon-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWfDaemonStatus(await res.json());
    } catch (e) {}
  };

  const startWfDaemon = async () => {
    setWfDaemonStarting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/wellfound/daemon-start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('✓ Wellfound scraper browser launched!'); fetchWfDaemonStatus(); }
      else { const err = await res.json(); showToast(`❌ ${err.detail || 'Failed to start Wellfound browser'}`); }
    } catch (e) { showToast('❌ Connection error'); }
    setWfDaemonStarting(false);
  };

  const stopWfDaemon = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/wellfound/daemon-stop`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { showToast('✓ Wellfound scraper stopped'); fetchWfDaemonStatus(); }
    } catch (e) {}
  };


  const fetchDaemonSyncedData = async () => {
    const token = getToken();
    try {
      // 1. Fetch synced jobs (source=linkedin) with sorting parameter
      const jobsRes = await fetch(`${API}/api/jobs/?source=linkedin&limit=50&sort=${sortBy}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setLiResults(jobsData.jobs || []);
      }

      // 2. Fetch synced posts (alerts of type 'linkedin')
      const alertsRes = await fetch(`${API}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        const posts = (alertsData || [])
          .filter((n: any) => n.type === 'linkedin')
          .map((n: any) => ({
            author: n.data?.author || 'Unknown Author',
            content_preview: n.message,
            link: n.data?.link,
            posted_time: n.created_at,
            extracted_recruiter: true
          }));
        setLiPosts(posts);
      }
    } catch (e) {}
  };

  const fetchNaukriData = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/?source=naukri&limit=50&sort=${sortBy}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNaukriResults(data.jobs || []);
      }
    } catch (e) {}
  };

  const fetchWellfoundData = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/?source=wellfound&limit=50&sort=${sortBy}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWellfoundResults(data.jobs || []);
      }
    } catch (e) {}
  };

  const handleExportExcel = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/jobs/export/excel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recruiters.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('✓ Excel export downloaded!');
      } else {
        showToast('❌ Failed to export Excel');
      }
    } catch (e) {
      showToast('❌ Network error during export');
    }
  };

  // Poll LinkedIn daemon when on LinkedIn tab
  useEffect(() => {
    if (activeTab !== 'linkedin') return;
    fetchDaemonStatus();
    fetchDaemonSyncedData();
    const interval = setInterval(() => { fetchDaemonStatus(); fetchDaemonSyncedData(); }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, sortBy]);

  // Poll Naukri daemon when on Naukri tab
  useEffect(() => {
    if (activeTab !== 'naukri') return;
    fetchNaukriDaemonStatus();
    fetchNaukriData();
    const interval = setInterval(() => { fetchNaukriDaemonStatus(); fetchNaukriData(); }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, sortBy]);

  // Poll Wellfound daemon when on Wellfound tab
  useEffect(() => {
    if (activeTab !== 'wellfound') return;
    fetchWfDaemonStatus();
    fetchWellfoundData();
    const interval = setInterval(() => { fetchWfDaemonStatus(); fetchWellfoundData(); }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, sortBy]);
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const token = getToken();
    const params = new URLSearchParams({ page: String(page), limit: '18' });
    if (search) params.append('q', search);
    if (workMode) params.append('work_mode', workMode);
    if (jobType) params.append('job_type', jobType);
    if (experience) params.append('experience', experience);
    if (sortBy) params.append('sort', sortBy);
    // Auto-filter by role
    if (activeRoleFilter && activeRoleFilter !== 'all') {
      params.append('role', activeRoleFilter);
    }

    try {
      const res = await fetch(`${API}/api/jobs/?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setTotalPages(data.pages);
        setTotalJobs(data.total);
      }
    } catch (e) {}
    setLoading(false);
  }, [page, search, workMode, jobType, experience, sortBy, activeRoleFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleSave = async (jobId: string) => {
    const token = getToken();
    try {
      await fetch(`${API}/api/applications/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId, status: 'saved' }),
      });
      showToast('✓ Job saved to your applications!');
      fetchJobs();
    } catch (e) { showToast('Failed to save job'); }
  };

  const handleAutoApply = async (job: any) => {
    setAutoApplyJob(job);
    setAutoApplyStatus('');
    setIsApplying(false);
  };

  const startAutoApply = async () => {
    if (!autoApplyJob) return;
    setIsApplying(true);
    setAutoApplyStatus('🤖 AI Agent is opening the browser...\n⏳ Please watch the browser window and do not close it.');

    const token = getToken();
    try {
      let appId = "";
      const saveRes = await fetch(`${API}/api/applications/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: autoApplyJob.id, status: 'pending' }),
      });
      
      if (saveRes.ok) {
        const saveData = await saveRes.json();
        appId = saveData.id;
      } else {
        const listRes = await fetch(`${API}/api/applications/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (listRes.ok) {
          const apps = await listRes.json();
          const existingApp = apps.find((a: any) => a.job?.id === autoApplyJob.id);
          if (existingApp) appId = existingApp.id;
        }
      }

      if (!appId) throw new Error("Could not initialize application record.");

      setAutoApplyStatus('🌐 Opening headed browser on your desktop...\n⏳ Please watch the browser window and do not close it!\n📝 AI is analyzing the application form fields...');
      
      const applyRes = await fetch(`${API}/api/applications/${appId}/auto-apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (applyRes.ok) {
        setAutoApplyStatus('🚀 AI browser automation successfully launched!\n\n✍️ Playwright is currently auto-filling all parsed resume details, locations, links, and contact information...\n📎 Uploading your primary resume file...\n\n✅ Form filling complete! Please review and click Submit manually in the headed browser window.');
      } else {
        const err = await applyRes.json();
        throw new Error(err.detail || "Failed to trigger auto-apply browser agent.");
      }
    } catch (e: any) {
      setAutoApplyStatus(`❌ Failed to start automation: ${e.message || e}`);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Find Jobs</h1>
          <p style={{ fontSize: '14px', color: '#8892b0' }}>
            AI-matched opportunities based on your resume and preferences
            {totalJobs > 0 && <span style={{ color: '#a5b4fc' }}> · {totalJobs} jobs found</span>}
          </p>
        </div>
        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            fontSize: '13px',
            borderRadius: '10px',
            cursor: 'pointer',
            border: showPreferences ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
            background: showPreferences ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
            color: showPreferences ? '#a5b4fc' : '#c8cce0',
            transition: 'all 0.2s',
          }}
        >
          ⚙️ {showPreferences ? 'Close Preferences' : 'Edit Search Preferences'}
        </button>
      </div>

      {/* Collapsible Search Preferences Panel */}
      {showPreferences && (
        <div className="premium-card animate-fade-in" style={{ padding: '20px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.25)', background: 'linear-gradient(135deg, rgba(19,26,53,0.9), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'white', fontSize: '15px', margin: 0 }}>Edit Search Preferences</h3>
            <span style={{ fontSize: '11px', color: '#4a5480', marginLeft: 'auto' }}>These settings are used to match jobs and filter live scrapers</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c8cce0', marginBottom: '6px' }}>Target Roles (comma-separated)</label>
              <input
                type="text"
                className="input-field"
                value={targetRolesInput}
                onChange={e => setTargetRolesInput(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer, Full Stack Dev"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c8cce0', marginBottom: '6px' }}>Preferred Locations (comma-separated)</label>
              <input
                type="text"
                className="input-field"
                value={targetLocationsInput}
                onChange={e => setTargetLocationsInput(e.target.value)}
                placeholder="e.g. Remote, India, New York"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c8cce0', marginBottom: '6px' }}>Expected Salary</label>
              <input
                type="text"
                className="input-field"
                value={expectedSalaryInput}
                onChange={e => setExpectedSalaryInput(e.target.value)}
                placeholder="e.g. $150,000 - $180,000"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#c8cce0', marginBottom: '6px' }}>Work Mode Preference</label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={workPreferenceInput.includes('remote')}
                    onChange={e => {
                      if (e.target.checked) {
                        const current = workPreferenceInput ? workPreferenceInput.split(',').filter(x => x !== 'NA') : [];
                        setWorkPreferenceInput([...current, 'remote'].join(','));
                      } else {
                        const current = workPreferenceInput.split(',').filter(x => x !== 'remote');
                        setWorkPreferenceInput(current.join(','));
                      }
                    }}
                  />
                  🏠 Remote
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={workPreferenceInput.includes('hybrid')}
                    onChange={e => {
                      if (e.target.checked) {
                        const current = workPreferenceInput ? workPreferenceInput.split(',').filter(x => x !== 'NA') : [];
                        setWorkPreferenceInput([...current, 'hybrid'].join(','));
                      } else {
                        const current = workPreferenceInput.split(',').filter(x => x !== 'hybrid');
                        setWorkPreferenceInput(current.join(','));
                      }
                    }}
                  />
                  🔀 Hybrid
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={workPreferenceInput.includes('onsite')}
                    onChange={e => {
                      if (e.target.checked) {
                        const current = workPreferenceInput ? workPreferenceInput.split(',').filter(x => x !== 'NA') : [];
                        setWorkPreferenceInput([...current, 'onsite'].join(','));
                      } else {
                        const current = workPreferenceInput.split(',').filter(x => x !== 'onsite');
                        setWorkPreferenceInput(current.join(','));
                      }
                    }}
                  />
                  🏢 On-site
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!workPreferenceInput || workPreferenceInput === 'NA' || workPreferenceInput.includes('NA')}
                    onChange={e => {
                      if (e.target.checked) {
                        setWorkPreferenceInput('NA');
                      } else {
                        setWorkPreferenceInput('');
                      }
                    }}
                  />
                  ❓ NA (Any)
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => setShowPreferences(false)}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePreferences}
              disabled={savingPrefs}
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: '12px', opacity: savingPrefs ? 0.7 : 1 }}
            >
              {savingPrefs ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px', paddingBottom: '2px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('match')}
          style={{
            background: activeTab === 'match' ? 'rgba(99,102,241,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            padding: '8px 18px', fontSize: '13px', fontWeight: 600,
            color: activeTab === 'match' ? '#a5b4fc' : '#4a5480',
            borderBottom: activeTab === 'match' ? '2px solid #6366f1' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
          }}
        >
          🎯 Match Finder
        </button>
        <button
          onClick={() => setActiveTab('linkedin')}
          style={{
            background: activeTab === 'linkedin' ? 'rgba(10,102,194,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            padding: '8px 18px', fontSize: '13px', fontWeight: 600,
            color: activeTab === 'linkedin' ? '#60a5fa' : '#4a5480',
            borderBottom: activeTab === 'linkedin' ? '2px solid #0a66c2' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
          }}
        >
          🔗 LinkedIn
        </button>
        <button
          onClick={() => setActiveTab('naukri')}
          style={{
            background: activeTab === 'naukri' ? 'rgba(74,144,226,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            padding: '8px 18px', fontSize: '13px', fontWeight: 600,
            color: activeTab === 'naukri' ? '#93c5fd' : '#4a5480',
            borderBottom: activeTab === 'naukri' ? '2px solid #4a90e2' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, background: 'linear-gradient(135deg,#4a90e2,#357abd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: activeTab === 'naukri' ? 'transparent' : 'inherit' }}>N</span>
            Naukri
          </span>
        </button>
        <button
          onClick={() => setActiveTab('wellfound')}
          style={{
            background: activeTab === 'wellfound' ? 'rgba(16,185,129,0.1)' : 'none',
            border: 'none', cursor: 'pointer',
            padding: '8px 18px', fontSize: '13px', fontWeight: 600,
            color: activeTab === 'wellfound' ? '#34d399' : '#4a5480',
            borderBottom: activeTab === 'wellfound' ? '2px solid #10b981' : '2px solid transparent',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s',
          }}
        >
          🚀 Wellfound
        </button>
      </div>

      {activeTab === 'match' && (
        <>
          {/* ── Role Filter Chips (auto-filter) ── */}
          {targetRoles.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#4a5480', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Your Roles</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setActiveRoleFilter('all'); setPage(1); }}
                  style={{
                    fontSize: '13px', padding: '6px 16px', borderRadius: '999px', fontWeight: 600, cursor: 'pointer',
                    background: activeRoleFilter === 'all' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.04)',
                    color: activeRoleFilter === 'all' ? 'white' : '#8892b0',
                    border: activeRoleFilter === 'all' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: activeRoleFilter === 'all' ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  All Jobs
                </button>
                {targetRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => { setActiveRoleFilter(role); setPage(1); }}
                    style={{
                      fontSize: '13px', padding: '6px 16px', borderRadius: '999px', fontWeight: 600, cursor: 'pointer',
                      background: activeRoleFilter === role ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.04)',
                      color: activeRoleFilter === role ? 'white' : '#8892b0',
                      border: activeRoleFilter === role ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      boxShadow: activeRoleFilter === role ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Filters & Sort ── */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#4a5480' }}>🔍</span>
              <input
                id="job-search"
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="Search by role, company, or skill..."
              />
            </div>

            {/* Work Mode */}
            <select
              id="filter-work-mode"
              value={workMode}
              onChange={e => { setWorkMode(e.target.value); setPage(1); }}
              className="input-field"
              style={{ width: '140px', background: 'rgba(255,255,255,0.04)', color: workMode ? '#e8eaf6' : '#4a5480' }}>
              <option value="">Work Mode</option>
              {WORK_MODES.map(m => <option key={m} value={m} className="bg-dark-900">{m}</option>)}
            </select>

            {/* Job Type */}
            <select
              id="filter-job-type"
              value={jobType}
              onChange={e => { setJobType(e.target.value); setPage(1); }}
              className="input-field"
              style={{ width: '140px', background: 'rgba(255,255,255,0.04)', color: jobType ? '#e8eaf6' : '#4a5480' }}>
              <option value="">Job Type</option>
              {JOB_TYPES.map(t => <option key={t} value={t} className="bg-dark-900">{t}</option>)}
            </select>

            {/* Experience */}
            <input
              id="filter-experience"
              type="number"
              min="0"
              max="50"
              value={experience}
              onChange={e => { setExperience(e.target.value); setPage(1); }}
              className="input-field"
              style={{ width: '130px', background: 'rgba(255,255,255,0.04)', color: experience ? '#e8eaf6' : '#4a5480' }}
              placeholder="Yrs of Exp"
            />

            {/* Divider */}
            <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.08)' }} />

            {/* Sort By */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#4a5480', fontWeight: 600, whiteSpace: 'nowrap' }}>Sort:</span>
              <select
                id="sort-by"
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="input-field"
                style={{ width: '170px', background: 'rgba(255,255,255,0.04)', color: '#e8eaf6' }}>
                {SORT_OPTIONS.map(s => <option key={s.value} value={s.value} className="bg-dark-900">{s.label}</option>)}
              </select>
            </div>

            <button onClick={() => { setSearch(''); setWorkMode(''); setJobType(''); setExperience(''); setSortBy('newest'); setActiveRoleFilter('all'); setPage(1); }}
              style={{
                padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                background: 'rgba(255,255,255,0.04)', color: '#4a5480',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
              }}>
              ✕ Clear
            </button>
          </div>

          {/* ── Job Grid ── */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="shimmer" style={{ height: '280px', borderRadius: '16px' }} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '96px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'white', fontSize: '20px', marginBottom: '8px' }}>No jobs found</h3>
              <p style={{ fontSize: '14px', color: '#4a5480' }}>Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSave={handleSave}
                  onAutoApply={handleAutoApply}
                  onViewDetails={setSelectedJob}
                  matchPercent={job.match_percent || computeLocalMatch(job, targetRoles)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, background: 'rgba(255,255,255,0.04)', color: '#8892b0', border: '1px solid rgba(255,255,255,0.08)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                ← Prev
              </button>
              <span style={{ padding: '8px 16px', fontSize: '13px', color: '#8892b0' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500, background: 'rgba(255,255,255,0.04)', color: '#8892b0', border: '1px solid rgba(255,255,255,0.08)', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
      {activeTab === 'linkedin' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Headed Browser Scraper Daemon Control Panel */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🤖</span>
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', margin: 0 }}>LinkedIn Live Scraper Browser</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Launches a local Chromium window logged into LinkedIn. Tab 1 searches jobs, Tab 2 searches recruiter posts.</p>
                </div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px',
                background: liDaemonStatus?.running ? (liDaemonStatus.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') : 'var(--surface-3)',
                color: liDaemonStatus?.running ? (liDaemonStatus.status === 'active' ? '#6ee7b7' : '#f59e0b') : 'var(--text-muted)',
                border: `1px solid ${liDaemonStatus?.running ? (liDaemonStatus.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)') : 'var(--border)'}`
              }}>
                {liDaemonStatus?.running ? `Running (${liDaemonStatus.status})` : 'Stopped'}
              </span>
            </div>

            {liDaemonStatus?.status === 'auth_required' && (
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                color: '#f59e0b', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                🔑 <strong>Action Required:</strong> Please log in to your LinkedIn account in the opened Chromium browser window. The session will be saved automatically.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {!liDaemonStatus?.running ? (
                <button onClick={startDaemonBrowser} disabled={liDaemonStarting} className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                  🚀 {liDaemonStarting ? 'Launching...' : 'Launch LinkedIn Browser'}
                </button>
              ) : (
                <>
                  <button onClick={stopDaemonBrowser}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                    🛑 Stop LinkedIn Browser
                  </button>
                  <button
                    onClick={async () => { showToast('🔄 Checking login status...'); await fetchDaemonStatus(); await fetchDaemonSyncedData(); }}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    🔄 Check Login Status
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status Indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px',
            background: liDaemonStatus?.running ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.04)',
            border: `1px solid ${liDaemonStatus?.running ? 'rgba(16,185,129,0.15)' : 'var(--border)'}`,
            color: liDaemonStatus?.running ? '#6ee7b7' : 'var(--text-muted)',
            fontSize: '13px'
          }}>
            <span>{
              liDaemonStatus?.running
                ? `✓ LinkedIn Scraper is active. Status: ${liDaemonStatus.status}`
                : '💡 Tip: Click "Launch LinkedIn Browser" above to start scraping LinkedIn jobs and recruiter posts.'
            }</span>
          </div>

          {/* Automatic Scrape Targets Info Box */}
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>🎯 <strong>Scrape Targets:</strong> Scraper daemon searches LinkedIn for your configured Target Roles:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {targetRoles.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None configured. Go to "My Resume" or "Settings" to add some!</span>
              ) : (
                targetRoles.map(role => (
                  <span key={role} className="badge badge-brand">{role}</span>
                ))
              )}
            </div>
          </div>

          {/* Sub-tabs: Jobs vs Posts */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
            <button
              onClick={() => setLinkedinMode('jobs')}
              style={{
                fontSize: '13px', padding: '8px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
                background: linkedinMode === 'jobs' ? 'var(--brand-glow)' : 'var(--surface-2)',
                color: linkedinMode === 'jobs' ? 'var(--brand)' : 'var(--text-muted)',
                border: `1px solid ${linkedinMode === 'jobs' ? 'var(--brand)' : 'var(--border)'}`,
              }}
            >
              💼 Scraped Jobs
            </button>
            <button
              onClick={() => setLinkedinMode('posts')}
              style={{
                fontSize: '13px', padding: '8px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
                background: linkedinMode === 'posts' ? 'var(--brand-glow)' : 'var(--surface-2)',
                color: linkedinMode === 'posts' ? 'var(--brand)' : 'var(--text-muted)',
                border: `1px solid ${linkedinMode === 'posts' ? 'var(--brand)' : 'var(--border)'}`,
              }}
            >
              📝 Recruiter Leads
            </button>
            {linkedinMode === 'posts' && (
              <button
                onClick={handleExportExcel}
                className="btn-secondary"
                style={{
                  fontSize: '13px', padding: '8px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)'
                }}
              >
                📥 Export Recruiter Leads to Excel
              </button>
            )}
          </div>

          {/* Results view */}
          {linkedinMode === 'jobs' ? (
            liResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface-2)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <p style={{ color: 'var(--text-muted)' }}>No scraped jobs synced yet. Make sure the scraper daemon is running.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>💼 Scraped Jobs ({liResults.length})</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="input-field"
                      style={{ width: '140px', background: 'var(--surface-2)', color: 'var(--text)', padding: '6px 12px', height: '32px', fontSize: '12px' }}
                    >
                      <option value="newest">🕐 Newest First</option>
                      <option value="match">🎯 Best Match</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {liResults.map((job, idx) => (
                    <JobCard
                      key={`${job.id}-${idx}`}
                      job={job}
                      onSave={handleSave}
                      onAutoApply={handleAutoApply}
                      onViewDetails={(j: any) => {
                        const fetchFullJob = async () => {
                          const token = getToken();
                          const r = await fetch(`${API}/api/jobs/${j.id}`, { headers: { Authorization: `Bearer ${token}` } });
                          if (r.ok) setSelectedJob(await r.json());
                          else setSelectedJob(j);
                        };
                        fetchFullJob();
                      }}
                      matchPercent={job.match_percent}
                    />
                  ))}
                </div>
              </>
            )
          ) : (
            liPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface-2)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <p style={{ color: 'var(--text-muted)' }}>No hiring posts synced yet. Make sure the scraper daemon is running.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>📝 Recruiter Leads ({liPosts.length})</div>
                {liPosts.map((post, idx) => (
                  <div key={idx} className="premium-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                          👤
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-heavy)', fontSize: '14px' }}>{post.author}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{post.posted_time ? new Date(post.posted_time).toLocaleString() : ''}</div>
                        </div>
                      </div>
                      {post.extracted_recruiter && (
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', fontWeight: 600 }}>
                          📥 Recruiter Extracted to Excel
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {post.content_preview}
                    </p>
                    {post.link && (
                      <a href={post.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--brand)', textDecoration: 'none', alignSelf: 'flex-start', fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.textDecoration = 'underline'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.textDecoration = 'none'}
                      >
                        View Post on LinkedIn ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Naukri Tab ── */}
      {activeTab === 'naukri' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Daemon Control Panel */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#4a90e2' }}>N</span>
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', margin: 0 }}>Naukri Live Scraper Browser</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Opens a dedicated Chromium window for Naukri. Searches your target roles &amp; locations automatically.</p>
                </div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px',
                background: naukriDaemonStatus?.running ? (naukriDaemonStatus.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') : 'var(--surface-3)',
                color: naukriDaemonStatus?.running ? (naukriDaemonStatus.status === 'active' ? '#6ee7b7' : '#f59e0b') : 'var(--text-muted)',
                border: `1px solid ${naukriDaemonStatus?.running ? (naukriDaemonStatus.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)') : 'var(--border)'}`
              }}>
                {naukriDaemonStatus?.running ? `Running (${naukriDaemonStatus.status})` : 'Stopped'}
              </span>
            </div>

            {naukriDaemonStatus?.status === 'auth_required' && (
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                color: '#f59e0b', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                🔑 <strong>Action Required:</strong> Please log in to your Naukri account in the opened Chromium browser window. The session will be saved automatically.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {!naukriDaemonStatus?.running ? (
                <button onClick={startNaukriDaemon} disabled={naukriDaemonStarting} className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                  🚀 {naukriDaemonStarting ? 'Launching...' : 'Launch Naukri Browser'}
                </button>
              ) : (
                <>
                  <button onClick={stopNaukriDaemon}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                    🛑 Stop Naukri Browser
                  </button>
                  <button
                    onClick={async () => { showToast('🔄 Checking Naukri login status...'); await fetchNaukriDaemonStatus(); await fetchNaukriData(); }}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    🔄 Check Login Status
                  </button>
                </>
              )}
            </div>

            {/* Status tip */}
            <div style={{
              padding: '10px 14px', borderRadius: '10px', fontSize: '12.5px',
              background: naukriDaemonStatus?.running ? 'rgba(16,185,129,0.06)' : 'rgba(74,144,226,0.05)',
              border: `1px solid ${naukriDaemonStatus?.running ? 'rgba(16,185,129,0.15)' : 'rgba(74,144,226,0.1)'}`,
              color: naukriDaemonStatus?.running ? '#6ee7b7' : 'var(--text-muted)',
            }}>
              {naukriDaemonStatus?.running
                ? `✓ Naukri scraper is active. Status: ${naukriDaemonStatus.status}`
                : '💡 Click "Launch Naukri Browser" to open a dedicated Chromium window for Naukri. Log in once and the session is saved.'}
            </div>
          </div>

          {/* Scrape Targets */}
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>🎯 <strong>Scraping for:</strong></span>
            {targetRoles.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No roles configured. Add them in Settings or Resume.</span>
            ) : (
              targetRoles.map(role => (
                <span key={role} className="badge badge-brand">{role}</span>
              ))
            )}
          </div>

          {/* Naukri Jobs Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>💼 Scraped Naukri Jobs ({naukriResults.length})</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field"
                  style={{ width: '140px', background: 'var(--surface-2)', color: 'var(--text)', padding: '6px 12px', height: '32px', fontSize: '12px' }}>
                  <option value="newest">🕐 Newest First</option>
                  <option value="match">🎯 Best Match</option>
                </select>
              </div>
            </div>
            {naukriResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface-2)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>N</div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '18px', marginBottom: '8px' }}>No Naukri jobs yet</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Launch the Scraper Browser above to start fetching Naukri jobs matching your preferences.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {naukriResults.map((job, idx) => (
                  <JobCard
                    key={`naukri-${job.id}-${idx}`}
                    job={job}
                    onSave={handleSave}
                    onAutoApply={handleAutoApply}
                    onViewDetails={(j: any) => {
                      const fetchFullJob = async () => {
                        const token = getToken();
                        const r = await fetch(`${API}/api/jobs/${j.id}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (r.ok) setSelectedJob(await r.json());
                        else setSelectedJob(j);
                      };
                      fetchFullJob();
                    }}
                    matchPercent={job.match_percent || computeLocalMatch(job, targetRoles)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Wellfound Tab ── */}
      {activeTab === 'wellfound' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Daemon Control Panel */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>🚀</span>
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', margin: 0 }}>Wellfound Live Scraper Browser</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Opens a dedicated Chromium window for Wellfound (AngelList). Searches startup &amp; tech jobs matching your roles.</p>
                </div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px',
                background: wfDaemonStatus?.running ? (wfDaemonStatus.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') : 'var(--surface-3)',
                color: wfDaemonStatus?.running ? (wfDaemonStatus.status === 'active' ? '#6ee7b7' : '#f59e0b') : 'var(--text-muted)',
                border: `1px solid ${wfDaemonStatus?.running ? (wfDaemonStatus.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)') : 'var(--border)'}`
              }}>
                {wfDaemonStatus?.running ? `Running (${wfDaemonStatus.status})` : 'Stopped'}
              </span>
            </div>

            {wfDaemonStatus?.status === 'auth_required' && (
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                color: '#f59e0b', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                🔑 <strong>Action Required:</strong> Please log in to your Wellfound account in the opened Chromium browser window. The session will be saved automatically.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {!wfDaemonStatus?.running ? (
                <button onClick={startWfDaemon} disabled={wfDaemonStarting} className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                  🚀 {wfDaemonStarting ? 'Launching...' : 'Launch Wellfound Browser'}
                </button>
              ) : (
                <>
                  <button onClick={stopWfDaemon}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                    🛑 Stop Wellfound Browser
                  </button>
                  <button
                    onClick={async () => { showToast('🔄 Checking Wellfound login status...'); await fetchWfDaemonStatus(); await fetchWellfoundData(); }}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    🔄 Check Login Status
                  </button>
                </>
              )}
            </div>

            {/* Status tip */}
            <div style={{
              padding: '10px 14px', borderRadius: '10px', fontSize: '12.5px',
              background: wfDaemonStatus?.running ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)',
              border: `1px solid ${wfDaemonStatus?.running ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)'}`,
              color: wfDaemonStatus?.running ? '#6ee7b7' : 'var(--text-muted)',
            }}>
              {wfDaemonStatus?.running
                ? `✓ Wellfound scraper is active. Status: ${wfDaemonStatus.status}`
                : '💡 Click "Launch Wellfound Browser" to open a dedicated Chromium window for Wellfound. Log in once and the session is saved.'}
            </div>
          </div>

          {/* Scrape Targets */}
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>🎯 <strong>Scraping for:</strong></span>
            {targetRoles.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No roles configured. Add them in Settings or Resume.</span>
            ) : (
              targetRoles.map(role => (
                <span key={role} className="badge badge-brand">{role}</span>
              ))
            )}
          </div>

          {/* Wellfound Jobs Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>🚀 Scraped Wellfound Jobs ({wellfoundResults.length})</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field"
                  style={{ width: '140px', background: 'var(--surface-2)', color: 'var(--text)', padding: '6px 12px', height: '32px', fontSize: '12px' }}>
                  <option value="newest">🕐 Newest First</option>
                  <option value="match">🎯 Best Match</option>
                </select>
              </div>
            </div>
            {wellfoundResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface-2)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚀</div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '18px', marginBottom: '8px' }}>No Wellfound jobs yet</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Launch the Scraper Browser above to start fetching startup jobs from Wellfound matching your preferences.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {wellfoundResults.map((job, idx) => (
                  <JobCard
                    key={`wellfound-${job.id}-${idx}`}
                    job={job}
                    onSave={handleSave}
                    onAutoApply={handleAutoApply}
                    onViewDetails={(j: any) => {
                      const fetchFullJob = async () => {
                        const token = getToken();
                        const r = await fetch(`${API}/api/jobs/${j.id}`, { headers: { Authorization: `Bearer ${token}` } });
                        if (r.ok) setSelectedJob(await r.json());
                        else setSelectedJob(j);
                      };
                      fetchFullJob();
                    }}
                    matchPercent={job.match_percent || computeLocalMatch(job, targetRoles)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Job Detail Sidebar ── */}
      {selectedJob && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelectedJob(null)} />
          <JobDetailPanel
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onSave={handleSave}
            onAutoApply={(job: any) => { setSelectedJob(null); setAutoApplyJob(job); }}
          />
        </>
      )}

      {/* ── Auto Apply Modal ── */}
      {autoApplyJob && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => !isApplying && setAutoApplyJob(null)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }} className="animate-scale-in">
            <div style={{ padding: '24px', borderRadius: '16px', background: '#131a35', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'white', fontSize: '20px', marginBottom: '4px' }}>⚡ Auto-Apply with AI</h2>
              <p style={{ fontSize: '14px', marginBottom: '20px', color: '#8892b0' }}>
                AI will open a browser and fill the application for:
              </p>

              <div style={{ padding: '12px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                  {autoApplyJob.company[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'white', fontSize: '14px' }}>{autoApplyJob.title}</div>
                  <div style={{ fontSize: '12px', color: '#8892b0' }}>{autoApplyJob.company}</div>
                </div>
              </div>

              {autoApplyStatus && (
                <div style={{ padding: '16px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: '#c8cce0' }}>
                  {autoApplyStatus}
                </div>
              )}

              {!isApplying ? (
                <>
                  <div style={{ padding: '12px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
                    ⚠️ A browser will open and the AI will fill the form. You can click <strong>Stop Agent</strong> at any time.
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setAutoApplyJob(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: '#8892b0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button id="confirm-auto-apply" onClick={startAutoApply}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }}>
                      🤖 Start Agent
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => { setAutoApplyJob(null); setIsApplying(false); showToast('✓ Agent stopped'); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                    🛑 Stop Agent
                  </button>
                  <button onClick={() => { setAutoApplyJob(null); setIsApplying(false); showToast('✓ Application tracked'); }}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', cursor: 'pointer' }}>
                    ✓ Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="animate-slide-in-right" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 500, color: 'white', background: 'linear-gradient(135deg, #1a2040, #242d55)', border: '1px solid rgba(99,102,241,0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
