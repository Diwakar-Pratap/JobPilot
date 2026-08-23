import React from 'react';

export interface WhatsAppSimulatorProps {
  linked: boolean;
  serviceStatus: string;
  qrCodeUrl: string | null;
  handleUnlink: () => void;
  messages: any[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendMessage: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  linked, serviceStatus, qrCodeUrl, handleUnlink, messages, chatInput, setChatInput, handleSendMessage, chatEndRef
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {!linked ? (
        <div className="premium-card" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '48px' }}>🔌</div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '18px' }}>Link Your WhatsApp Device</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: 1.5 }}>
            To receive automated job alerts directly to your phone, link your device by scanning the QR code with WhatsApp.
          </p>
          
          {serviceStatus === 'INITIALIZING' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
              <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="#25d366">
                <g fill="none" fillRule="evenodd">
                  <g transform="translate(1 1)" strokeWidth="3">
                    <circle strokeOpacity=".2" cx="18" cy="18" r="18"/>
                    <path d="M36 18c0-9.94-8.06-18-18-18">
                      <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/>
                    </path>
                  </g>
                </g>
              </svg>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Starting WhatsApp client on server...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '10px' }} className="animate-scale-in">
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', width: '212px', height: '212px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="WhatsApp QR Code" width="180" height="180" style={{ display: 'block', borderRadius: '4px' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#111' }}>
                    <svg width="24" height="24" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="#128c7e">
                      <g fill="none" fillRule="evenodd">
                        <g transform="translate(1 1)" strokeWidth="3">
                          <circle strokeOpacity=".2" cx="18" cy="18" r="18"/>
                          <path d="M36 18c0-9.94-8.06-18-18-18">
                            <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/>
                          </path>
                        </g>
                      </g>
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Generating QR...</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.5 }}>
                Open <strong>WhatsApp</strong> on your phone → tap <strong>Linked Devices</strong> → scan the QR code above.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          display: 'flex', height: '560px', borderRadius: '16px', overflow: 'hidden',
          border: '1px solid var(--border)', background: 'var(--bg)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
        }} className="animate-scale-in">
          <div style={{
            width: '320px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border)'
          }}>
            <div style={{
              padding: '12px 16px', background: 'var(--surface)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', fontWeight: 700 }}>
                  U
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heavy)' }}>Linked Device</div>
                  <div style={{ fontSize: '10px', color: '#25d366' }}>● Active session</div>
                </div>
              </div>
              <button onClick={handleUnlink} title="Unlink account"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                🔌 Unlink
              </button>
            </div>

            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ background: 'var(--surface-3)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🔍</span>
                <input type="text" disabled placeholder="Search or start new chat" style={{ background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-heavy)', width: '100%' }} />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--surface-3)', borderBottom: '1px solid var(--border)', cursor: 'pointer'
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  🤖
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-heavy)' }}>JobPilot Agent</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Now</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {messages[messages.length - 1]?.text}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
            <div style={{ padding: '12px 16px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heavy)' }}>JobPilot Agent</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Active monitoring</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg)' }}>
              {messages.map((m) => {
                if (m.sender === 'system') {
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                      <span style={{
                        fontSize: '11px', background: 'var(--surface-2)', color: 'var(--brand)',
                        padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)'
                      }}>
                        {m.text}
                      </span>
                    </div>
                  );
                }
                const isAgent = m.sender === 'agent';
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isAgent ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '70%', padding: '8px 12px 6px 12px', borderRadius: '8px',
                      background: isAgent ? 'var(--surface-2)' : 'var(--brand-glow)',
                      color: 'var(--text-heavy)', position: 'relative', fontSize: '13px', lineHeight: 1.5,
                      borderTopLeftRadius: isAgent ? '0' : '8px',
                      borderTopRightRadius: isAgent ? '8px' : '0',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                      <span style={{
                        display: 'block', fontSize: '9px', color: 'var(--text-muted)',
                        textAlign: 'right', marginTop: '4px'
                      }}>
                        {m.time}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef as React.RefObject<HTMLDivElement>} />
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border)' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a simulated message to Career Agent..."
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: '8px', fontSize: '13px',
                  background: 'var(--surface-3)', border: '1px solid var(--border)', outline: 'none', color: 'var(--text-heavy)'
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%', background: '#00a884',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', cursor: 'pointer', color: 'white', opacity: !chatInput.trim() ? 0.6 : 1
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
