'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';


const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

function StatCard({ icon, label, value, sub, color, delta }: any) {
  return (
    <div className="premium-card tilt-card" style={{ padding: '22px' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{
          padding: '10px', borderRadius: '12px', fontSize: '20px',
          background: `${color}18`, border: `1px solid ${color}28`,
        }}>{icon}</div>
        {delta !== undefined && (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", background: delta >= 0 ? 'rgba(6,214,160,0.1)' : 'rgba(239,68,68,0.1)', color: delta >= 0 ? '#34d399' : '#f87171', border: delta >= 0 ? '1px solid rgba(6,214,160,0.2)' : '1px solid rgba(239,68,68,0.2)' }}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {/* Stat */}
      <div className="stat-number" style={{ color: 'var(--text-heavy)', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px', fontFamily: "'Space Grotesk', sans-serif" }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>{sub}</div>}
      {/* Bottom accent line */}
      <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '2px', background: `linear-gradient(90deg, transparent, ${color}60, transparent)`, borderRadius: '1px' }} />
    </div>
  );
}

function ActivityItem({ icon, text, time, color }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', background: `${color}18`, border: `1px solid ${color}20`, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '2px', lineHeight: 1.4 }}>{text}</p>
        <p style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: "'Space Grotesk', sans-serif" }}>{time}</p>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, desc, color, onClick }: any) {
  const inner = (
    <>
      <div style={{ width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', margin: '0 auto 10px', background: `${color}18`, border: `1px solid ${color}25` }}>{icon}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '3px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{desc}</div>
    </>
  );

  if (onClick) {
    return (
      <div onClick={onClick} className="glass-card"
        style={{ padding: '18px 16px', textAlign: 'center', display: 'block', cursor: 'pointer' }}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className="glass-card"
      style={{ padding: '18px 16px', textAlign: 'center', textDecoration: 'none', display: 'block', cursor: 'pointer' }}>
      {inner}
    </Link>
  );
}

export default function DashboardPage() {
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };
  const [syncing, setSyncing] = useState(false);

  const handleSyncSheets = async () => {
    setSyncing(true);
    showToast('🔄 Syncing Google Sheets...');
    try {
      const res = await fetch(`${API}/api/jobs/sync-sheets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        showToast('✅ Sheets Synced!');
        fetchData();
      } else {
        showToast('❌ Sync failed');
      }
    } catch (e) {
      showToast('❌ Sync error');
    }
    setSyncing(false);
  };

  const [stats, setStats] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = getToken();
    try {
      const [statsRes, overviewRes, alertsRes, jobsRes, profileRes] = await Promise.all([
        fetch(`${API}/api/applications/stats/summary`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/analytics/overview`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/alerts/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/jobs/?limit=5&sort=match`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/settings/profile`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (jobsRes.ok) { const d = await jobsRes.json(); setRecentJobs(d.jobs || []); }
      if (profileRes.ok) setProfile(await profileRes.json());
    } catch (e) {}
    setLoading(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch (e) { return ''; }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '🌅 Good morning' : hour < 17 ? '☀️ Good afternoon' : '🌙 Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  const statCards = [
    { icon: '📤', label: 'Applied', value: stats?.applied ?? '—', sub: 'Total applications', color: '#7c6ef7', delta: undefined },
    { icon: '🎙️', label: 'Interviews', value: stats?.interview ?? '—', sub: 'Calls & rounds', color: '#06d6a0', delta: undefined },
    { icon: '🏆', label: 'Offers', value: stats?.offer ?? '—', sub: 'Job offers', color: '#f59e0b', delta: undefined },
    { icon: '⚡', label: 'AI Applied', value: stats?.total ?? '—', sub: 'Auto-submitted', color: '#a78bfa', delta: undefined },
  ];

  const quickActions = [
    { href: '/dashboard/resume', icon: '📄', label: 'Upload Resume', desc: 'AI parsing', color: '#7c6ef7' },
    { href: '/dashboard/jobs', icon: '🔍', label: 'Find Jobs', desc: 'AI matched', color: '#06d6a0' },
    { href: '/dashboard/whatsapp', icon: '💬', label: 'WhatsApp Alerts', desc: 'Live notifs', color: '#f59e0b' },
    { href: '/dashboard/settings', icon: '⚙️', label: 'AI Config', desc: 'Set Gemini/Groq', color: '#38bdf8' },
  ];

  // Profile completion score
  const profileItems = [
    { label: 'Resume Uploaded', done: profile?.has_ai_key !== undefined },
    { label: 'Target Roles Set', done: Boolean(profile?.target_roles) },
    { label: 'Preferred Location', done: Boolean(profile?.target_locations) },
    { label: 'AI Provider Configured', done: Boolean(profile?.has_ai_key) },
    { label: 'Years of Experience', done: Boolean(profile?.years_of_experience) },
  ];
  const doneCount = profileItems.filter(x => x.done).length;
  const profileScore = Math.round((doneCount / profileItems.length) * 100);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }} className="animate-fade-in">

      {/* ─── Hero Header ─── */}
      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '6px' }}>
              {greeting}, <span className="gradient-text">{firstName}!</span> 👋
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
              Your AI job search is running. {stats?.applied || 0} applications submitted so far.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <Link href="/dashboard/jobs" className="btn-primary" style={{ fontSize: '13px' }}>
              ⚡ Find Jobs Now
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="grid-responsive-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {quickActions.map((a) => <QuickAction key={a.href} {...a} />)}
      </div>

      {/* ─── Stats ─── */}
      <div className="grid-responsive-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {loading ? (
          [1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: '130px', borderRadius: '1.25rem' }} />)
        ) : (
          statCards.map((s) => <StatCard key={s.label} {...s} />)
        )}
      </div>

      {/* ─── Content Grid ─── */}
      <div className="grid-responsive-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

        {/* Activity Feed */}
        <div className="premium-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 className="section-title">Recent Activity</h2>
            <Link href="/dashboard/applications" style={{ fontSize: '12px', color: '#7c6ef7', textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>View all →</Link>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: '56px', borderRadius: '10px' }} />)}
            </div>
          ) : (
            <div>
              {(alerts as any[]).length > 0 ? (
                (alerts as any[]).slice(0, 6).map((alert: any) => {
                  let icon = '🔔'; let color = '#7c6ef7';
                  if (alert.type === 'new_job') { icon = '🔍'; color = '#f59e0b'; }
                  else if (alert.type === 'high_match') { icon = '🎯'; color = '#7c6ef7'; }
                  else if (alert.type === 'system') { icon = '🤖'; color = '#a78bfa'; }
                  else if (alert.type === 'interview') { icon = '🎙️'; color = '#06d6a0'; }
                  else if (alert.type === 'rejection') { icon = '❌'; color = '#ef4444'; }
                  else if (alert.type === 'offer') { icon = '🏆'; color = '#06d6a0'; }
                  else if (alert.type === 'linkedin') { icon = '🔗'; color = '#38bdf8'; }
                  return <ActivityItem key={alert.id} icon={icon} text={`${alert.title}: ${alert.message}`} time={formatTimeAgo(alert.created_at)} color={color} />;
                })
              ) : (
                <>
                  <ActivityItem icon="🤖" text="AI Agent scanning LinkedIn for matching jobs..." time="Just now" color="#7c6ef7" />
                  <ActivityItem icon="📄" text="Upload your resume to get started with AI matching" time="Action needed" color="#f59e0b" />
                  <ActivityItem icon="💬" text="Configure WhatsApp to receive instant job alerts" time="Recommended" color="#06d6a0" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Profile Setup */}
          <div className="premium-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ fontSize: '14px' }}>Profile Setup</h3>
              <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: profileScore >= 80 ? '#34d399' : profileScore >= 60 ? '#fbbf24' : '#f87171' }}>{profileScore}%</span>
            </div>
            {profileItems.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0, background: item.done ? 'rgba(6,214,160,0.15)' : 'var(--surface-3)', color: item.done ? '#34d399' : 'var(--text-subtle)', border: item.done ? '1px solid rgba(6,214,160,0.3)' : '1px solid var(--border)' }}>
                  {item.done ? '✓' : ''}
                </div>
                <span style={{ fontSize: '12.5px', color: item.done ? 'var(--text)' : 'var(--text-subtle)', fontFamily: "'Space Grotesk', sans-serif" }}>{item.label}</span>
              </div>
            ))}
            <div style={{ marginTop: '14px' }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${profileScore}%` }} />
              </div>
            </div>
            {profileScore < 100 && (
              <Link href="/dashboard/settings" className="btn-secondary" style={{ marginTop: '14px', width: '100%', fontSize: '12px', padding: '8px' }}>
                Complete Profile →
              </Link>
            )}
          </div>

          {/* Top Job Matches */}
          <div className="premium-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ fontSize: '14px' }}>Top Matches</h3>
              <Link href="/dashboard/jobs" style={{ fontSize: '12px', color: '#7c6ef7', textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>See all</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loading ? (
                [1,2,3].map(i => <div key={i} className="shimmer" style={{ height: '44px', borderRadius: '10px' }} />)
              ) : recentJobs.length > 0 ? (
                recentJobs.slice(0, 4).map((job: any) => (
                  <Link key={job.id} href="/dashboard/jobs"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '8px', borderRadius: '10px', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => (e.currentTarget as any).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as any).style.background = 'transparent'}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: 'var(--brand-glow)', color: 'var(--brand)', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif", border: '1px solid var(--border)' }}>
                      {(job.company || 'J')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heavy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif" }}>{job.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{job.company}</div>
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: (job.match_percent || 0) >= 80 ? '#34d399' : (job.match_percent || 0) >= 60 ? '#fbbf24' : '#a78bfa', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {job.match_percent || 0}%
                    </div>
                  </Link>
                ))
              ) : (
                [{ role: 'Set your target roles', company: 'in Settings → Preferences', score: '—' },
                 { role: 'Upload your resume', company: 'for AI matching', score: '—' }].map((job) => (
                  <div key={job.role} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--surface-3)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'Space Grotesk', sans-serif" }}>{job.role}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>{job.company}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
