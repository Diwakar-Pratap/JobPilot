import React from 'react';

export interface WhatsAppContactsProps {
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  resetForm: () => void;
  editId: string | null;
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  notifyViaWhatsapp: boolean; setNotifyViaWhatsapp: (v: boolean) => void;
  notifyViaEmail: boolean; setNotifyViaEmail: (v: boolean) => void;
  notifyNewJobs: boolean; setNotifyNewJobs: (v: boolean) => void;
  notifyHighMatch: boolean; setNotifyHighMatch: (v: boolean) => void;
  matchThreshold: number; setMatchThreshold: (v: number) => void;
  handleSubmit: () => void;
  loading: boolean;
  contacts: any[];
  toggleActive: (c: any) => void;
  sendTest: (id: string) => void;
  startEdit: (c: any) => void;
  deleteContact: (id: string) => void;
}

export const WhatsAppContacts: React.FC<WhatsAppContactsProps> = ({
  showAdd, setShowAdd, resetForm, editId, name, setName, phone, setPhone, email, setEmail, notifyViaWhatsapp, setNotifyViaWhatsapp, notifyViaEmail, setNotifyViaEmail,
  notifyNewJobs, setNotifyNewJobs, notifyHighMatch, setNotifyHighMatch, matchThreshold, setMatchThreshold,
  handleSubmit, loading, contacts, toggleActive, sendTest, startEdit, deleteContact
}) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px' }}>
          👥 WhatsApp Notification Contacts
        </h3>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          style={{
            padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '10px',
            background: 'linear-gradient(135deg, #25d366, #128c7e)',
            color: 'white', border: 'none', cursor: 'pointer',
          }}
        >
          + Add New Contact
        </button>
      </div>

      {showAdd && (
        <div style={{
          padding: '24px', borderRadius: '16px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }} className="animate-scale-in">
          <h4 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', marginBottom: '16px' }}>
            {editId ? '✏️ Edit Contact' : '➕ Add WhatsApp Contact'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g., John Doe"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  color: 'var(--text-heavy)', outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Phone Number</label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  color: 'var(--text-heavy)', outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyNewJobs} onChange={e => setNotifyNewJobs(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
              <span style={{ fontSize: '14px', color: 'var(--text)' }}>Notify for all new jobs</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyHighMatch} onChange={e => setNotifyHighMatch(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
              <span style={{ fontSize: '14px', color: 'var(--text)' }}>Only notify for high-match jobs</span>
            </label>
            {notifyHighMatch && (
              <div style={{ paddingLeft: '28px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Minimum match: <strong style={{ color: '#25d366' }}>{matchThreshold}%</strong>
                </label>
                <input type="range" min={30} max={95} step={5} value={matchThreshold}
                  onChange={e => setMatchThreshold(Number(e.target.value))}
                  style={{ width: '200px', accentColor: '#25d366' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={resetForm}
              style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSubmit}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white',
                border: 'none', cursor: 'pointer',
              }}>
              {editId ? '💾 Save Changes' : '✓ Add Contact'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: '96px', borderRadius: '16px' }} />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '18px', marginBottom: '8px' }}>
            No alert contacts configured
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Configure phone numbers to dispatch notifications on successful job matches
          </p>
          <button onClick={() => { resetForm(); setShowAdd(true); }}
            style={{
              padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
              background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white',
              border: 'none', cursor: 'pointer',
            }}>
            + Configure Contact
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {contacts.map(contact => (
            <div key={contact.id} style={{
              padding: '16px 20px', borderRadius: '16px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '16px',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = '1px solid rgba(37,211,102,0.2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = '1px solid var(--border)'}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 700,
                background: contact.is_active ? 'rgba(37,211,102,0.12)' : 'var(--surface-3)',
                color: contact.is_active ? '#25d366' : 'var(--text-muted)',
                border: `2px solid ${contact.is_active ? 'rgba(37,211,102,0.3)' : 'var(--border)'}`,
              }}>
                {contact.name[0]?.toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-heavy)' }}>{contact.name}</span>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                    background: contact.is_active ? 'rgba(37,211,102,0.12)' : 'var(--surface-3)',
                    color: contact.is_active ? '#25d366' : 'var(--text-muted)',
                    fontWeight: 600,
                  }}>
                    {contact.is_active ? '● Active' : '○ Paused'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>{contact.phone}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {contact.notify_new_jobs && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                      📋 All Jobs
                    </span>
                  )}
                  {contact.notify_high_match && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#fcd34d' }}>
                      🎯 Match ≥{contact.match_threshold}%
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => toggleActive(contact)}
                  title={contact.is_active ? 'Pause' : 'Activate'}
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {contact.is_active ? '⏸️' : '▶️'}
                </button>
                <button onClick={() => sendTest(contact.id)}
                  title="Send Test Notification"
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                    background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)',
                    color: '#25d366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  📩
                </button>
                <button onClick={() => startEdit(contact)}
                  title="Edit"
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  ✏️
                </button>
                <button onClick={() => deleteContact(contact.id)}
                  title="Delete"
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
                    color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
