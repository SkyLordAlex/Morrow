// A minimal RFC 5545 writer — just enough for a read-only study-session feed.

export type CalendarEvent = {
  uid: string;
  start: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  summary: string;
  description?: string;
  done?: boolean;
};

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to <=75 octets per RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  parts.push(" " + rest);
  return parts.join("\r\n");
}

function toStamp(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-");
  const [hh = "00", mm = "00"] = time.split(":");
  return `${y}${m}${d}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`;
}

export function buildCalendar(
  name: string,
  events: CalendarEvent[],
  now = new Date(),
): string {
  const dtstamp = `${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Morrow//Study Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toStamp(event.start, event.startTime)}`,
      `DTEND:${toStamp(event.start, event.endTime)}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push("STATUS:CONFIRMED", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
