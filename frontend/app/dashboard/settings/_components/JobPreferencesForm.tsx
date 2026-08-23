import React from 'react';

export interface JobPreferencesFormProps {
  targetRoles: string; setTargetRoles: (v: string) => void;
  targetLocations: string; setTargetLocations: (v: string) => void;
  expectedSalary: string; setExpectedSalary: (v: string) => void;
  workPreference: string; setWorkPreference: (v: string) => void;
  yearsExp: string; setYearsExp: (v: string) => void;
  saving: string;
  savePreferences: () => void;
}

export const JobPreferencesForm: React.FC<JobPreferencesFormProps> = ({
  targetRoles, setTargetRoles, targetLocations, setTargetLocations,
  expectedSalary, setExpectedSalary, workPreference, setWorkPreference,
  yearsExp, setYearsExp, saving, savePreferences
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
      <h2 className="section-title" style={{ marginBottom: '8px' }}>Job Search Preferences</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>These settings control what jobs the AI searches for and which alerts you receive.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={labelStyle}>🎯 Target Roles (comma separated)</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} value={targetRoles}
            onChange={e => setTargetRoles(e.target.value)}
            placeholder="Python Developer, Backend Engineer, Data Engineer"
            onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
            onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
          />
          <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '4px' }}>Used for LinkedIn search, job matching, and WhatsApp alerts</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>📍 Preferred Locations</label>
            <input style={inputStyle} value={targetLocations} onChange={e => setTargetLocations(e.target.value)}
              placeholder="Bengaluru, Remote, Hyderabad"
              onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
              onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
            />
            <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '4px' }}>Comma-separated. Posts matching these cities are prioritized.</p>
          </div>
          <div>
            <label style={labelStyle}>💰 Expected Salary</label>
            <input style={inputStyle} value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)}
              placeholder="₹15-25 LPA or $80k-120k"
              onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
              onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>🏢 Work Preference</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workPreference.includes('remote')}
                  onChange={e => {
                    if (e.target.checked) {
                      const current = workPreference ? workPreference.split(',').filter(x => x !== 'NA') : [];
                      setWorkPreference([...current, 'remote'].join(','));
                    } else {
                      const current = workPreference.split(',').filter(x => x !== 'remote');
                      setWorkPreference(current.join(','));
                    }
                  }}
                />
                Remote
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workPreference.includes('hybrid')}
                  onChange={e => {
                    if (e.target.checked) {
                      const current = workPreference ? workPreference.split(',').filter(x => x !== 'NA') : [];
                      setWorkPreference([...current, 'hybrid'].join(','));
                    } else {
                      const current = workPreference.split(',').filter(x => x !== 'hybrid');
                      setWorkPreference(current.join(','));
                    }
                  }}
                />
                Hybrid
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workPreference.includes('onsite')}
                  onChange={e => {
                    if (e.target.checked) {
                      const current = workPreference ? workPreference.split(',').filter(x => x !== 'NA') : [];
                      setWorkPreference([...current, 'onsite'].join(','));
                    } else {
                      const current = workPreference.split(',').filter(x => x !== 'onsite');
                      setWorkPreference(current.join(','));
                    }
                  }}
                />
                On-site
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e8eaf6', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!workPreference || workPreference === 'NA' || workPreference.includes('NA')}
                  onChange={e => {
                    if (e.target.checked) {
                      setWorkPreference('NA');
                    } else {
                      setWorkPreference('');
                    }
                  }}
                />
                NA (Any)
              </label>
            </div>
          </div>
          <div>
            <label style={labelStyle}>📅 Years of Experience</label>
            <input style={inputStyle} type="number" min="0" max="50" value={yearsExp}
              onChange={e => setYearsExp(e.target.value)}
              placeholder="4"
              onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
              onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
            />
            <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '4px' }}>Used to filter jobs. E.g. 4 years = shows only 3-6 yr roles</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button className="btn-primary" onClick={savePreferences} disabled={saving === 'prefs'} style={{ minWidth: '180px' }}>
          {saving === 'prefs' ? '⏳ Saving...' : '✓ Save Preferences'}
        </button>
      </div>
    </div>
  );
};
