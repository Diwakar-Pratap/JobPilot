'use client';

import { useState } from 'react';
import Link from 'next/link';

const API = '';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setSent(true); }
      else { const d = await res.json(); setError(d.detail || 'Failed'); }
    } catch { setError('Could not connect to server'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0f1629' }}>
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>🚀</div>
            <span className="font-display font-bold text-xl text-white">JobPilot</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-sm" style={{ color: '#8892b0' }}>We'll send a reset link to your email</p>
        </div>

        <div className="premium-card p-8">
          {sent ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="font-display font-bold text-white text-xl mb-2">Check your email</h3>
              <p className="text-sm" style={{ color: '#8892b0' }}>If an account exists for {email}, we've sent a password reset link.</p>
              <Link href="/login" className="btn-primary mt-6 inline-flex">Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>⚠️ {error}</div>}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#c8cce0' }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5" style={{ opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending...' : 'Send Reset Link →'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm" style={{ color: '#a5b4fc' }}>← Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
