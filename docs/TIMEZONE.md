# Device-relative dates and times

Dates are now resolved in the user's own time zone instead of the server's.

## The bug

Two lines in the old `planner.ts` disagreed with each other:

```ts
function dateKey(date)   { return date.toISOString().slice(0, 10); }  // UTC
function startOfDay(d)   { r.setHours(0, 0, 0, 0); return r; }        // server-local
```

`startOfDay()` gives midnight in the server's zone; `toISOString()` then
converts to UTC. Those agree only when the server runs in UTC *and* the user
lives there. Replit runs in UTC and you're in New Jersey, so:

| Moment | Old code called it | Actually was |
| --- | --- | --- |
| Tue 9:30pm ET | Wednesday Sep 2 | Tuesday Sep 1 |
| Tue 11:59pm ET | Wednesday Sep 2 | Tuesday Sep 1 |
| Wed 2:00pm ET | Wednesday Sep 2 | Wednesday Sep 2 |

Every evening after 8pm ET (7pm during winter), the app rolled over to
tomorrow. A student's Today list emptied out, `todayFocus` went null, the
"Today" bar on the workload chart moved to the wrong column, and any plan
created in the evening got scheduled starting a day late.

Also fixed: `greeting` was the hardcoded string `"Good afternoon"` at every
hour of the day. It's now derived from the user's local hour.

## The approach

A day is a `YYYY-MM-DD` string, not a moment in time. Deciding *which* day it
is right now requires the user's zone; everything after that is string math
anchored at UTC midnight, which has no offset to drift.

That's what `src/lib/zoned-time.ts` provides. `zonedDateKey(tz)` answers "what
day is it for this user"; `addDaysKey`, `weekdayOfKey`, `daysBetweenKeys`, and
`formatDateKey` do pure calendar math on the result. No `Date` object survives
past the boundary, so there's nothing left to pick up the server's offset.

One consequence worth noting: the scheduler loop got simpler, not more complex.
`YYYY-MM-DD` sorts lexicographically, so comparing date keys as strings is
correct, and the day-by-day walk no longer needs `Date` objects at all.

## Files

| File | Change |
| --- | --- |
| `artifacts/api-server/src/lib/zoned-time.ts` | New. Zone resolution and calendar-date helpers. |
| `artifacts/api-server/src/routes/planner.ts` | Modified. Reads the caller's zone; all date logic now key-based. |
| `lib/api-client-react/src/custom-fetch.ts` | Modified. Sends the device zone on every request. |

Copy over the same paths. No dependencies, no migration, no API contract
change — the response shape is identical, so the OpenAPI spec and generated
client don't need regenerating.

## How the zone travels

The client reads `Intl.DateTimeFormat().resolvedOptions().timeZone` and sends
it as an `X-Time-Zone` header. That's added in `custom-fetch.ts`, the same
choke point that already handles the base URL and auth token, so **web and
mobile both get it from this one change** — no per-call plumbing.

The server validates the header with `resolveTimeZone()` and falls back to UTC
on anything unrecognised. A garbage header can't 500 the dashboard.

`setTimeZone()` is exported if you ever need to override detection (useful for
tests, or if you later let users pick a zone in settings).

## Testing it

The honest test is to change your machine's clock and zone, since that's what
the client reads. Set your Mac or PC to a zone well east or west of yours,
reload, and check that the date line and the Today list agree with the
device clock.

For the server side alone:

```bash
# pretend to be in Tokyo
curl -s localhost:5000/api/planner/dashboard -H 'x-time-zone: Asia/Tokyo' | jq '.dateLabel, .greeting'

# and in Los Angeles
curl -s localhost:5000/api/planner/dashboard -H 'x-time-zone: America/Los_Angeles' | jq '.dateLabel, .greeting'

# garbage should not error — falls back to UTC
curl -s localhost:5000/api/planner/dashboard -H 'x-time-zone: Mars/Olympus' | jq '.dateLabel'
```

Run those in the evening ET and Tokyo should be a day ahead. That's the whole
bug, visible in one command.

Worth testing around DST too — the anchor-at-UTC-midnight approach is chosen
specifically so a 23-hour or 25-hour day doesn't shift a date key, but it's
worth confirming with `America/New_York` on the March and November change dates.

## Existing data

Rows already in your database were written with the old logic, so some may sit
on a date that was one day off from what the student meant. Nothing here
rewrites them. Given that it's seed and test data, wiping the three planner
tables and letting `ensureSeedData()` refill them is simpler than a migration.
