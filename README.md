# Fairway

Fairway is a private, account-based golf scorecard and progress tracker. Confirmed users share one ecosystem login while keeping golf records private from every other account.

## Features

- Short first-use guide and clean-slate course library
- Golf-specific 18-hole scorecard with keyboard and touch controls, live progress, review, and front/back totals
- Course and tee profiles with par, Course Rating, and Slope Rating
- Score differentials calculated as `(113 / Slope Rating) × (Adjusted Gross Score - Course Rating - PCC)`
- Estimated Handicap Index using the World Handicap System fewer-than-20-round selection table and the best 8 of the latest 20 once enough rounds are available
- Average score, recent form, personal best, and a score trend
- Player and course filters
- Five independent themes and responsive layouts for desktop, tablet, and phone

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

Rounds and custom courses are saved in Supabase tables protected by Row Level Security. New accounts start empty. The legacy `fairway-log-v2` browser record is read only as an optional one-time migration source; interface and onboarding preferences may remain on the device.

The displayed Handicap Index is an estimate for personal tracking, not an official GHIN Handicap Index. The app supports Course Rating, Slope Rating, and manual PCC entry, but does not currently apply hole-by-hole Net Double Bogey adjustments, exceptional score reductions, or handicap caps.

## Deployment

The project has no build step and can be published directly with GitHub Pages from the repository's default branch.
