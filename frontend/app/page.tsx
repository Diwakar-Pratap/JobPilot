'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const features = [
  { icon: '🤖', title: 'AI Resume Parser', desc: 'Upload your resume once. Our AI extracts every detail and builds your complete career profile automatically.', color: '#8b5cf6' },
  { icon: '🎯', title: 'Smart Job Matching', desc: 'Get a match score for every job. See exactly which skills you have, which you\'re missing, and why you\'re a great fit.', color: '#06b6d4' },
  { icon: '⚡', title: 'Auto-Apply Agent', desc: 'Watch our AI agent open job pages, understand forms, fill every field intelligently, and submit applications.', color: '#f59e0b' },
  { icon: '🕵️', title: 'Career Page Scraper', desc: 'Add any company to your watchlist. We continuously scan their career pages and alert you to new openings.', color: '#10b981' },
  { icon: '✉️', title: 'AI Cover Letters', desc: 'Personalized cover letters for every job, crafted using your resume, the job description, and company research.', color: '#ec4899' },
  { icon: '📊', title: 'Application Tracker', desc: 'Track every application in a beautiful Kanban board. Visualize your pipeline from saved to offer.', color: '#6366f1' },
];

const stats = [
  { value: '10x', label: 'More Applications' },
  { value: '85%', label: 'Time Saved' },
  { value: '3x', label: 'Interview Rate' },
  { value: '500+', label: 'ATS Portals Supported' },
];

const companies = ['Google', 'OpenAI', 'Stripe', 'Netflix', 'Figma', 'Anthropic', 'Vercel', 'GitHub'];

