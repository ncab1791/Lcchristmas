# Christmas Dinner Sign-Up

A festive sign-up page for our Christmas dinner. Guests pick the date that works
(Sunday, Dec 13 or Sunday, Dec 27) and suggest restaurants. No accounts needed.

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
