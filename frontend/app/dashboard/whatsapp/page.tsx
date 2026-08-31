'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { WhatsAppSimulator, WhatsAppContacts, ShareTracker, EmailConfig } from './_components';

const API = '';
function getToken() { return localStorage.getItem('access_token') || ''; }

interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
    email: string | null;
    notify_via_whatsapp: boolean;
    notify_via_email: boolean;
  is_active: boolean;
  notify_new_jobs: boolean;
  notify_high_match: boolean;
  match_threshold: number;
  created_at: string;
}

interface ShareTrackerData {
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
  const [email, setEmail] = useState('');
  const [notifyViaWhatsapp, setNotifyViaWhatsapp] = useState(true);
  const [notifyViaEmail, setNotifyViaEmail] = useState(false);
  const [notifyNewJobs, setNotifyNewJobs] = useState(true);
  const [sendWelcomeMessage, setSendWelcomeMessage] = useState(true);
  const [notifyHighMatch, setNotifyHighMatch] = useState(true);
  const [matchThreshold, setMatchThreshold] = useState(70);

  // Simulation tab states
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'settings' | 'tracker'
  const [shares, setShares] = useState<ShareTrackerData[]>([]);
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
    setName(''); setPhone(''); setEmail(''); setNotifyViaWhatsapp(true); setNotifyViaEmail(false); setNotifyNewJobs(true); setSendWelcomeMessage(true);
    setNotifyHighMatch(true); setMatchThreshold(70);
    setShowAdd(false); setEditId(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { showToast('❌ Name and phone are required'); return; }
    const token = getToken();
    const body = { name, phone, email, notify_via_whatsapp: notifyViaWhatsapp, notify_via_email: notifyViaEmail, notify_new_jobs: notifyNewJobs, notify_high_match: notifyHighMatch, match_threshold: matchThreshold, send_welcome_message: sendWelcomeMessage };

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

  const sendIntro = async (id: string) => {
    const token = getToken();
    const contact = contacts.find(c => c.id === id);
    try {
      const res = await fetch(`${API}/api/whatsapp/contacts/${id}/intro`, {
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
    setEditId(c.id); setName(c.name); setPhone(c.phone); setEmail(c.email || ''); setNotifyViaWhatsapp(c.notify_via_whatsapp ?? true); setNotifyViaEmail(c.notify_via_email ?? false);
    setNotifyNewJobs(c.notify_new_jobs); setNotifyHighMatch(c.notify_high_match);
    setMatchThreshold(c.match_threshold); setShowAdd(true);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text-heavy)', marginBottom: '4px' }}>
            🔔 Notification Alerts
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Link your account and manage contacts to receive live job matching updates via WhatsApp or Email
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
          <button
            onClick={() => setActiveTab('email')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: '14px', fontWeight: 600,
              color: activeTab === 'email' ? '#25d366' : 'var(--text-muted)',
              borderBottom: activeTab === 'email' ? '2px solid #25d366' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            📧 Email Config
          </button>
      </div>

      {/* ── Tab 1: WhatsApp Web Simulator ── */}
      {activeTab === 'simulator' && (
        <WhatsAppSimulator 
          linked={linked} serviceStatus={serviceStatus} qrCodeUrl={qrCodeUrl} 
          handleUnlink={handleUnlink} messages={messages} chatInput={chatInput} 
          setChatInput={setChatInput} handleSendMessage={handleSendMessage} chatEndRef={chatEndRef} 
        />
      )}

      {/* ── Tab 2: Settings CRUD list ── */}
      {activeTab === 'settings' && (
        <WhatsAppContacts 
          showAdd={showAdd} setShowAdd={setShowAdd} resetForm={resetForm} editId={editId}
          name={name} setName={setName} phone={phone} setPhone={setPhone}
          email={email} setEmail={setEmail}
          notifyViaWhatsapp={notifyViaWhatsapp} setNotifyViaWhatsapp={setNotifyViaWhatsapp}
          notifyViaEmail={notifyViaEmail} setNotifyViaEmail={setNotifyViaEmail}
          notifyNewJobs={notifyNewJobs} setNotifyNewJobs={setNotifyNewJobs}
          notifyHighMatch={notifyHighMatch} setNotifyHighMatch={setNotifyHighMatch}
          matchThreshold={matchThreshold} setMatchThreshold={setMatchThreshold}
          handleSubmit={handleSubmit} loading={loading} contacts={contacts}
          toggleActive={toggleActive} sendIntro={sendIntro} sendWelcomeMessage={sendWelcomeMessage} setSendWelcomeMessage={setSendWelcomeMessage} startEdit={startEdit} deleteContact={deleteContact}
        />
      )}

      {/* ── Tab 3: Link Click Tracker ── */}
      {activeTab === 'tracker' && (
        <ShareTracker 
          shareStats={shareStats} fetchShares={fetchShares} loadingShares={loadingShares} 
          shares={shares} handleUpdateStatus={handleUpdateStatus} 
        />
      )}

        {activeTab === 'email' && (
          <EmailConfig />
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
