export const STATUSES = ['saved', 'pending', 'applied', 'interview', 'offer', 'rejected'];

export const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  saved:     { label: 'Saved',      icon: '📌', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  pending:   { label: 'Pending',    icon: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  applied:   { label: 'Applied',    icon: '📤', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  interview: { label: 'Interview',  icon: '🎙️', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  offer:     { label: 'Offer',      icon: '🏆', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  rejected:  { label: 'Rejected',   icon: '✗',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};
