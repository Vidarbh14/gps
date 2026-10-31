'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import {
  displaySeats, effectiveFixTime, etaSecondsNow, formatAge, formatEtaMinutes, freshnessOf, MarkerMotion, SEATS_MAX_AGE_MS,
  type BusLocationEvent, type BusSeatsEvent, type FreshnessStatus, type RouteDeviationEvent, type TrackingSnapshot, type TripSummary,
} from '@transitlink/shared';
import type { GeoJSONSource } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import { getTracking } from '@/lib/live';
import { useNow } from '@/lib/useNow';

const MAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
const COLOR: Record<FreshnessStatus, string> = {
  LIVE: '#16a34a', DELAYED: '#d97706', STALE: '#94a3b8', WAITING_FOR_GPS: '#94a3b8', TRIP_ENDED: '#94a3b8',
};
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Dispatcher view of live GPS: every open trip, its freshness, progress and ETA, from the tracking server. */
export default function GpsFleet() {
  const mapRef = useRef<MapRef>(null);
  const [snap, setSnap] = useState<TrackingSnapshot | null>(null);
  const [trips, setTrips] = useState<Record<string, TripSummary>>({});
  const [latest, setLatest] = useState<Record<string, BusLocationEvent>>({});
  const [deviations, setDeviations] = useState<Record<string, RouteDeviationEvent>>({});
  const [seats, setSeats] = useState<Record<string, BusSeatsEvent>>({});
  const [conn, setConn] = useState('connecting');
  const [offset, setOffset] = useState(0);
  const motions = useRef(new globalThis.Map<string, MarkerMotion>());
  const latestRef = useRef(latest);
  latestRef.current = latest;
  const now = useNow() + offset;

  const motion = (busId: string) => {
    let m = motions.current.get(busId);
    if (!m) motions.current.set(busId, (m = new MarkerMotion()));
    return m;
  };

  useEffect(() => {
    const c = getTracking();
    const load = () => c.snapshot().then((s) => {
      setSnap(s);
      setOffset(s.server_time - Date.now());
      setTrips(Object.fromEntries(s.trips.map((t) => [t.id, t])));
      setLatest(Object.fromEntries(s.latest.map((l) => [l.bus_id, l])));
      setSeats(Object.fromEntries((s.seats ?? []).map((e) => [e.bus_id, e])));
      for (const l of s.latest) motion(l.bus_id).push({ location: l.location, timestamp: l.measured_at / 1000 }, performance.now());
    });
    const upsertTrip = (t: TripSummary) => setTrips((x) => ({ ...x, [t.id]: t }));
    const offs = [
      c.on('connection:state', (s) => { setConn(s); if (s === 'connected') void load(); }),
      c.on('bus:location', (e) => {
        setLatest((x) => (x[e.bus_id] && x[e.bus_id]!.trip_id === e.trip_id && x[e.bus_id]!.sequence >= e.sequence ? x : { ...x, [e.bus_id]: e }));
        motion(e.bus_id).push({ location: e.location, timestamp: e.measured_at / 1000 }, performance.now());
      }),
      c.on('trip:started', upsertTrip),
      c.on('trip:updated', upsertTrip),
      c.on('trip:ended', (t) => {
        upsertTrip(t);
        setLatest((x) => { const { [t.bus_id]: _, ...rest } = x; return rest; });
      }),
      c.on('route:deviation', (d) => setDeviations((x) => ({ ...x, [d.trip_id]: d }))),
      c.on('bus:seats', (e) => setSeats((x) => ({ ...x, [e.bus_id]: e }))),
    ];
    c.connect();
    return () => { offs.forEach((o) => o()); c.disconnect(); };
  }, []);

  const routesGeo = useMemo<GeoJSON.FeatureCollection>(() => {
    const active = new Set(Object.values(trips).filter((t) => t.status !== 'completed' && t.status !== 'cancelled').map((t) => t.route_id));
    return {
      type: 'FeatureCollection',
      features: (snap?.routes ?? []).filter((r) => r.geometry && active.has(r.id)).map((r) => ({
        type: 'Feature', properties: { id: r.id }, geometry: { type: 'LineString', coordinates: r.geometry! },
      })),
    };
  }, [snap, trips]);

  // Interpolated markers, pushed straight into the map source each frame (no React re-render) — same
  // approach as the existing LiveMap.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const src = mapRef.current?.getMap().getSource('gps-buses') as GeoJSONSource | undefined;
      if (src) {
        const t = performance.now();
        const serverNow = Date.now() + offset;
        const features: GeoJSON.Feature[] = [];
        for (const [busId, e] of Object.entries(latestRef.current)) {
          const pos = motion(busId).positionAt(t);
          if (!pos) continue;
          const f = freshnessOf(effectiveFixTime(e), serverNow, 'active');
          const bus = snap?.buses.find((b) => b.id === busId);
          features.push({ type: 'Feature', properties: { label: bus ? `Bus ${bus.fleet_number}` : busId, color: COLOR[f] }, geometry: { type: 'Point', coordinates: pos } });
        }
        src.setData({ type: 'FeatureCollection', features });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [snap, offset]);

  const open = Object.values(trips).filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

  return (
    <div className="flex h-full">
      <aside className="w-96 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live GPS · {open.length} open trips</h2>
          <span className={`text-xs ${conn === 'connected' ? 'text-green-700' : 'text-amber-700'}`}>{conn}</span>
        </div>
        {open.length === 0 && <p className="p-4 text-sm text-slate-500">No trips are being tracked. Drivers start a trip in the app.</p>}
        <ul className="divide-y divide-slate-100">
          {open.map((t) => {
            const e = latest[t.bus_id]?.trip_id === t.id ? latest[t.bus_id] : undefined;
            const f = freshnessOf(e ? effectiveFixTime(e) : null, now, t.status);
            const bus = snap?.buses.find((b) => b.id === t.bus_id);
            const route = snap?.routes.find((r) => r.id === t.route_id);
            const dev = deviations[t.id];
            return (
              <li key={t.id} className="cursor-pointer px-4 py-3 text-sm hover:bg-slate-50" onClick={() => e && mapRef.current?.flyTo({ center: e.location, zoom: 15 })}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Bus {bus?.fleet_number ?? t.bus_id} <span className="font-normal text-slate-500">{bus?.registration_number}</span></span>
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ background: COLOR[f] }}>{f.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-xs text-slate-500">{route?.name} · {t.direction === 'TO_COLLEGE' ? 'to college' : 'from college'} · {t.status.replace(/_/g, ' ')}</div>
                {e && (
                  <div className="mt-1 space-y-0.5 text-xs tabular-nums text-slate-600">
                    <div>{formatAge(now - effectiveFixTime(e))}{e.accuracy_m !== null ? ` · ±${Math.round(e.accuracy_m)} m` : ''} · {e.quality} fix</div>
                    {e.route ? (
                      <div>Next: {e.route.next_stop_name ?? '—'} · {(e.route.remaining_to_destination_m / 1000).toFixed(1)} km left · ETA {
                        // An ETA computed from a position that is no longer current would be misleading.
                        f === 'STALE' ? 'unavailable (no recent GPS)'
                          : e.eta.status === 'ok' ? formatEtaMinutes(etaSecondsNow(e.eta.destination_seconds, e.eta.computed_at, now)) : e.eta.status
                      }</div>
                    ) : (
                      <div className="text-amber-700">{t.route_ready ? 'Not yet matched to route' : `Route not configured: ${t.route_problems.join('; ')}`}</div>
                    )}
                  </div>
                )}
                {dev && !dev.resolved && <div className="mt-1 text-xs font-medium text-red-700">Off route (~{dev.distance_from_route_m} m)</div>}
                {seats[t.bus_id] && (() => {
                  const s = seats[t.bus_id]!;
                  const shown = displaySeats(s, now);
                  return (
                    <div className="mt-1 text-xs">
                      {shown ? <span className="font-medium">{shown.free}/{shown.capacity ?? '?'} seats free · {shown.source}</span>
                        : <span className="text-slate-500">Seats unavailable ({now - s.received_at > SEATS_MAX_AGE_MS ? 'no recent reading' : s.reason.replace(/_/g, ' ')})</span>}
                      {s.recalibration_required && <span className="ml-1 text-amber-700">· camera/IR disagree — recalibrate</span>}
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="relative min-w-0 flex-1">
        <Map ref={mapRef} initialViewState={{ longitude: 78.02, latitude: 30.31, zoom: 11.5 }} mapStyle={MAP_STYLE} style={{ width: '100%', height: '100%' }}>
          <NavigationControl position="top-right" />
          <Source id="gps-routes" type="geojson" data={routesGeo}>
            <Layer id="gps-route-line" type="line" paint={{ 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.6 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          </Source>
          <Source id="gps-buses" type="geojson" data={EMPTY}>
            <Layer id="gps-bus" type="circle" paint={{ 'circle-radius': 9, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 }} />
            <Layer id="gps-bus-label" type="symbol" layout={{ 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-allow-overlap': true }} paint={{ 'text-color': '#0f172a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 }} />
          </Source>
        </Map>
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 p-2 text-xs shadow">
          {(['LIVE', 'DELAYED', 'STALE'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: COLOR[k] }} />{k === 'LIVE' ? 'Live (≤5 s)' : k === 'DELAYED' ? 'Delayed (≤15 s)' : 'Stale / last known'}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