const steps = [
  { num: '01', title: 'Upload Resume', desc: 'Drop your PDF or DOCX. AI extracts everything instantly.' },
  { num: '02', title: 'Discover Jobs', desc: 'Browse AI-matched jobs or add companies to track.' },
  { num: '03', title: 'Auto Apply', desc: 'One click — AI fills and submits the application.' },
  { num: '04', title: 'Track Everything', desc: 'Monitor every application in one dashboard.' },
];

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f1629', color: '#e8eaf6', overflowX: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Ambient Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'all 0.3s ease',
        padding: isScrolled ? '12px 0' : '20px 0',
        background: isScrolled ? 'rgba(15,22,41,0.85)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>🚀</div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '18px', color: 'white' }}>JobPilot</span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            {['Features', 'How it Works', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                style={{ fontSize: '14px', fontWeight: 500, color: '#8892b0', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8892b0')}>
                {item}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/signup" className="btn-primary">
              Get Started Free <span>→</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ position: 'relative', zIndex: 10, paddingTop: '140px', paddingBottom: '80px', paddingLeft: '24px', paddingRight: '24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>

          {/* Badge */}
          <div className="animate-fade-in" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '999px', marginBottom: '32px',
            border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(99,102,241,0.1)'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} className="animate-pulse-slow" />
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#c4b5fd' }}>AI-Powered Job Automation Platform</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up" style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 'clamp(42px, 7vw, 80px)',
            fontWeight: 900,
            lineHeight: 1.05,
            marginBottom: '24px',
            color: 'white',
            letterSpacing: '-0.03em',
            animationDelay: '0.1s',
          }}>
            Let AI Find &amp;{' '}
            <span className="gradient-text">Apply to Jobs</span>
            <br />While You Sleep
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-up" style={{
            fontSize: '18px', lineHeight: 1.7, color: '#8892b0',
            maxWidth: '560px', margin: '0 auto 40px', animationDelay: '0.2s'
          }}>
            JobPilot is your autonomous AI career assistant. It parses your resume,
            matches you to jobs, auto-fills applications, and tracks everything —
            so you can focus on interviewing.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up" style={{
            display: 'flex', flexWrap: 'wrap', gap: '16px',
            justifyContent: 'center', alignItems: 'center',
            marginBottom: '64px', animationDelay: '0.3s'
          }}>
            <Link href="/signup" className="btn-primary" style={{ fontSize: '16px', padding: '14px 32px' }}>
              Start Applying for Free <span style={{ fontSize: '20px' }}>🚀</span>
            </Link>
            <Link href="/login" className="btn-secondary" style={{ fontSize: '16px', padding: '14px 32px' }}>
              View Dashboard Demo <span>▶</span>
            </Link>
          </div>

          {/* Social proof */}
          <p style={{ fontSize: '13px', color: '#4a5480', marginBottom: '16px' }}>
            Trusted by job seekers targeting top companies
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center' }}>
            {companies.map((c) => (
              <span key={c} style={{ fontSize: '13px', fontWeight: 600, color: '#4a5480', cursor: 'default', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8892b0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5480')}>
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="animate-fade-in-up" style={{ maxWidth: '900px', margin: '80px auto 0', position: 'relative', animationDelay: '0.4s' }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: -1, filter: 'blur(60px)', opacity: 0.3, background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.4) 0%, transparent 70%)' }} />
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(26,32,64,0.8)', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
            {/* Window chrome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,22,41,0.9)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f87171', opacity: 0.8 }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24', opacity: 0.8 }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34d399', opacity: 0.8 }} />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: '#4a5480' }}>
                  app.jobpilot.ai/dashboard
                </div>
              </div>
            </div>
            {/* Dashboard content */}
            <div style={{ padding: '24px', minHeight: '380px' }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Applied', value: '47', color: '#6366f1' },
                  { label: 'Interviews', value: '12', color: '#10b981' },
                  { label: 'Match Score', value: '92%', color: '#f59e0b' },
                  { label: 'Auto-Applied', value: '31', color: '#8b5cf6' },
                ].map((s) => (
                  <div key={s.label} style={{ borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#4a5480' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Job rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { role: 'Senior ML Engineer', company: 'OpenAI', score: 95, badge: 'Remote', color: '#10b981' },
                  { role: 'Full Stack Engineer', company: 'Stripe', score: 87, badge: 'Hybrid', color: '#6366f1' },
                  { role: 'DevOps Engineer', company: 'Netflix', score: 79, badge: 'Onsite', color: '#f59e0b' },
                ].map((job) => (
                  <div key={job.role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '10px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                        {job.company[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{job.role}</div>
                        <div style={{ fontSize: '11px', color: '#4a5480' }}>{job.company}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', color: job.color, border: `1px solid ${job.color}40`, background: `${job.color}20` }}>{job.badge}</span>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: job.color }}>{job.score}%</div>
                      <button style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', fontWeight: 500, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', cursor: 'pointer' }}>
                        Auto Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ position: 'relative', zIndex: 10, padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '32px', textAlign: 'center' }}>
            {stats.map((s) => (
              <div key={s.label}>
                <div className="gradient-text" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '48px', fontWeight: 900, marginBottom: '8px' }}>{s.value}</div>
                <div style={{ fontSize: '14px', color: '#8892b0' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ position: 'relative', zIndex: 10, padding: '96px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="badge badge-brand" style={{ display: 'inline-flex', marginBottom: '16px' }}>⚡ Core Features</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'white', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Everything You Need to{' '}
              <span className="gradient-text">Land Your Dream Job</span>
            </h2>
            <p style={{ fontSize: '18px', color: '#8892b0', maxWidth: '480px', margin: '0 auto' }}>
              A complete AI-powered career platform built for the modern job seeker.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {features.map((f, i) => (
              <div key={f.title} className="premium-card animate-fade-in-up" style={{ padding: '28px', animationDelay: `${i * 0.1}s` }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px', background: `${f.color}20`, border: `1px solid ${f.color}30` }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '17px', color: 'white', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#8892b0' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 10, padding: '96px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="badge badge-brand" style={{ display: 'inline-flex', marginBottom: '16px' }}>🗺️ Simple Process</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
              Get Started in <span className="gradient-text">4 Steps</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', textAlign: 'center' }}>
            {steps.map((step) => (
              <div key={step.num}>
                <div className="gradient-text" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '52px', fontWeight: 900, marginBottom: '12px' }}>{step.num}</div>
                <div style={{ width: '48px', height: '2px', margin: '0 auto 16px', background: 'rgba(99,102,241,0.3)' }} />
                <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '8px', fontSize: '15px' }}>{step.title}</h3>
                <p style={{ fontSize: '13px', color: '#8892b0', lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ position: 'relative', zIndex: 10, padding: '96px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div className="premium-card" style={{ padding: '72px 48px', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '16px', background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 70%)', zIndex: -1 }} />
            <div className="badge badge-green" style={{ display: 'inline-flex', marginBottom: '24px' }}>🟢 Free to Start</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: 'white', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Ready to Automate<br />Your Job Search?
            </h2>
            <p style={{ fontSize: '17px', color: '#8892b0', marginBottom: '36px', lineHeight: 1.6 }}>
              Join thousands of professionals using JobPilot to land their dream roles faster.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn-primary" style={{ fontSize: '16px', padding: '14px 32px' }}>
                Create Free Account 🚀
              </Link>
              <Link href="/login" className="btn-secondary" style={{ fontSize: '16px', padding: '14px 32px' }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 10, padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🚀</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white' }}>JobPilot</span>
          </div>
          <p style={{ fontSize: '13px', color: '#4a5480' }}>© 2025 JobPilot. AI-Powered Career Platform.</p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Privacy', 'Terms', 'Contact'].map((item) => (
              <a key={item} href="#" style={{ fontSize: '13px', color: '#4a5480', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8892b0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5480')}>
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
