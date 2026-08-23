import React from 'react';

export interface ShareTrackerProps {
  shareStats: any[];
  fetchShares: () => void;
  loadingShares: boolean;
  shares: any[];
  handleUpdateStatus: (id: string, status: string) => void;
}

export const ShareTracker: React.FC<ShareTrackerProps> = ({
  shareStats, fetchShares, loadingShares, shares, handleUpdateStatus
}) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px', marginBottom: '16px' }}>
          📊 Click-Through Stats
        </h3>
        {shareStats.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No share stats available yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {shareStats.map((stat, idx) => {
              const ctr = stat.total_shared > 0 ? ((stat.total_opened / stat.total_shared) * 100).toFixed(0) : '0';
              return (
                <div key={idx} className="premium-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-heavy)' }}>{stat.contact_name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Total Shared:</span>
                    <strong style={{ color: 'var(--text-heavy)' }}>{stat.total_shared}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Total Opened:</span>
                    <strong style={{ color: '#25d366' }}>{stat.total_opened}</strong>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>CTR (Open Rate)</span>
                      <strong>{ctr}%</strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${ctr}%`, height: '100%', background: '#25d366', borderRadius: '3px' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px' }}>
            📋 Link Sharing & Click Logs
          </h3>
          <button
            onClick={fetchShares}
            disabled={loadingShares}
            style={{
              padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
              background: 'var(--surface-3)', color: 'var(--text-heavy)', border: '1px solid var(--border)', cursor: 'pointer'
            }}
          >
            {loadingShares ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {loadingShares ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shimmer" style={{ height: '64px', borderRadius: '12px' }} />
            ))}
          </div>
        ) : shares.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📈</div>
            <h4 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, color: 'var(--text-heavy)', fontSize: '16px', marginBottom: '4px' }}>
              No jobs shared yet
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Shared jobs will automatically appear here with click tracking info.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-3)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Recipient</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Job Position</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Shared At</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Opened At</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Applied?</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <tr key={share.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>{share.contact_name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={share.job_title}>
                          {share.job_title}
                        </span>
                        <a href={share.url} target="_blank" rel="noopener noreferrer" title="View Job Link" style={{ textDecoration: 'none', color: '#25d366', fontSize: '14px' }}>
                          🔗
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {share.is_opened ? (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(37,211,102,0.12)', color: '#25d366', fontWeight: 600 }}>
                          Opened
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'var(--surface-3)', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Sent
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(share.shared_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {share.opened_at ? new Date(share.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={share.applied_status}
                        onChange={(e) => handleUpdateStatus(share.id, e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                          background: 'var(--surface-3)', border: '1px solid var(--border)',
                          color: 'var(--text-heavy)', outline: 'none', cursor: 'pointer'
                        }}
                      >
                        <option value="not_asked">Pending</option>
                        <option value="applied">Applied</option>
                        <option value="not_applied">Not Applied</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
