import { distanceAlongLine } from './geo';
import type { LngLat } from './types';

export interface EtaResult {
  /** Remaining distance along the route, metres. */
  meters: number;
  /** null when the bus has already passed the stop. */
  seconds: number | null;
  passed: boolean;
}

export interface EtaOptions {
  /** Below this speed the bus is treated as stopped (traffic light, stop dwell). */
  stoppedBelowKmh?: number;
  /** Speed assumed while stopped. Rough city-bus average — tune from real telemetry later. */
  fallbackKmh?: number;
  /** Tolerance before a stop counts as passed (GPS jitter). */
  passedToleranceMeters?: number;
}

/**
 * Client-side ETA estimate: distance along the route polyline divided by current speed.
 * Deliberately simple — a baseline to compare against once historical telemetry exists.
 */
export function estimateEta(
  route: LngLat[],
  bus: LngLat,
  stop: LngLat,
  speedKmh: number,
  opts: EtaOptions = {},
): EtaResult {
  const { stoppedBelowKmh = 5, fallbackKmh = 18, passedToleranceMeters = 40 } = opts;
  const meters = distanceAlongLine(route, stop) - distanceAlongLine(route, bus);
  if (meters < -passedToleranceMeters) return { meters, seconds: null, passed: true };
  const remaining = Math.max(0, meters);
  const kmh = speedKmh < stoppedBelowKmh ? fallbackKmh : speedKmh;
  return { meters: remaining, seconds: remaining / (kmh / 3.6), passed: false };
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) return 'Departed';
  if (seconds < 60) return 'Arriving';
  return `${Math.round(seconds / 60)} min`;
}
