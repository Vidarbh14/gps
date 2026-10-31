// LOCAL DEVELOPMENT ONLY — runs the real server against an in-memory Postgres (PGlite) with the real
// migrations, imports the schedule CSV, and creates three dev accounts. No Supabase or Docker needed.
// Data is lost on exit. Never deploy this entry point.
//
//   npm run dev:local -w @transitlink/tracking-server            (expects ../../data/SafarSaathi_Bus_Schedule.csv)

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestDb, createUser } from '../test/pgliteDb';
import { createTrackingServer } from './app';
import { DevAuthenticator } from './auth';
import { loadConfig } from './config';
import { importSchedule } from './importer';

if (process.env.NODE_ENV === 'production') throw new Error('dev.ts must not run in production');

const USERS = {
  admin: '00000000-0000-4000-8000-00000000a001',
  driver: '00000000-0000-4000-8000-00000000d001',
  student: '00000000-0000-4000-8000-000000005001',
};

const cfg = loadConfig({ ...process.env, DEV_AUTH: '1' });
const { db } = await createTestDb();
for (const [role, id] of Object.entries(USERS)) await createUser(db, id, role);

const csvPath = resolve(process.env.SCHEDULE_CSV ?? '../../data/SafarSaathi_Bus_Schedule.csv');
if (existsSync(csvPath)) {
  const r = await importSchedule(db, readFileSync(csvPath, 'utf8'), { fileName: 'SafarSaathi_Bus_Schedule.csv' });
  console.log(`[dev] imported ${r.buses_upserted} buses, ${r.routes_active} routes, ${r.stops} stops (${r.issues.length} review notes)`);
  const firstBus = (await db.query<{ id: string }>('select id from public.campus_buses order by csv_record limit 1')).rows[0];
  if (firstBus) {
    await db.query('insert into public.campus_driver_assignments (driver_id, bus_id) values ($1, $2)', [USERS.driver, firstBus.id]);
    console.log(`[dev] dev driver assigned to ${firstBus.id}`);
  }
} else {
  console.warn(`[dev] ${csvPath} not found — starting with an empty schedule`);
}

const server = await createTrackingServer(db, new DevAuthenticator(db), cfg);
setInterval(() => void server.tracker.sweep(), 1000);
server.seats.start();
server.http.listen(cfg.port, () => {
  console.log(`[dev] tracking server on http://localhost:${cfg.port} (in-memory database)`);
  for (const [role, id] of Object.entries(USERS)) console.log(`[dev]   ${role.padEnd(7)} token: dev:${id}`);
});
