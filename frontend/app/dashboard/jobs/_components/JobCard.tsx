'use client';

import React, { useState } from 'react';

function getToken() { return localStorage.getItem('access_token') || ''; }

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

export { getToken, computeLocalMatch, getScoreColor, getWorkModeColor, MatchRing, JobCard };
