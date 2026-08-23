import React from 'react';

export const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', emoji: '✨', model: 'gemini-2.0-flash', badge: 'Free', badgeColor: '#06d6a0', desc: 'Best free option. Fast, smart, 1M token context. Recommended for most users.', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza...' },
  { id: 'groq', name: 'Groq', emoji: '⚡', model: 'llama-3.1-70b-versatile', badge: 'Free', badgeColor: '#06d6a0', desc: 'Ultra-fast inference. Llama 3.1 70B running on Groq silicon.', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_...' },
  { id: 'openai', name: 'OpenAI', emoji: '🤖', model: 'gpt-4o-mini', badge: 'Paid', badgeColor: '#f59e0b', desc: 'GPT-4o Mini. High quality, best for complex resume parsing.', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-...' },
  { id: 'nvidia', name: 'NVIDIA NIM', emoji: '🖥️', model: 'llama-3.1-70b', badge: 'Free', badgeColor: '#06d6a0', desc: 'NVIDIA inference platform. Free credits for powerful open models.', keyUrl: 'https://build.nvidia.com/', keyHint: 'nvapi-...' },
];

export interface AiProviderFormProps {
  profile: any;
  selectedProvider: string; setSelectedProvider: (v: string) => void;
  aiKey: string; setAiKey: (v: string) => void;
  saving: string;
  saveAIProvider: () => void;
  testingAI: boolean;
  testAI: () => void;
  aiTestResult: any;
}

export const AiProviderForm: React.FC<AiProviderFormProps> = ({
  profile, selectedProvider, setSelectedProvider, aiKey, setAiKey,
  saving, saveAIProvider, testingAI, testAI, aiTestResult
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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="premium-card" style={{ padding: '28px' }}>
        <h2 className="section-title" style={{ marginBottom: '8px' }}>AI Provider</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Choose your AI engine for resume parsing, job matching, and smart search.
          {profile?.has_ai_key && <span style={{ color: '#34d399', marginLeft: '8px', fontWeight: 600 }}>● Connected</span>}
        </p>

        {/* Provider cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setSelectedProvider(p.id)}
              style={{
                padding: '16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                background: selectedProvider === p.id ? 'rgba(124,110,247,0.1)' : 'rgba(255,255,255,0.03)',
                border: selectedProvider === p.id ? '1px solid rgba(124,110,247,0.35)' : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.2s ease',
                boxShadow: selectedProvider === p.id ? '0 0 0 1px rgba(124,110,247,0.15), inset 0 0 20px rgba(124,110,247,0.05)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{p.emoji}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'white', fontSize: '14px' }}>{p.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, background: `${p.badgeColor}18`, color: p.badgeColor, border: `1px solid ${p.badgeColor}30`, fontFamily: "'Space Grotesk', sans-serif" }}>{p.badge}</span>
                  {selectedProvider === p.id && <span style={{ fontSize: '12px', color: '#c4b5fd' }}>●</span>}
                </div>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{p.desc}</div>
              <div style={{ fontSize: '10.5px', color: '#3d4a70', marginTop: '6px', fontFamily: "'Space Grotesk', sans-serif" }}>Model: {p.model}</div>
            </button>
          ))}
        </div>

        {/* API Key input */}
        {(() => {
          const prov = PROVIDERS.find(p => p.id === selectedProvider)!;
          return (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={labelStyle}>{prov.emoji} {prov.name} API Key</label>
                <a href={prov.keyUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#7c6ef7', textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                  Get free key ↗
                </a>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
                  type="password" value={aiKey} onChange={e => setAiKey(e.target.value)}
                  placeholder={prov.keyHint}
                  onFocus={e => { (e.target as any).style.borderColor = 'var(--brand)'; (e.target as any).style.background = 'var(--brand-glow)'; }}
                  onBlur={e => { (e.target as any).style.borderColor = 'var(--border)'; (e.target as any).style.background = 'var(--surface-2)'; }}
                />
                <button className="btn-primary" onClick={saveAIProvider} disabled={saving === 'ai'} style={{ minWidth: '120px', padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  {saving === 'ai' ? '⏳ Testing...' : '✓ Save & Test'}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#3d4a70', marginTop: '8px' }}>Key is encrypted and stored securely. Never shared with third parties.</p>
            </div>
          );
        })()}

        {/* Test connection */}
        {profile?.has_ai_key && (
          <div style={{ marginTop: '16px' }}>
            <button className="btn-secondary" onClick={testAI} disabled={testingAI} style={{ fontSize: '13px' }}>
              {testingAI ? '⏳ Testing...' : '🧪 Test Current Connection'}
            </button>
            {aiTestResult && (
              <div className="animate-fade-in" style={{
                marginTop: '12px', padding: '12px 16px', borderRadius: '10px', fontSize: '13px',
                background: aiTestResult.status === 'connected' ? 'rgba(6,214,160,0.08)' : 'rgba(239,68,68,0.08)',
                border: aiTestResult.status === 'connected' ? '1px solid rgba(6,214,160,0.2)' : '1px solid rgba(239,68,68,0.2)',
                color: aiTestResult.status === 'connected' ? '#34d399' : '#f87171',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {aiTestResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info card */}
      <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(124,110,247,0.06)', border: '1px solid rgba(124,110,247,0.15)' }}>
        <p style={{ fontSize: '12.5px', color: '#c4b5fd', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, marginBottom: '4px' }}>💡 Recommended: Google Gemini (Free)</p>
        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Get your free Gemini API key at <a href="https://aistudio.google.com/apikey" target="_blank" style={{ color: '#7c6ef7' }}>aistudio.google.com/apikey</a>. 
          No credit card required. 1 million token context window for free.
        </p>
      </div>
    </div>
  );
};
