# TransitLink — Frontend (Vidhu)

Frontend for the AI-driven college bus fleet system described in *TransitLink Architecture Blueprint.pdf*.

```
packages/shared        Types, data-source interface, mock simulator, interpolation, ETA, queue logic (+ tests)
apps/dispatcher-web    Next.js 14 dispatcher dashboard: live map + queue manager
apps/mobile            (next) Expo app — Student + Driver roles
docs/VIDHU_TASKS.md    Task breakdown extracted from the blueprint
docs/CONTRACT.md       Proposed API/socket contract for the backend
```

## Run
```bash
npm install
npm run dev:web      # http://localhost:3000 — runs on mock data, no backend needed
npm test             # shared logic tests
npm run build:web
```

Copy `apps/dispatcher-web/.env.example` to `.env.local` to switch to the live backend
(`NEXT_PUBLIC_DATA_SOURCE=live`).

## Design decisions
- **One `TransitDataSource` interface** (`packages/shared/src/source.ts`). The mock simulator emits Rahul's
  exact MQTT payload format; the live source talks Socket.io/REST. UI code never knows which one is active.
- **Zustand for telemetry, React Query for server records.** Telemetry is a high-frequency stream; tokens and
  routes are cacheable records with mutations (optimistic updates on dispatcher actions).
- **Animation outside React.** `MarkerMotion` interpolates each bus; the map's GeoJSON source is updated per
  frame directly, so React doesn't re-render 60×/s.
- **Network partition (§6):** the mock drops B-404 offline for 20 s every 90 s, then sends a
  `telemetry:batch`. The marker greys out ("No signal") and then replays the missed path in ≤ 3 s instead of teleporting.
- **MapLibre via react-map-gl** with OpenFreeMap tiles — no API key or billing needed. Any MapLibre style URL works.

## Known limitations
- Mock route polylines are straight lines between approximate Dehradun points, not road-snapped.
- ETA is a naive distance/speed estimate — a baseline to compare against a historical model later.
- No auth yet; the live source is written but untested until the backend exists.
