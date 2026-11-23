# Christmas Dinner Sign-Up

A festive sign-up page for our Christmas dinner. Guests pick the date that works
(Sunday, Dec 13 or Sunday, Dec 27), suggest restaurants, and rank the approved
restaurants in a ranked-choice poll. No accounts needed.

- `index.html`: the page, served by GitHub Pages.
- `apps-script.gs`: a small Google Apps Script that saves answers to a Google Sheet.

## Connect the Google Sheet (one time, about 5 minutes)

1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**, delete what's there, paste in all of
   `apps-script.gs`, and save.
3. Click **Deploy → New deployment**, choose type **Web app**, and set
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy** and authorize it.
4. Copy the **Web app URL** (it ends in `/exec`).
5. In this repo, edit `index.html`, find
   `var SCRIPT_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';`
   near the bottom, paste your URL between the quotes, and commit.

The page picks it up within a minute or two.

## Managing responses

Answers appear in the sheet's **Responses** tab. To remove someone, delete their
row. If you change the script later, use **Deploy → Manage deployments → Edit →
New version** so the URL stays the same.

## Restaurant poll (ranked choice)

- The script creates a **Poll Options** tab. Type each approved restaurant in
  column A, one per row, under the header (up to 15). The page shows exactly
  these; while the tab is empty, voting stays hidden.
- Each voter ranks as many options as they like. Rankings land in the **Votes**
  tab; delete a row to remove a vote.
- The page counts the votes live with instant runoff: each round, every ballot
  counts for its highest choice still in the race. An option with more than half
  of those votes wins; otherwise the last-place option is dropped (options tied
  for last are dropped together) and the count repeats.
- Renaming an option in **Poll Options** drops it from existing ballots, so
  settle the names before sharing the poll.
