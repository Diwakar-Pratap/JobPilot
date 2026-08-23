import React from 'react';

export function AiProfileView({ primaryResume }: { primaryResume: any }) {
  if (!primaryResume?.ai_profile) return null;
  return (
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
  );
}
