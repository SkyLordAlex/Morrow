import React, { useState } from "react";

// Morrow — interactive preview.
//
// The dashboard is rendered with the same date logic that lives in
// artifacts/api-server/src/lib/zoned-time.ts, so dates and the greeting
// resolve in the selected zone exactly as they will in the real app.
//
// No API calls: the session data is fixed sample data on known calendar dates.

// --- Theme, ported from artifacts/study-planner/src/index.css ---------------
const C = {
  bg: "#EAF5F2",
  fg: "#1F2B3D",
  border: "#CEDED9",
  card: "#F5FAF9",
  cardBorder: "#D4E3DE",
  primary: "#2B6960",
  primaryFg: "#FFFCF0",
  secondary: "#F9C058",
  muted: "#DDE9E6",
  mutedFg: "#637E77",
  accent: "#EC8169",
};

const SANS = "'Manrope', ui-sans-serif, system-ui, sans-serif";
const SERIF = "'Newsreader', Georgia, serif";
const MONO = "'DM Mono', ui-monospace, monospace";

// --- The real logic, ported verbatim from zoned-time.ts ---------------------

function zonedDateKey(timeZone, at) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function zonedHour(timeZone, at) {
  return (
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hour12: false,
      }).format(at),
    ) % 24
  );
}

function toUtcAnchor(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysKey(key, days) {
  const a = toUtcAnchor(key);
  a.setUTCDate(a.getUTCDate() + days);
  return a.toISOString().slice(0, 10);
}

function daysBetweenKeys(from, to) {
  return Math.round(
    (toUtcAnchor(to).getTime() - toUtcAnchor(from).getTime()) / 86400000,
  );
}

function formatDateKey(key, options) {
  return toUtcAnchor(key).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

function formatDueLabel(dueDate, todayKey) {
  const days = daysBetweenKeys(todayKey, dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 0) return "Overdue";
  if (days < 7) return `Due ${formatDateKey(dueDate, { weekday: "long" })}`;
  return `Due ${formatDateKey(dueDate, { month: "short", day: "numeric" })}`;
}

function greetingFor(timeZone, at) {
  const h = zonedHour(timeZone, at);
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function clockLabel(time) {
  const [h, m = "00"] = time.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function minutesLabel(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

// --- Sample data on fixed calendar dates -----------------------------------
const ANCHOR = "2026-09-01";

const SESSIONS = [
  { id: 1, date: ANCHOR, startTime: "09:00", title: "Review class notes", subject: "Biology", durationMinutes: 35, status: "complete" },
  { id: 2, date: ANCHOR, startTime: "16:30", title: "Gather evidence", subject: "History", durationMinutes: 40, status: "scheduled" },
  { id: 3, date: ANCHOR, startTime: "19:00", title: "Practice recall questions", subject: "Biology", durationMinutes: 35, status: "scheduled" },
  { id: 4, date: addDaysKey(ANCHOR, 1), startTime: "16:00", title: "Write an outline", subject: "History", durationMinutes: 25, status: "scheduled" },
  { id: 5, date: addDaysKey(ANCHOR, 1), startTime: "16:50", title: "Complete the first half", subject: "Math", durationMinutes: 25, status: "scheduled" },
  { id: 6, date: addDaysKey(ANCHOR, 2), startTime: "16:00", title: "Make a one-page study guide", subject: "Biology", durationMinutes: 30, status: "scheduled" },
  { id: 7, date: addDaysKey(ANCHOR, 3), startTime: "16:00", title: "Draft the argument", subject: "History", durationMinutes: 45, status: "scheduled" },
  { id: 8, date: addDaysKey(ANCHOR, 4), startTime: "16:00", title: "Do a timed review", subject: "Biology", durationMinutes: 20, status: "scheduled" },
];

const ASSIGNMENTS = [
  { id: 1, title: "Biology test", subject: "Biology", dueDate: addDaysKey(ANCHOR, 3), totalMinutes: 120, completedMinutes: 35, accent: "#EC8169" },
  { id: 2, title: "Math homework", subject: "Math", dueDate: addDaysKey(ANCHOR, 1), totalMinutes: 80, completedMinutes: 0, accent: "#347A8D" },
  { id: 3, title: "History project", subject: "History", dueDate: addDaysKey(ANCHOR, 7), totalMinutes: 180, completedMinutes: 0, accent: "#75617E" },
];

const ZONES = [
  { id: "America/New_York", label: "New York" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Europe/London", label: "London" },
  { id: "UTC", label: "UTC" },
];

export default function MorrowPreview() {
  const [zone, setZone] = useState("America/New_York");

  // Held in state so every render agrees on one moment.
  const [now] = useState(() => new Date());

  const todayKey = zonedDateKey(zone, now);

  const localTime = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  const todaySessions = SESSIONS.filter(
    (s) => s.date === todayKey && s.status !== "complete",
  );
  const focus = todaySessions[0] ?? null;

  const workload = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(todayKey, i);
    const day = SESSIONS.filter(
      (s) => s.date === date && s.status !== "complete",
    );
    return {
      date,
      dayLabel: i === 0 ? "Today" : formatDateKey(date, { weekday: "short" }),
      minutes: day.reduce((sum, s) => sum + s.durationMinutes, 0),
      isToday: i === 0,
    };
  });

  const maxMinutes = Math.max(...workload.map((d) => d.minutes), 1);
  const upcoming = ASSIGNMENTS.filter((a) => a.dueDate >= todayKey);

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: 20, fontFamily: SANS }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Newsreader:wght@500;600&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Demo controls — deliberately plain, so they read as scaffolding */}
      <div
        style={{
          background: "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 18,
          fontSize: 13,
          color: C.fg,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.mutedFg }}>Time zone</span>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: SANS }}
            >
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </label>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.mutedFg }}>{localTime}</span>
        </div>
      </div>

      {/* The app */}
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.8, color: C.primary }}>
          {formatDateKey(todayKey, { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.05, marginTop: 6, color: C.fg }}>
          {greetingFor(zone, now)}.
        </div>

        {/* Focus card */}
        <div
          style={{
            marginTop: 20,
            background: C.primary,
            borderRadius: 22,
            padding: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute", right: -40, top: -56, width: 170, height: 170,
              borderRadius: "50%", border: "22px solid rgba(249,192,88,0.15)",
            }}
          />
          <div style={{ position: "relative" }}>
            {focus ? (
              <>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: "rgba(255,252,240,0.6)" }}>
                  YOUR NEXT STEP
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 30, color: C.primaryFg, marginTop: 12 }}>
                  {focus.title}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12, color: "rgba(255,252,240,0.72)" }}>
                  <span>{clockLabel(focus.startTime)}</span>
                  <span>{minutesLabel(focus.durationMinutes)}</span>
                  <span
                    style={{
                      background: "rgba(255,252,240,0.12)", borderRadius: 999,
                      padding: "2px 9px", fontWeight: 700,
                    }}
                  >
                    {focus.subject}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: "rgba(255,252,240,0.6)" }}>
                  TODAY&apos;S FOCUS
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 30, color: C.primaryFg, marginTop: 12 }}>
                  You have room to breathe.
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10, color: "rgba(255,252,240,0.68)" }}>
                  Nothing is scheduled here yet.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sessions */}
        <div style={{ marginTop: 24, fontFamily: MONO, fontSize: 10, letterSpacing: 1.6, color: C.mutedFg }}>
          ON THE DESK TODAY
        </div>
        <div
          style={{
            marginTop: 8, background: C.card, border: `1px solid ${C.cardBorder}`,
            borderRadius: 18, padding: "0 18px",
          }}
        >
          {todaySessions.length ? (
            todaySessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 0",
                  borderBottom: i < todaySessions.length - 1 ? `1px solid rgba(206,222,217,0.7)` : "none",
                }}
              >
                <span style={{ width: 24, height: 24, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.fg }}>{s.title}</span>
                  <span style={{ display: "block", fontSize: 11, color: C.mutedFg, marginTop: 2 }}>
                    {s.subject} · {minutesLabel(s.durationMinutes)}
                  </span>
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.mutedFg }}>{clockLabel(s.startTime)}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: "36px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>A clear day is a good day.</div>
              <div style={{ fontSize: 12, color: C.mutedFg, marginTop: 4 }}>
                Make a plan to turn a deadline into a next action.
              </div>
            </div>
          )}
        </div>

        {/* Workload */}
        <div
          style={{
            marginTop: 20, background: C.card, border: `1px solid ${C.cardBorder}`,
            borderRadius: 18, padding: 20,
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: 21, color: C.fg }}>Your rhythm</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 18 }}>
            {workload.map((d) => (
              <div key={d.date} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.mutedFg, marginBottom: 6 }}>
                  {d.minutes ? minutesLabel(d.minutes) : "—"}
                </div>
                <div style={{ height: 70, background: "rgba(221,233,230,0.7)", borderRadius: 7, display: "flex", alignItems: "flex-end" }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(9, (d.minutes / maxMinutes) * 100)}%`,
                      background: d.isToday ? C.secondary : "rgba(43,105,96,0.25)",
                      borderRadius: 7,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 6, color: d.isToday ? C.primary : C.mutedFg }}>
                  {d.dayLabel}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assignments */}
        <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: "0 18px" }}>
          {upcoming.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 0",
                borderBottom: i < upcoming.length - 1 ? `1px solid rgba(206,222,217,0.7)` : "none",
              }}
            >
              <span style={{ width: 4, height: 34, borderRadius: 2, background: a.accent, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.fg }}>{a.title}</span>
                <div style={{ height: 6, background: C.muted, borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.round((a.completedMinutes / a.totalMinutes) * 100)}%`,
                      background: a.accent,
                    }}
                  />
                </div>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.fg, whiteSpace: "nowrap" }}>
                {formatDueLabel(a.dueDate, todayKey)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
