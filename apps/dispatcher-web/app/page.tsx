'use client';

import dynamic from 'next/dynamic';
import { FleetPanel } from '@/components/FleetPanel';

// maplibre touches `window` at import time, so the map is client-only.
const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">Loading map…</div>,
});

export default function DashboardPage() {
  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Fleet</h2>
        <FleetPanel />
      </aside>
      <section className="relative min-w-0 flex-1">
        <LiveMap />
      </section>
    </div>
  );
}
