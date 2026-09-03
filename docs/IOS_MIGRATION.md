# Morrow — iOS rewrite

The web app is now a native Expo / React Native app at `artifacts/mobile/`.
Drop that folder into your repo alongside `artifacts/study-planner/` and run
`pnpm install` from the workspace root — `artifacts/*` is already in
`pnpm-workspace.yaml`, so it gets picked up with no config change.

---

## What carried over unchanged

Your backend is untouched. The API server, Drizzle schema, OpenAPI spec, and
the Orval-generated react-query hooks are all reused as-is. The mobile app
imports the same `@workspace/api-client-react` package the web app does, so
`useGetPlannerDashboard`, `useCreateStudyPlan`, `useCompleteStudySession`,
`useRescheduleStudySession`, and `useUpdatePlannerTask` behave identically.

That also means: **regenerate the API client once, and both clients update.**
No duplicated types, no second contract to keep in sync.

Design tokens carried over too — `src/theme.ts` is a direct port of the HSL
values in `index.css`, resolved to hex, plus the same Manrope / Newsreader /
DM Mono type stack via `@expo-google-fonts`.

## What had to change, and why

| Web | iOS | Reason |
| --- | --- | --- |
| Fixed sidebar with anchor-scroll nav | Bottom tab bar (Today / This week / Assignments) | In-page anchor scrolling isn't a native pattern. Tabs also give each section its own scroll position and back stack. |
| `<input type="date">` for reschedule | Bottom sheet with relative options (Tomorrow / +2 / +3 / Next week) | No RN equivalent for the native date input. Relative offsets are also faster on a phone than a wheel picker, and cover the real use case. |
| "Move" button revealed on hover | Always visible, visually quiet | Touch devices have no hover state. |
| Centered modal dialog for plan composer | iOS sheet presentation (`presentation: 'modal'`) with `KeyboardAvoidingView` | Sheet is the platform idiom, and the keyboard would otherwise cover the textarea and submit button. |
| Health-check chip, manual retry button | Pull-to-refresh | Expected native gesture; the chip was desktop chrome. |
| Assignments sliced to 4 | Full list | The slice was a sidebar layout constraint that no longer applies. |
| Tailwind classes | `StyleSheet` + `src/theme.ts` | Kept NativeWind out deliberately — one less build-config failure mode, and RN styles are the thing every RN dev can debug. |

Touch targets are all at 44pt minimum, and every interactive element has an
`accessibilityRole` and label — App Review does spot-check this.

---

## Running it

```bash
# from the workspace root
pnpm install

# point the app at your API
cp artifacts/mobile/.env.example artifacts/mobile/.env
# then edit EXPO_PUBLIC_API_BASE_URL

pnpm --filter @workspace/mobile run dev
```

Press `i` for the iOS simulator (needs Xcode on a Mac), or scan the QR code
with Expo Go on your iPhone. If you're testing on a physical device against a
local API server, `localhost` won't resolve — use your machine's LAN IP.

Two things worth knowing about this setup:

`metro.config.js` is doing real work. pnpm's symlinked store breaks Metro's
default resolution in three separate ways, and the file has comments on each
fix. If you ever hit "Invalid hook call," it's the duplicate-React case that
`extraNodeModules` is guarding against.

Version pinning: I targeted Expo SDK 54, since your catalog pins
`react: 19.1.0` with a comment saying Expo requires it — that's the SDK 54
pairing. If a newer SDK is out, run `pnpm --filter @workspace/mobile exec expo
install --fix` and it will align every Expo-managed dependency for you.

---

## Before you can submit — the honest list

Three of these are genuine blockers, not polish.

### 1. There are no user accounts, and no `user_id` on any table

This is the biggest one. Look at `lib/db/src/schema/planner.ts` — `study_assignments`,
`study_tasks`, and `study_sessions` have no owner column. Every request hits
the same global rows.

On a web app you demo yourself, you don't notice. Shipped to the App Store,
**every user of your app sees and edits the same assignments as every other
user.** That's a data-privacy incident on day one, and Apple will reject it
under Guideline 5.1.2 if a reviewer creates two accounts and sees the same data.

It's also a hard prerequisite for the monetization plan in your
`attached_assets` brief. You wrote there that premium access must come from
verified subscription status rather than a value on the device — correct
instinct, and it's unimplementable without accounts to attach the subscription
to.

The fix: add a `users` table, add `userId` foreign keys to all three planner
tables, add auth (Sign in with Apple is the path of least resistance here —
and it's *required* by Guideline 4.8 if you offer any other third-party
login), and scope every query in `artifacts/api-server/src/routes/planner.ts`
by the authenticated user.

### 2. The "AI" in "AI Study Planner" isn't AI

`parseAssignments()` in `planner.ts` is a keyword-and-regex parser with
hardcoded task templates in `taskBlueprint()`. It's a decent heuristic, but it
splits on commas and matches against a fixed list of ten subjects.

If your App Store listing says "AI," a reviewer who types something the parser
doesn't handle gets nonsense output, and that's Guideline 2.3.1 (accurate
metadata). Two honest ways out: wire the note-parsing endpoint to an actual
model, or market it as a study planner and drop the AI framing. The second is
cheaper and the app is still good.

### 3. Missing assets

`artifacts/mobile/assets/` is empty. You need `icon.png` at 1024×1024 with no
transparency and no rounded corners (Apple applies the mask), and `splash.png`.
`app.json` already references both.

### Also required

- Set a real `ios.bundleIdentifier` in `app.json` — it's currently
  `com.CHANGE-ME.morrow`.
- Privacy policy URL and support URL, both publicly reachable. Required fields.
- Fill out the App Privacy questionnaire in App Store Connect.
- If you add accounts (see #1), you must also ship in-app account deletion —
  Guideline 5.1.1(v), and it's strictly enforced.

## App Store Connect checklist

1. Apple Developer Program membership — $99/yr, and enrollment can take a few days.
2. Create the app record in App Store Connect with your bundle ID.
3. `npm i -g eas-cli`, then `eas login` and `eas init` from `artifacts/mobile/`
   (this fills in `extra.eas.projectId`).
4. `eas build --platform ios --profile production`.
5. `eas submit --platform ios`.
6. Screenshots: 6.7" and 6.5" iPhone sizes minimum.
7. Age rating, category (Education), description, keywords.
8. TestFlight for internal testing before you submit for review.

## If you add subscriptions later

Your brief specified $4.99/mo and $39.99/yr with a 7-day trial. That's fine,
but do #1 first — subscriptions without accounts can't be verified server-side,
and device-stored entitlement is exactly what you said you wanted to avoid.

When you get there: RevenueCat is the pragmatic choice (it handles receipt
validation, restore, and the subscription-status webhook you'd otherwise build
yourself), or `expo-iap` with StoreKit 2 plus the App Store Server API if you
want no third party. Either way, entitlement gets checked on your server and
returned from your API — never read from the client. Product IDs and shared
secrets go in EAS secrets and server env vars, never in `app.json`.

One thing to flag before you build a paywall: the free tier in your brief
(3 plans/month, plus assignments, calendar, and checklist) is close to the
entire current app. The premium features you listed — flashcards, practice
quizzes, personalized daily schedules, advanced progress tracking — don't
exist yet. Worth building at least one of them before putting up a paywall,
or the upgrade screen is selling something you can't deliver.
