import { STATUS_CONFIG } from './constants';
import { AppCard } from './AppCard';

export function KanbanColumn({ status, apps, onStatusChange, onDelete }: any) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '280px', width: '288px' }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingLeft: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-base">{cfg.icon}</span>
          <span className="font-display font-bold text-white text-sm">{cfg.label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: cfg.bg, color: cfg.color }}>
            {apps.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, borderRadius: '16px', padding: '8px', minHeight: '192px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        {apps.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '128px', textAlign: 'center' }}>
            <div className="text-2xl mb-2 opacity-30">{cfg.icon}</div>
            <p className="text-xs" style={{ color: '#4a5480' }}>No applications</p>
          </div>
        ) : (
          apps.map((app: any) => (
            <AppCard key={app.id} app={app} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
