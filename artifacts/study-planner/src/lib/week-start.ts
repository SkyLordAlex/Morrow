import { useEffect, useState } from 'react';

// Which day the calendar grid begins on. 0 = Sunday, 1 = Monday. A per-device
// display preference (like the theme) — kept in localStorage, not on the server.

const KEY = 'morrow.weekStartsOn';
const EVENT = 'morrow:weekstart';

export type WeekStart = 0 | 1;

export function getWeekStart(): WeekStart {
  try {
    return localStorage.getItem(KEY) === '1' ? 1 : 0;
  } catch {
    return 0;
  }
}

export function setWeekStart(value: WeekStart): void {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useWeekStart(): [WeekStart, (value: WeekStart) => void] {
  const [value, setValue] = useState<WeekStart>(getWeekStart);

  useEffect(() => {
    const sync = () => setValue(getWeekStart());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return [value, setWeekStart];
}
