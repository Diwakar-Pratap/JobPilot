'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  notify_new_jobs: boolean;
  notify_high_match: boolean;
  match_threshold: number;
  created_at: string;
}

interface ShareTracker {
  id: string;
  url: string;
  shared_at: string;
  opened_at: string | null;
  is_opened: boolean;
  applied_status: string;
  contact_name: string;
  job_title: string;
}

interface ShareStats {
  contact_name: string;
  total_shared: number;
  total_opened: number;
}

export default function WhatsAppPage() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyNewJobs, setNotifyNewJobs] = useState(true);
  const [notifyHighMatch, setNotifyHighMatch] = useState(true);
  const [matchThreshold, setMatchThreshold] = useState(70);

  // Simulation tab states
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'settings' | 'tracker'
  const [shares, setShares] = useState<ShareTracker[]>([]);
  const [shareStats, setShareStats] = useState<ShareStats[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [linked, setLinked] = useState(false);
  const [linking, setLinking] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Real WhatsApp Service integration states
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<string>('INITIALIZING');
  
  // Simulated chat messages log
  const [messages, setMessages] = useState<any[]>([
    { id: 1, sender: 'agent', text: 'Welcome to JobPilot WhatsApp Alert service! Link your device using the QR code below to receive live career updates directly on your phone. 🚀', time: '10:00 AM' }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const fetchContacts = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/whatsapp/contacts`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (e) {}
    setLoading(false);
  };

  const fetchShares = async () => {
    setLoadingShares(true);
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/whatsapp/shares`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
        setShareStats(data.stats || []);
      }
    } catch (e) {
      console.error("Failed to fetch shares", e);
    }
    setLoadingShares(false);
  };

  const handleUpdateStatus = async (trackerId: string, newStatus: string) => {
    const token = getToken();
    try {
      const res = await fetch(`${API}/api/whatsapp/shares/${trackerId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ applied_status: newStatus })
      });
      if (res.ok) {
        showToast('✓ Status updated successfully');
        fetchShares();
      } else {
        showToast('❌ Failed to update status');
      }
    } catch (e) {
      showToast('❌ Connection error');
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (activeTab === 'tracker') {
      fetchShares();
    }
  }, [activeTab]);

  useEffect(() => {
    let interval: any = null;
    let hasNotifiedLinked = false;

    const checkStatus = async () => {
      const token = getToken();
      try {
        const res = await fetch(`${API}/api/whatsapp/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setServiceStatus(data.status);
          if (data.status === 'CONNECTED') {
            setLinked(true);
            localStorage.setItem('whatsapp_linked', 'true');
            if (!hasNotifiedLinked) {
              setMessages(prev => {
                if (prev.some(m => m.text.includes('Device linked'))) return prev;
                return [
                  ...prev,
                  { id: Date.now(), sender: 'system', text: '📱 Device linked: Windows / Chrome Browser Session Active.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                  { id: Date.now() + 1, sender: 'agent', text: 'You are now ready to receive live job alerts! I will notify you as soon as matching positions are synced. 💼', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
                ];
              });
              hasNotifiedLinked = true;
            }
          } else {
            setLinked(false);
            localStorage.setItem('whatsapp_linked', 'false');
            hasNotifiedLinked = false;
            if (data.status === 'QR_READY' && data.qr) {
              setQrCodeUrl(data.qr);
              setQrGenerated(true);
            } else {
              setQrCodeUrl(null);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch WhatsApp status", e);
      }
    };

    checkStatus();

    interval = setInterval(() => {
      checkStatus();
    }, 2500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleUnlink = async () => {
    if (confirm('Unlink this device from WhatsApp?')) {
      const token = getToken();
      try {
        const res = await fetch(`${API}/api/whatsapp/unlink`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setLinked(false);
          setQrGenerated(false);
          localStorage.setItem('whatsapp_linked', 'false');
          showToast('✓ Device unlinked.');
          setMessages(prev => [
            ...prev,
            { id: Date.now(), sender: 'system', text: '🔴 Device unlinked.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        } else {
          showToast('❌ Failed to unlink device');
        }
      } catch (e) {
        showToast('❌ Connection error');
      }
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsgText = chatInput;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsgText, time: timeStr }]);
    setChatInput('');

    setTimeout(() => {
      let replyText = "Awaiting career feed sync. I will send you any new jobs as soon as they are processed. 💼";
      const lower = userMsgText.toLowerCase();
      if (lower.includes('status') || lower.includes('ready')) {
        replyText = `JobPilot Agent status: Active ●\nTracking: ${contacts.length} contact(s) configured.\nMonitoring LinkedIn live searches.`;
      } else if (lower.includes('hi') || lower.includes('hello')) {
        replyText = "Hello! I am your JobPilot Career Agent. I am monitoring new positions matching your target roles. Ask me 'status' or just wait for live alerts! 🤖";
      } else if (lower.includes('jobs') || lower.includes('roles')) {
        replyText = "I will scan LinkedIn live for your target roles every 15 minutes. Check the Find Jobs tab to see results.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'agent', text: replyText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }, 1200);
  };

  const resetForm = () => {
    setName(''); setPhone(''); setNotifyNewJobs(true);
    setNotifyHighMatch(true); setMatchThreshold(70);
    setShowAdd(false); setEditId(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { showToast('❌ Name and phone are required'); return; }
    const token = getToken();
    const body = { name, phone, notify_new_jobs: notifyNewJobs, notify_high_match: notifyHighMatch, match_threshold: matchThreshold };

    try {
      let res;
      if (editId) {
        res = await fetch(`${API}/api/whatsapp/contacts/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API}/api/whatsapp/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }
      if (res.ok) {
        showToast(editId ? '✓ Contact updated' : '✓ Contact added');
        resetForm();
        fetchContacts();
      } else {
        const err = await res.json();
        showToast(`❌ ${err.detail || 'Failed'}`);
      }
    } catch (e) { showToast('❌ Connection failed'); }
  };

  const deleteContact = async (id: string) => {
    if (!confirm('Remove this contact?')) return;
    const token = getToken();
    try {
      await fetch(`${API}/api/whatsapp/contacts/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      showToast('✓ Contact removed');
      fetchContacts();
    } catch (e) {}
  };

  const toggleActive = async (contact: WhatsAppContact) => {
    const token = getToken();
    try {
      await fetch(`${API}/api/whatsapp/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...contact, is_active: !contact.is_active }),
      });
      fetchContacts();
    } catch (e) {}
  };

  const sendTest = async (id: string) => {
    const token = getToken();
    const contact = contacts.find(c => c.id === id);
    try {
      const res = await fetch(`${API}/api/whatsapp/contacts/${id}/test`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('✓ Test message queued!');
        // Append to simulator
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            sender: 'agent',
            text: `🎯 JobPilot Alert: Hello ${contact?.name || 'User'}! This is a test alert from your JobPilot Career Agent. 🚀`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        showToast('❌ Failed to send test');
      }
    } catch (e) { showToast('❌ Connection error'); }
  };

  const startEdit = (c: WhatsAppContact) => {
    setEditId(c.id); setName(c.name); setPhone(c.phone);
    setNotifyNewJobs(c.notify_new_jobs); setNotifyHighMatch(c.notify_high_match);
    setMatchThreshold(c.match_threshold); setShowAdd(true);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '4px' }}>
            💬 WhatsApp Integration
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Link your WhatsApp account and manage contacts to receive live job matching updates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('simulator')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 16px', fontSize: '14px', fontWeight: 600,
            color: activeTab === 'simulator' ? '#25d366' : 'var(--text-muted)',
            borderBottom: activeTab === 'simulator' ? '2px solid #25d366' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          📱 WhatsApp Web Simulator
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 16px', fontSize: '14px', fontWeight: 600,
            color: activeTab === 'settings' ? '#25d366' : 'var(--text-muted)',
            borderBottom: activeTab === 'settings' ? '2px solid #25d366' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          ⚙️ Alert Contacts
        </button>
        <button
          onClick={() => setActiveTab('tracker')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 16px', fontSize: '14px', fontWeight: 600,
            color: activeTab === 'tracker' ? '#25d366' : 'var(--text-muted)',
            borderBottom: activeTab === 'tracker' ? '2px solid #25d366' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          📈 Link Click Tracker
        </button>
      </div>

      {/* ── Tab 1: WhatsApp Web Simulator ── */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
          {/* Connection Card */}
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
            /* WhatsApp web replica */
            <div style={{
              display: 'flex', height: '560px', borderRadius: '16px', overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--bg)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
            }} className="animate-scale-in">
              {/* Left sidebar contacts panel */}
              <div style={{
                width: '320px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column',
                borderRight: '1px solid var(--border)'
              }}>
                {/* Simulated Web Header */}
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

                {/* Simulated chats search */}
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ background: 'var(--surface-3)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🔍</span>
                    <input type="text" disabled placeholder="Search or start new chat" style={{ background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-heavy)', width: '100%' }} />
                  </div>
                </div>

                {/* Contacts Chats List */}
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

              {/* Right panel chat content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
                {/* Chat header */}
                <div style={{ padding: '12px 16px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    🤖
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heavy)' }}>JobPilot Agent</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Active monitoring</div>
                  </div>
                </div>

                {/* Chat messages */}
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
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input footer */}
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
      )}

      {/* ── Tab 2: Settings CRUD list ── */}
      {activeTab === 'settings' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px' }}>
              👥 WhatsApp Notification Contacts
            </h3>
            <button
              onClick={() => { resetForm(); setShowAdd(true); }}
              style={{
                padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '10px',
                background: 'linear-gradient(135deg, #25d366, #128c7e)',
                color: 'white', border: 'none', cursor: 'pointer',
              }}
            >
              + Add New Contact
            </button>
          </div>

          {/* Add/Edit Form Modal */}
          {showAdd && (
            <div style={{
              padding: '24px', borderRadius: '16px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }} className="animate-scale-in">
              <h4 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '15px', marginBottom: '16px' }}>
                {editId ? '✏️ Edit Contact' : '➕ Add WhatsApp Contact'}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Name</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g., John Doe"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
                      background: 'var(--surface-3)', border: '1px solid var(--border)',
                      color: 'var(--text-heavy)', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Phone Number</label>
                  <input
                    value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px',
                      background: 'var(--surface-3)', border: '1px solid var(--border)',
                      color: 'var(--text-heavy)', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Notification options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={notifyNewJobs} onChange={e => setNotifyNewJobs(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text)' }}>Notify for all new jobs</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={notifyHighMatch} onChange={e => setNotifyHighMatch(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#25d366' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text)' }}>Only notify for high-match jobs</span>
                </label>
                {notifyHighMatch && (
                  <div style={{ paddingLeft: '28px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Minimum match: <strong style={{ color: '#25d366' }}>{matchThreshold}%</strong>
                    </label>
                    <input type="range" min={30} max={95} step={5} value={matchThreshold}
                      onChange={e => setMatchThreshold(Number(e.target.value))}
                      style={{ width: '200px', accentColor: '#25d366' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={resetForm}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSubmit}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {editId ? '💾 Save Changes' : '✓ Add Contact'}
                </button>
              </div>
            </div>
          )}

          {/* Contacts List */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="shimmer" style={{ height: '96px', borderRadius: '16px' }} />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '18px', marginBottom: '8px' }}>
                No alert contacts configured
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Configure phone numbers to dispatch notifications on successful job matches
              </p>
              <button onClick={() => { resetForm(); setShowAdd(true); }}
                style={{
                  padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
                  background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white',
                  border: 'none', cursor: 'pointer',
                }}>
                + Configure Contact
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {contacts.map(contact => (
                <div key={contact.id} style={{
                  padding: '16px 20px', borderRadius: '16px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: '16px',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = '1px solid rgba(37,211,102,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = '1px solid var(--border)'}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: 700,
                    background: contact.is_active ? 'rgba(37,211,102,0.12)' : 'var(--surface-3)',
                    color: contact.is_active ? '#25d366' : 'var(--text-muted)',
                    border: `2px solid ${contact.is_active ? 'rgba(37,211,102,0.3)' : 'var(--border)'}`,
                  }}>
                    {contact.name[0]?.toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-heavy)' }}>{contact.name}</span>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                        background: contact.is_active ? 'rgba(37,211,102,0.12)' : 'var(--surface-3)',
                        color: contact.is_active ? '#25d366' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}>
                        {contact.is_active ? '● Active' : '○ Paused'}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>{contact.phone}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {contact.notify_new_jobs && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                          📋 All Jobs
                        </span>
                      )}
                      {contact.notify_high_match && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#fcd34d' }}>
                          🎯 Match ≥{contact.match_threshold}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => toggleActive(contact)}
                      title={contact.is_active ? 'Pause' : 'Activate'}
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                        background: 'var(--surface-3)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {contact.is_active ? '⏸️' : '▶️'}
                    </button>
                    <button onClick={() => sendTest(contact.id)}
                      title="Send Test Notification"
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                        background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)',
                        color: '#25d366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      📩
                    </button>
                    <button onClick={() => startEdit(contact)}
                      title="Edit"
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                        background: 'var(--surface-3)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      ✏️
                    </button>
                    <button onClick={() => deleteContact(contact.id)}
                      title="Delete"
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px', fontSize: '14px',
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
                        color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Link Click Tracker ── */}
      {activeTab === 'tracker' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stats overview cards */}
          <div>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px', marginBottom: '16px' }}>
              📊 Click-Through Stats
            </h3>
            {shareStats.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No share stats available yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {shareStats.map((stat, idx) => {
                  const ctr = stat.total_shared > 0 ? ((stat.total_opened / stat.total_shared) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="premium-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-heavy)' }}>{stat.contact_name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <span>Total Shared:</span>
                        <strong style={{ color: 'var(--text-heavy)' }}>{stat.total_shared}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <span>Total Opened:</span>
                        <strong style={{ color: '#25d366' }}>{stat.total_opened}</strong>
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span>CTR (Open Rate)</span>
                          <strong>{ctr}%</strong>
                        </div>
                        <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${ctr}%`, height: '100%', background: '#25d366', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shares logs list */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, color: 'var(--text-heavy)', fontSize: '16px' }}>
                📋 Link Sharing & Click Logs
              </h3>
              <button
                onClick={fetchShares}
                disabled={loadingShares}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px',
                  background: 'var(--surface-3)', color: 'var(--text-heavy)', border: '1px solid var(--border)', cursor: 'pointer'
                }}
              >
                {loadingShares ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>

            {loadingShares ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="shimmer" style={{ height: '64px', borderRadius: '12px' }} />
                ))}
              </div>
            ) : shares.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📈</div>
                <h4 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, color: 'var(--text-heavy)', fontSize: '16px', marginBottom: '4px' }}>
                  No jobs shared yet
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Shared jobs will automatically appear here with click tracking info.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-3)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Recipient</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Job Position</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Shared At</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Opened At</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>Applied?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shares.map((share) => (
                      <tr key={share.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-heavy)' }}>{share.contact_name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={share.job_title}>
                              {share.job_title}
                            </span>
                            <a href={share.url} target="_blank" rel="noopener noreferrer" title="View Job Link" style={{ textDecoration: 'none', color: '#25d366', fontSize: '14px' }}>
                              🔗
                            </a>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {share.is_opened ? (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(37,211,102,0.12)', color: '#25d366', fontWeight: 600 }}>
                              Opened
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'var(--surface-3)', color: 'var(--text-muted)', fontWeight: 600 }}>
                              Sent
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {new Date(share.shared_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {share.opened_at ? new Date(share.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <select
                            value={share.applied_status}
                            onChange={(e) => handleUpdateStatus(share.id, e.target.value)}
                            style={{
                              padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                              background: 'var(--surface-3)', border: '1px solid var(--border)',
                              color: 'var(--text-heavy)', outline: 'none', cursor: 'pointer'
                            }}
                          >
                            <option value="not_asked">Pending</option>
                            <option value="applied">Applied</option>
                            <option value="not_applied">Not Applied</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="animate-slide-in-right" style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
          padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
          color: 'var(--text-heavy)', background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
