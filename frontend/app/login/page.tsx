'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#0f1629', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', top: '-100px', right: '-100px', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', bottom: '-100px', left: '-100px', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }} className="animate-scale-in">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>🚀</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '20px', color: 'white' }}>JobPilot</span>
          </Link>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Welcome back</h1>
          <p style={{ fontSize: '14px', color: '#8892b0' }}>Log in to your AI career dashboard</p>
        </div>

        <div className="premium-card" style={{ padding: '36px' }}>
          {error && (
            <div className="animate-fade-in" style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#c8cce0', marginBottom: '8px' }}>Email address</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="you@example.com" required autoComplete="email" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#c8cce0' }}>Password</label>
                <Link href="/reset-password" style={{ fontSize: '12px', color: '#a5b4fc', textDecoration: 'none' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input id="password" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="input-field" placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingRight: '48px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#4a5480' }}>
                  {showPass ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <button id="login-submit" type="submit" disabled={loading} className="btn-primary"
              style={{ justifyContent: 'center', padding: '14px', opacity: loading ? 0.7 : 1, width: '100%' }}>
              {loading ? (
                <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block' }} className="animate-spin" />Signing in...</>
              ) : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#4a5480' }}>
              Don't have an account?{' '}
              <Link href="/signup" style={{ fontWeight: 500, color: '#a5b4fc', textDecoration: 'none' }}>Create one free</Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#4a5480', marginTop: '24px' }}>🔒 Your data is encrypted and secure</p>
      </div>
    </div>
  );
}
