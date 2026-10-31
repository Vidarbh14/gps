'use client';

import { getDataSource } from '@/lib/dataSource';
import { useFleetStore } from '@/store/fleetStore';

export function SosBanner() {
  const sos = useFleetStore((s) => s.sos);
  const selectBus = useFleetStore((s) => s.selectBus);
  const alerts = Object.values(sos);
  if (alerts.length === 0) return null;

  return (
    <div role="alert" className="space-y-1 bg-red-600 px-4 py-2 text-white">
      {alerts.map((a) => (
        <div key={a.bus_id} className="flex items-center justify-between gap-4">
          <span className="font-semibold">
            🚨 SOS from {a.bus_id} — raised {new Date(a.raised_at * 1000).toLocaleTimeString()}
          </span>
          <div className="flex gap-2">
            <button onClick={() => selectBus(a.bus_id)} className="rounded bg-white/20 px-3 py-1 text-sm hover:bg-white/30">
              Locate
            </button>
            <button
              onClick={() => getDataSource().clearSos(a.bus_id)}
              className="rounded bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Mark resolved
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
