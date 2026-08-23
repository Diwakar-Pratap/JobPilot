import React from 'react';

export interface SecurityFormProps {
  currentPassword: string; setCurrentPassword: (v: string) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  confirmPassword: string; setConfirmPassword: (v: string) => void;
  saving: string;
  changePassword: () => void;
}

export const SecurityForm: React.FC<SecurityFormProps> = ({
  currentPassword, setCurrentPassword, newPassword, setNewPassword,
  confirmPassword, setConfirmPassword, saving, changePassword
}) => {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13.5px',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    color: 'var(--text-heavy)', outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'all 0.2s',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block',
    fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase',
  };

  return (
    <div className="premium-card animate-fade-in" style={{ padding: '28px' }}>
      <h2 className="section-title" style={{ marginBottom: '8px' }}>Change Password</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Use a strong password with at least 8 characters.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
        {[
          { label: 'Current Password', val: currentPassword, set: setCurrentPassword },
          { label: 'New Password', val: newPassword, set: setNewPassword },
          { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword },
        ].map(f => (
          <div key={f.label}>
            <label style={labelStyle}>{f.label}</label>
            <input style={inputStyle} type="password" value={f.val} onChange={e => f.set(e.target.value)}
              onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
              onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
            />
          </div>
        ))}
        <button className="btn-primary" onClick={changePassword} disabled={saving === 'password'} style={{ marginTop: '8px', minWidth: '160px' }}>
          {saving === 'password' ? '⏳ Changing...' : '🔒 Change Password'}
        </button>
      </div>
    </div>
  );
};
