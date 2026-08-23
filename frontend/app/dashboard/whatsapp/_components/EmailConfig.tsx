'use client';
import React, { useState, useEffect } from 'react';

const API = '';
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''; }

export function EmailConfig() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number | ''>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API}/api/settings/smtp`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHost(data.smtp_host || '');
        setPort(data.smtp_port || '');
        setUsername(data.smtp_username || '');
        setPassword(data.smtp_password || '');
        setFromEmail(data.smtp_from_email || '');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API}/api/settings/smtp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          smtp_host: host,
          smtp_port: port ? Number(port) : null,
          smtp_username: username,
          smtp_password: password,
          smtp_from_email: fromEmail,
        })
      });
      if (res.ok) {
        setMessage('✅ Email configuration saved successfully.');
      } else {
        setMessage('❌ Failed to save email configuration.');
      }
    } catch (e) {
      setMessage('❌ Network error.');
    }
    setSaving(false);
  };

  if (loading) return <div style={{ color: '#8892b0' }}>Loading email configuration...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px', marginBottom: '8px' }}>
          📧 SMTP Email Configuration
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Configure your SMTP server to allow JobPilot to send automated job alerts directly to your contacts via email.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8892b0', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SMTP Host</label>
          <input type="text" className="input-field" value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8892b0', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SMTP Port</label>
          <input type="number" className="input-field" value={port} onChange={e => setPort(e.target.value === '' ? '' : Number(e.target.value))} placeholder="587" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8892b0', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SMTP Username / Email</label>
          <input type="text" className="input-field" value={username} onChange={e => setUsername(e.target.value)} placeholder="youremail@gmail.com" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8892b0', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SMTP Password / App Password</label>
          <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••••••••" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8892b0', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sender Email Address (From)</label>
          <input type="text" className="input-field" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="alerts@jobpilot.com" />
        </div>

        <button 
          onClick={saveConfig} 
          disabled={saving}
          className="btn-primary"
          style={{ padding: '12px', fontSize: '14px', marginTop: '8px', alignSelf: 'flex-start' }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>

        {message && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: message.includes('✅') ? '#10b981' : '#ef4444' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
