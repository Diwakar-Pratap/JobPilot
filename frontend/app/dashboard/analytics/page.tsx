'use client';

import { useEffect, useState } from 'react';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

function BarChart({ data, color = '#6366f1' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '128px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '4px' }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100px' }}>
            <div style={{ width: '100%', borderRadius: '4px 4px 0 0', transition: 'all 0.7s', height: `${(d.value / max) * 100}%`, background: `linear-gradient(180deg, ${color}, ${color}80)`, minHeight: d.value > 0 ? 4 : 0 }} />
          </div>
          <span style={{ fontSize: '11px', color: '#4a5480' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ value, max = 100, color = '#6366f1', label }: any) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = (value / max) * circumference;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '96px', height: '96px' }}>
        <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '18px', color: 'white' }}>{value}%</span>
        </div>
      </div>
      <span style={{ fontSize: '11px', marginTop: '8px', color: '#8892b0' }}>{label}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken();
      try {
        const res = await fetch(`${API}/api/analytics/overview`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setOverview(await res.json());
      } catch (e) {}
      setLoading(false);
    };
    fetchData();
  }, []);

  const summary = overview?.summary || {};
  const rates = overview?.rates || {};
  const trend = overview?.trend || [];
  const statusDist = overview?.status_distribution || {};

  const trendData = trend.slice(-7).map((t: any) => ({
    label: new Date(t.date).toLocaleDateString('en', { weekday: 'short' }),
    value: t.count,
  }));

  const statusBarData = Object.entries(statusDist)
    .filter(([k]) => k !== 'saved')
    .map(([status, count]) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1),
      value: count as number,
    }));

  return (
    <div style={{ maxWidth: '1152px', margin: '0 auto' }} className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Analytics</h1>
        <p style={{ fontSize: '14px', color: '#8892b0' }}>Track your job search performance and insights</p>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { icon: '📤', label: 'Total Applications', value: summary.applied ?? '—', color: '#6366f1' },
          { icon: '🎙️', label: 'Interviews', value: summary.interviews ?? '—', color: '#10b981' },
          { icon: '🏆', label: 'Offers', value: summary.offers ?? '—', color: '#f59e0b' },
          { icon: '📌', label: 'Saved', value: summary.saved ?? '—', color: '#8b5cf6' },
        ].map((s) => (
          <div key={s.label} className="premium-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '20px' }}>{s.icon}</div>
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 900, color: 'white', marginBottom: '4px' }}>{loading ? '—' : s.value}</div>
            <div style={{ fontSize: '13px', color: '#8892b0' }}>{s.label}</div>
            <div className="progress-bar" style={{ marginTop: '12px' }}>
              <div className="progress-fill" style={{ width: s.value && summary.total ? `${(Number(s.value) / summary.total) * 100}%` : '0%', background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)` }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
        {/* Response Rates */}
        <div className="premium-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', marginBottom: '24px' }}>Conversion Rates</h3>
          {loading ? (
            <div className="shimmer" style={{ height: '128px', borderRadius: '12px' }} />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <DonutChart value={rates.response_rate || 0} label="Response Rate" color="#10b981" />
              <DonutChart value={rates.interview_rate || 0} label="Interview Rate" color="#6366f1" />
              <DonutChart value={rates.offer_rate || 0} label="Offer Rate" color="#f59e0b" />
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="premium-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', marginBottom: '24px' }}>Application Status</h3>
          {loading ? (
            <div className="shimmer" style={{ height: '128px', borderRadius: '12px' }} />
          ) : statusBarData.length > 0 ? (
            <BarChart data={statusBarData} color="#6366f1" />
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
              <p style={{ fontSize: '13px', color: '#4a5480' }}>Apply to jobs to see data</p>
            </div>
          )}
        </div>

        {/* Application Trend */}
        <div className="premium-card" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', marginBottom: '24px' }}>Weekly Activity</h3>
          {loading ? (
            <div className="shimmer" style={{ height: '128px', borderRadius: '12px' }} />
          ) : trendData.length > 0 ? (
            <BarChart data={trendData} color="#10b981" />
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
              <p style={{ fontSize: '13px', color: '#4a5480' }}>No trend data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Tips & Insights */}
      <div className="premium-card" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white', marginBottom: '20px' }}>🤖 AI Job Search Insights</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: '⚡', title: 'Apply Early', desc: 'Applications submitted within 24 hours of posting get 3x more responses. Enable job alerts to never miss new postings.' },
            { icon: '📄', title: 'Optimize Resume', desc: 'Include quantified achievements (e.g., "Reduced latency by 40%") and ATS-friendly keywords from job descriptions.' },
            { icon: '🎯', title: 'Target Match Score', desc: 'Focus on jobs with 75%+ match score. Our AI has found these convert to interviews at 3x the rate.' },
            { icon: '✉️', title: 'Personalize Outreach', desc: 'Custom cover letters increase response rate by 40%. Use our AI Cover Letter generator for each application.' },
            { icon: '🏢', title: 'Track Dream Companies', desc: 'Add your target companies to the watchlist. Get instant alerts when new roles are posted.' },
            { icon: '📊', title: 'Follow Up', desc: 'Send a follow-up email after 7 days of no response. It increases your response rate by 25%.' },
          ].map((tip) => (
            <div key={tip.title} style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{tip.icon}</div>
              <div style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '4px' }}>{tip.title}</div>
              <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#4a5480' }}>{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
