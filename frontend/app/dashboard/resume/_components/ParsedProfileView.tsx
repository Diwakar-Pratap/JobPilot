import React from 'react';

export function SkillTag({ skill, matched }: { skill: string; matched?: boolean }) {
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

export function ParsedProfileView({ data, aiProfile }: any) {
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
