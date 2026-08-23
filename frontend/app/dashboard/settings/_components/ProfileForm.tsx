import React from 'react';

export interface ProfileFormProps {
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  profile: any;
  linkedinUrl: string; setLinkedinUrl: (v: string) => void;
  githubUrl: string; setGithubUrl: (v: string) => void;
  portfolioUrl: string; setPortfolioUrl: (v: string) => void;
  saving: string;
  saveProfile: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  name, setName, phone, setPhone, location, setLocation, profile,
  linkedinUrl, setLinkedinUrl, githubUrl, setGithubUrl, portfolioUrl, setPortfolioUrl,
  saving, saveProfile
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
      <h2 className="section-title" style={{ marginBottom: '24px' }}>Personal Information</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Full Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Diwakar Kumar"
            onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
            onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
          />
        </div>
        <div>
          <label style={labelStyle}>Phone Number</label>
          <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210"
            onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
            onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
          />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="Bengaluru, India"
            onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
            onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
          />
        </div>
        <div>
          <label style={labelStyle}>Email (Read-only)</label>
          <input style={{ ...inputStyle, opacity: 0.5 }} value={profile?.email || ''} disabled />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'LinkedIn URL', val: linkedinUrl, set: setLinkedinUrl, ph: 'linkedin.com/in/...' },
          { label: 'GitHub URL', val: githubUrl, set: setGithubUrl, ph: 'github.com/...' },
          { label: 'Portfolio URL', val: portfolioUrl, set: setPortfolioUrl, ph: 'yoursite.com' },
        ].map(f => (
          <div key={f.label}>
            <label style={labelStyle}>{f.label}</label>
            <input style={inputStyle} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
              onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
              onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
            />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={saveProfile} disabled={saving === 'profile'} style={{ minWidth: '160px' }}>
        {saving === 'profile' ? '⏳ Saving...' : '✓ Save Profile'}
      </button>
    </div>
  );
};
