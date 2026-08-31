import React from 'react';

interface ResumeCardProps {
  resume: any;
  primaryResume: any;
  setPrimaryResume: (resume: any) => void;
  handleReparse: (id: string) => void;
  handleDelete: (id: string) => void;
}

export function ResumeCard({ resume: r, primaryResume, setPrimaryResume, handleReparse, handleDelete }: ResumeCardProps) {
  return (
    <div className="glass-card"
      onClick={() => setPrimaryResume(r)}
      style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderColor: r.id === primaryResume?.id ? 'rgba(99,102,241,0.4)' : undefined }}>
      <span style={{ fontSize: '20px' }}>📄</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: r.parse_status === 'done' ? '#6ee7b7' : r.parse_status === 'parsing' ? '#fcd34d' : '#64748b' }}>
            {r.parse_status === 'done' ? '✓ Parsed' : r.parse_status === 'parsing' ? `⚡ Parsing (${r.parse_percent || 10}%)` : r.parse_status === 'failed' ? '❌ Failed' : '⏳ Pending'}
          </span>
          {r.is_primary && <span className="badge badge-brand" style={{ fontSize: '10px' }}>Primary</span>}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {r.parse_status === 'done' && (
          <button onClick={e => { e.stopPropagation(); handleReparse(r.id); }}
            title="Reparse Resume"
            style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', color: '#4a5480', background: 'rgba(255,255,255,0.04)', border: 'none', cursor: 'pointer' }}>
            🔄
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
          title="Delete Resume"
          style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer' }}>
          🗑️
        </button>
      </div>
    </div>
  );
}
