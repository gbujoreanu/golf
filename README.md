# Fairway Log

Fairway Log is a lightweight, account-based golf score and handicap tracker. Confirmed users share one Supabase login with Daymark while keeping their records private from every other account.

## Features

- Guided 18-hole score entry with front-nine, back-nine, total, and score-to-par summaries
- Course and tee profiles with par, Course Rating, and Slope Rating
- Score differentials calculated as `(113 / Slope Rating) × (Adjusted Gross Score - Course Rating - PCC)`
- Estimated Handicap Index using the World Handicap System fewer-than-20-round selection table and the best 8 of the latest 20 once enough rounds are available
- Average score, recent form, personal best, and a score trend
- Player and course filters
- JSON backup and restore
- Responsive layout for phones and desktops

## Run locally

Because the app is static, any local web server will work:

```powershell
npx serve .
```

Then open the local address printed in the terminal.

## Tests

The calculation tests use Node's built-in test runner:

```powershell
npm test
```

## Data and handicap notes

Rounds and custom courses are saved in Supabase tables protected by Row Level Security. The legacy `fairway-log-v2` browser record is read only as an optional one-time migration source. JSON export remains available for personal backups.

The displayed Handicap Index is an estimate for personal tracking, not an official GHIN Handicap Index. The app supports Course Rating, Slope Rating, and manual PCC entry, but does not currently apply hole-by-hole Net Double Bogey adjustments, exceptional score reductions, or handicap caps.

## Deployment

The project has no build step and can be published directly with GitHub Pages from the repository's default branch.
