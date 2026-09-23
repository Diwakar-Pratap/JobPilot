'use client';
import React, { useEffect, useState, useRef } from 'react';

const API = '';
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''; }

/** Lightweight markdown → JSX renderer for AI chat replies */
function MarkdownMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (line: string): React.ReactNode => {
    // Bold+italic ***text***
    // Bold **text**
    // Italic *text*
    // Code `text`
    const parts = line.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('***') && part.endsWith('***')) {
        return <strong key={idx}><em>{part.slice(3, -3)}</em></strong>;
      } else if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{ color: '#e2e8f0', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={idx} style={{ color: '#a5b4fc' }}>{part.slice(1, -1)}</em>;
      } else if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} style={{
            background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
            padding: '1px 5px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace'
          }}>{part.slice(1, -1)}</code>
        );
      }
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (add spacing via margin)
    if (!trimmed) {
      i++;
      elements.push(<div key={`gap-${i}`} style={{ height: '6px' }} />);
      continue;
    }

    // ### Header
    if (/^###\s+/.test(trimmed)) {
      elements.push(
        <p key={i} style={{ fontSize: '13px', fontWeight: 700, color: '#c4b5fd', marginBottom: '4px', marginTop: '8px' }}>
          {renderInline(trimmed.replace(/^###\s+/, ''))}
        </p>
      );
      i++; continue;
    }
    // ## Header
    if (/^##\s+/.test(trimmed)) {
      elements.push(
        <p key={i} style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', marginBottom: '4px', marginTop: '10px', borderBottom: '1px solid rgba(165,180,252,0.15)', paddingBottom: '4px' }}>
          {renderInline(trimmed.replace(/^##\s+/, ''))}
        </p>
      );
      i++; continue;
    }
    // # Header
    if (/^#\s+/.test(trimmed)) {
      elements.push(
        <p key={i} style={{ fontSize: '15px', fontWeight: 800, color: '#818cf8', marginBottom: '6px', marginTop: '12px' }}>
          {renderInline(trimmed.replace(/^#\s+/, ''))}
        </p>
      );
      i++; continue;
    }

    // Bullet list — collect consecutive bullet lines
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0 4px 0', paddingLeft: '0', listStyle: 'none' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
              <span style={{ color: '#6366f1', fontSize: '12px', marginTop: '3px', flexShrink: 0 }}>▸</span>
              <span style={{ fontSize: '13px', lineHeight: 1.55, color: '#cbd5e1' }}>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list — collect consecutive numbered lines
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '4px 0 4px 0', paddingLeft: '0', listStyle: 'none' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
              <span style={{
                color: '#6366f1', fontSize: '11px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.15)', borderRadius: '50%', marginTop: '2px', flexShrink: 0
              }}>{idx + 1}</span>
              <span style={{ fontSize: '13px', lineHeight: 1.55, color: '#cbd5e1' }}>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '8px 0' }} />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} style={{ fontSize: '13px', lineHeight: 1.65, color: '#cbd5e1', margin: '2px 0' }}>
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{elements}</div>;
}

export function AIChat({ resumeId }: { resumeId?: string }) {
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    "What are my strongest skills?",
    "How can I improve my resume?",
    "What roles am I best suited for?",
    "What skills should I learn next?",
    "Write a professional summary for me",
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    const token = getToken();
    try {
      const res = await fetch(`${API}/api/resume/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, resume_id: resumeId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Failed to reach AI. Is the backend running?' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
      {/* Chat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '16px' }}>🤖</span>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: 'white', fontSize: '14px' }}>AI Career Coach</span>
        <span style={{ fontSize: '11px', color: '#4a5480' }}>Ask anything about your resume</span>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p style={{ fontSize: '13px', color: '#4a5480', marginBottom: '16px' }}>Ask the AI about your resume, career, or job search</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {suggestedQuestions.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'ai' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, marginRight: '8px', marginTop: '2px' }}>
                🤖
              </div>
            )}
            <div style={{
              maxWidth: '85%',
              padding: m.role === 'user' ? '10px 14px' : '12px 16px',
              borderRadius: '14px',
              background: m.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: m.role === 'user' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
              borderBottomRightRadius: m.role === 'user' ? '4px' : '14px',
              borderBottomLeftRadius: m.role === 'ai' ? '4px' : '14px',
            }}>
              {m.role === 'user' ? (
                <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#e8eaf6', margin: 0 }}>{m.text}</p>
              ) : (
                <MarkdownMessage text={m.text} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🤖</div>
            <div style={{ display: 'flex', gap: '4px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', borderBottomLeftRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
        <input className="input-field" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about your resume..." style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => sendMessage()} disabled={loading || !input.trim()}
          style={{ padding: '10px 16px', fontSize: '13px' }}>
          {loading ? '···' : '➤'}
        </button>
      </div>
    </div>
  );
}
