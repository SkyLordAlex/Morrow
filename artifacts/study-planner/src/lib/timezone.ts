import { useEffect, useState } from 'react';
import { setTimeZone } from '@workspace/api-client-react';

// The API is told which calendar day the user is in via an `x-time-zone`
// header. By default that's the device's own zone; this lets the user pin a
// different one. A per-device preference in localStorage, like the theme.

const KEY = 'morrow.timeZone';
const EVENT = 'morrow:timezone';

export function detectedTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The user's pinned zone, or null when following the device. */
export function storedTimeZone(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

/** Push the current choice into the API client. Safe to call repeatedly. */
export function applyTimeZone(): void {
  setTimeZone(storedTimeZone());
}

export function setStoredTimeZone(zone: string | null): void {
  try {
    if (zone) localStorage.setItem(KEY, zone);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  applyTimeZone();
  window.dispatchEvent(new Event(EVENT));
}

const FALLBACK_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Halifax',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Athens',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

export function allTimeZones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (supported && supported.length > 0) return supported;
  } catch {
    /* fall through */
  }
  const set = new Set([detectedTimeZone(), ...FALLBACK_ZONES]);
  return [...set].sort();
}

export function useTimeZone(): [string | null, (zone: string | null) => void] {
  const [value, setValue] = useState<string | null>(storedTimeZone);
  useEffect(() => {
    const sync = () => setValue(storedTimeZone());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return [value, setStoredTimeZone];
}
