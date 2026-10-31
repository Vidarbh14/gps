# Vidhu — Frontend, UI/UX & Mapping (TransitLink)

Extracted from *TransitLink Architecture Blueprint.pdf*. Items marked **(explicit)** are written in the
PDF; items marked **(implied)** are not spelled out but are required for the explicit items to work.

## 1. Tech stack (explicit, §1.2)
- Next.js 14 (App Router) — Dispatcher web dashboard
- React Native (Expo) — Student app + Driver app
- Zustand — client/real-time state
- React Query — server state (routes, stops, buses, tokens)
- React-Map-GL — web live map (§5.1)

## 2. Deliverables

### 2.1 Dispatcher Web (explicit, §5.1)
- [x] Live fleet map (React-Map-GL) — routes, stops, buses coloured by occupancy
- [x] Queue manager **column view** for digital tokens (one column per afternoon departure)
- [x] Fleet panel: speed, pax / capacity, GPS sats, stale/offline indicator  *(implied)*
- [x] SOS alert banner fed by `sos_active` in telemetry  *(implied — SOS must surface somewhere)*
- [ ] Auth / role gate (dispatcher only)  *(implied, needs Siddhant's auth decision)*

### 2.2 Student App (explicit, §5.1)
- [ ] Live tracking of own route's bus with **ETA** to the student's stop
- [ ] **"JOIN QUEUE"** button for afternoon departures → shows queue position live
- [ ] **Fallback Alert modal** — shown when last bus on default route has departed; displays the
      route/stop returned by `find_fallback_route` (§2.2)
- [ ] Receive FCM push for "last bus departed" (§6)  *(implied)*

### 2.3 Driver App (explicit, §5.1)
- [ ] Zero-touch interface (auto trip start via geofence, no forms)
- [ ] Giant **SOS** button (with hold-to-confirm to prevent accidental presses — *design decision*)
- [ ] Background geofence tracking (Expo Location + TaskManager)

### 2.4 Cross-cutting (explicit, §6)
- [x] **Smooth marker interpolation** — no teleporting when the ESP32 bulk-publishes queued telemetry
      after a GSM outage. Implemented in `packages/shared/src/motion.ts` (+ tests).

## 3. Dependencies on teammates
| Need | From | Status |
|---|---|---|
| Socket.io event names + payload shapes | Siddhant | **Proposed** in `docs/CONTRACT.md` — needs agreement |
| REST endpoints (routes, stops, buses, trips, tokens) | Siddhant | Proposed |
| Enum values (`role`, `bus.status`, `token.status`) | Siddhant | PDF lists them as enums without values — assumed |
| Fallback route API (`find_fallback_route`) response shape | Siddhant | Proposed |
| Fused pax count (IR + CV) — which field the UI shows | Vansh / Siddhant | Assumed `current_pax_count` in telemetry is already fused |
| MQTT payload (§3.2) | Rahul | Used verbatim by the mock simulator |

## 4. Milestones
1. **Done:** monorepo, shared types/contract, mock simulator, interpolation engine, Dispatcher Web.
2. Expo app (single app, role-based: student / driver) using the same shared package.
3. Swap mock → live data source once Siddhant's Socket.io server is up (`NEXT_PUBLIC_DATA_SOURCE=live`).
4. FCM push + background geofencing (needs a dev build, not Expo Go).
5. Usability testing with real students/drivers; measure: time-to-find-bus, queue-join success rate,
   SOS press-to-dispatcher-alert latency.

## 5. Open questions
- Is ETA computed on the backend or the client? (Client-side estimate implemented for now.)
- How many afternoon departures share a queue — per trip or per route?
- Who can cancel/expire a token — dispatcher only, or automatic timeout?
