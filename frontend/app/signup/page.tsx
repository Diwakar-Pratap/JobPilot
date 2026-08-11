'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match');
    if (formData.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, email: formData.email, password: formData.password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Signup failed');
      }
      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard/resume');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', background: '#0f1629', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Ambient bg */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', top: '-200px', right: '-200px', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', bottom: '-150px', left: '-100px', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }} className="animate-scale-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>🚀</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '20px', color: 'white' }}>JobPilot</span>
          </Link>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Create your account</h1>
          <p style={{ fontSize: '14px', color: '#8892b0' }}>Start your AI-powered job search today — free</p>
        </div>

        {/* Card */}
        <div className="premium-card" style={{ padding: '36px' }}>
          {error && (
            <div className="animate-fade-in" style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#c8cce0', marginBottom: '8px' }}>Full Name</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleChange}
                className="input-field" placeholder="John Doe" required autoComplete="name" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#c8cce0', marginBottom: '8px' }}>Email address</label>
              <input id="signup-email" type="email" name="email" value={formData.email} onChange={handleChange}
                className="input-field" placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#c8cce0', marginBottom: '8px' }}>Password</label>
              <input id="signup-password" type="password" name="password" value={formData.password} onChange={handleChange}
                className="input-field" placeholder="Min. 8 characters" required autoComplete="new-password" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#c8cce0', marginBottom: '8px' }}>Confirm Password</label>
              <input id="confirm-password" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                className="input-field" placeholder="Repeat password" required autoComplete="new-password" />
            </div>

            <button id="signup-submit" type="submit" disabled={loading} className="btn-primary"
              style={{ justifyContent: 'center', padding: '14px', opacity: loading ? 0.7 : 1, width: '100%' }}>
              {loading ? (
                <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block' }} className="animate-spin" />Creating account...</>
              ) : 'Create Account 🚀'}
            </button>

            <p style={{ fontSize: '12px', textAlign: 'center', color: '#4a5480' }}>
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#4a5480' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ fontWeight: 500, color: '#a5b4fc', textDecoration: 'none' }}>Sign in</Link>
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
          {['🤖 AI Resume Parsing', '⚡ Auto-Apply', '📊 Full Tracking'].map((item) => (
            <div key={item} style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: '#4a5480', border: '1px solid rgba(255,255,255,0.05)' }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
