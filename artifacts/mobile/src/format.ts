// Formatting helpers lifted from artifacts/study-planner/src/pages/dashboard.tsx
// so the mobile client renders identical copy to the web client.

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function clockLabel(time: string): string {
  const [hourValue, minute = '00'] = time.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

// The OpenAPI generator types date-format fields as `Date`, but they arrive
// over the wire as `YYYY-MM-DD` strings. Everything downstream wants the
// string form, so normalise once here rather than in every component.
export function dateKey(value: Date | string): string {
  return typeof value === 'string' ? value : String(value);
}

export function formatDate(value: Date | string): string {
  const key = dateKey(value);
  if (!key) return 'Choose a day';
  const parsed = new Date(`${key}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? key
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function addDaysKey(value: Date | string, days: number): string {
  const parsed = new Date(`${dateKey(value)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey(value);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}
