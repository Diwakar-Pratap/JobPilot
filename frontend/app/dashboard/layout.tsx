'use client';

import { useEffect, useState, useRef, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const API = '';

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard', id: 'nav-dashboard', mobileLabel: 'Home' },
  { href: '/dashboard/jobs', icon: '💼', label: 'Find Jobs', id: 'nav-jobs', mobileLabel: 'Jobs' },
  { href: '/dashboard/applications', icon: '📋', label: 'Applications', id: 'nav-applications', mobileLabel: 'Track' },
  { href: '/dashboard/resume', icon: '📄', label: 'My Resume', id: 'nav-resume', mobileLabel: 'Resume' },
  { href: '/dashboard/companies', icon: '🏢', label: 'Companies', id: 'nav-companies', mobileLabel: 'Companies' },
  { href: '/dashboard/whatsapp', icon: '💬', label: 'WhatsApp', id: 'nav-whatsapp', mobileLabel: 'Alerts' },
  { href: '/dashboard/analytics', icon: '📊', label: 'Analytics', id: 'nav-analytics', mobileLabel: 'Stats' },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Settings', id: 'nav-settings', mobileLabel: 'More' },
];

// Mobile bottom nav shows only 5 items
const mobileNavItems = [
  navItems[0], navItems[1], navItems[2], navItems[5], navItems[7]
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  };


  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, [router]);

  // Fetch notifications
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${API}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const list = data.notifications || [];
          setNotifications(list);
          setUnreadCount(list.filter((n: any) => !n.is_read).length);
        }
      } catch (e) {}
    };
    fetchNotifs();

    const es = new EventSource(`${API}/api/notifications/stream?token=${token}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') return;
        setNotifications(prev => [data, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        if (Notification.permission === 'granted') {
          new Notification(data.title || 'JobPilot', { body: data.message });
        }
      } catch (e) {}
    };
    eventSourceRef.current = es;
    return () => es.close();
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    const token = localStorage.getItem('access_token');
    try {
      await fetch(`${API}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    if (eventSourceRef.current) eventSourceRef.current.close();
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'new_job': return '💼'; case 'high_match': return '🎯';
      case 'interview': return '🎙️'; case 'offer': return '🎉';
      case 'rejection': return '❌'; case 'linkedin': return '🔗';
      case 'whatsapp': return '💬'; default: return '🔔';
    }
  };

  const currentPage = navItems.find(n => isActive(n.href))?.label || 'Dashboard';

  const sidebarStyle: React.CSSProperties = {
    width: sidebarCollapsed ? '72px' : '240px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    backdropFilter: 'blur(20px)',
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1)',
    position: 'relative',
    zIndex: 10,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══ Sidebar (Desktop) ═══ */}
      <aside className="dashboard-sidebar" style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding: sidebarCollapsed ? '20px 16px' : '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: '10px' }}>
          {!sidebarCollapsed && (
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flex: 1 }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', background: 'linear-gradient(135deg, #7c6ef7, #a78bfa)', boxShadow: '0 4px 20px rgba(124,110,247,0.5)', flexShrink: 0 }}>🚀</div>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', letterSpacing: '-0.03em' }}>JobPilot</div>
                <div style={{ color: '#3d4a70', fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>AI Career</div>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', background: 'linear-gradient(135deg, #7c6ef7, #a78bfa)', boxShadow: '0 4px 20px rgba(124,110,247,0.5)' }}>🚀</div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d4a70', fontSize: '14px', padding: '4px', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget as any).style.color = '#7b8ab8'}
            onMouseLeave={e => (e.currentTarget as any).style.color = '#3d4a70'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {!sidebarCollapsed && (
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3d4a70', paddingLeft: '12px', marginBottom: '8px', marginTop: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>Navigation</p>
          )}
          {navItems.slice(0, 6).map((item) => (
            <Link key={item.href} id={item.id} href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: sidebarCollapsed ? '11px' : '10px 12px',
                borderRadius: '10px', marginBottom: '2px',
                fontSize: '13.5px', fontWeight: 500, textDecoration: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                color: isActive(item.href) ? '#c4b5fd' : '#7b8ab8',
                background: isActive(item.href) ? 'linear-gradient(135deg, rgba(124,110,247,0.15), rgba(124,110,247,0.08))' : 'transparent',
                border: isActive(item.href) ? '1px solid rgba(124,110,247,0.2)' : '1px solid transparent',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive(item.href)) { (e.currentTarget as any).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as any).style.color = '#e2e8ff'; } }}
              onMouseLeave={e => { if (!isActive(item.href)) { (e.currentTarget as any).style.background = 'transparent'; (e.currentTarget as any).style.color = '#7b8ab8'; } }}
            >
              {isActive(item.href) && !sidebarCollapsed && (
                <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '60%', background: 'linear-gradient(180deg, #7c6ef7, #a78bfa)', borderRadius: '0 3px 3px 0' }} />
              )}
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
              {!sidebarCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              {!sidebarCollapsed && item.href === '/dashboard/whatsapp' && (
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '6px', background: 'rgba(6,214,160,0.12)', color: '#34d399', fontWeight: 700, border: '1px solid rgba(6,214,160,0.2)' }}>Live</span>
              )}
            </Link>
          ))}

          <div style={{ height: '1px', background: 'var(--border)', margin: '12px 4px' }} />
          {!sidebarCollapsed && (
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3d4a70', paddingLeft: '12px', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>Tools</p>
          )}
          {navItems.slice(6).map((item) => (
            <Link key={item.href} id={item.id} href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: sidebarCollapsed ? '11px' : '10px 12px',
                borderRadius: '10px', marginBottom: '2px',
                fontSize: '13.5px', fontWeight: 500, textDecoration: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                color: isActive(item.href) ? '#c4b5fd' : '#7b8ab8',
                background: isActive(item.href) ? 'linear-gradient(135deg, rgba(124,110,247,0.15), rgba(124,110,247,0.08))' : 'transparent',
                border: isActive(item.href) ? '1px solid rgba(124,110,247,0.2)' : '1px solid transparent',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive(item.href)) { (e.currentTarget as any).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as any).style.color = '#e2e8ff'; } }}
              onMouseLeave={e => { if (!isActive(item.href)) { (e.currentTarget as any).style.background = 'transparent'; (e.currentTarget as any).style.color = '#7b8ab8'; } }}
            >
              {isActive(item.href) && !sidebarCollapsed && (
                <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '60%', background: 'linear-gradient(180deg, #7c6ef7, #a78bfa)', borderRadius: '0 3px 3px 0' }} />
              )}
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Footer */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: 'linear-gradient(135deg, #7c6ef7, #a78bfa)', color: 'white', flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                {user?.name?.[0] || 'U'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heavy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif" }}>{user?.name || 'User'}</div>
                <div style={{ fontSize: '10px', color: '#3d4a70', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || ''}</div>
              </div>
              <button id="logout-btn" onClick={handleLogout}
                style={{ fontSize: '13px', padding: '4px 6px', borderRadius: '6px', color: '#3d4a70', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as any).style.color = '#f87171'; }}
                onMouseLeave={e => { (e.currentTarget as any).style.background = 'transparent'; (e.currentTarget as any).style.color = '#3d4a70'; }}
                title="Logout"
              >⇥</button>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleLogout} style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#3d4a70', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as any).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as any).style.color = '#f87171'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.background = 'var(--surface-2)'; (e.currentTarget as any).style.color = '#3d4a70'; }}
              title="Logout">⇥</button>
          </div>
        )}
      </aside>

      {/* ═══ Main Content ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Topbar */}
        <header className="dashboard-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', backdropFilter: 'blur(16px)', flexShrink: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', letterSpacing: '-0.02em' }}>{currentPage}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>

            {/* Theme Toggle */}
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              style={{
                width: '38px', height: '38px', borderRadius: '11px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s ease',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => { (e.currentTarget as any).style.background = 'var(--surface-3)'; (e.currentTarget as any).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.background = 'var(--surface-2)'; (e.currentTarget as any).style.color = 'var(--text-muted)'; }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>


            {/* AI Status pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '999px', fontSize: '11.5px', background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', fontFamily: "'Space Grotesk', sans-serif" }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} className="animate-pulse-slow" />
              <span style={{ color: '#34d399', fontWeight: 600 }}>AI Live</span>
            </div>
            <Link href="/dashboard/jobs" className="btn-primary" style={{ padding: '7px 14px', fontSize: '12px' }}>⚡ Find Jobs</Link>
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-main" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>

      {/* ═══ Mobile Bottom Nav ═══ */}
      <nav className="mobile-bottom-nav">
        {mobileNavItems.map((item) => (
          <Link key={item.href} href={item.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '3px', padding: '6px 4px', textDecoration: 'none',
              color: isActive(item.href) ? '#c4b5fd' : '#3d4a70',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '9px', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.02em' }}>{item.mobileLabel}</span>
            {isActive(item.href) && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#7c6ef7', marginTop: '1px' }} />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
