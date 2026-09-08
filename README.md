# ☕ Coffee Date

A private app for 2 people: every day you both upload photos of the coffees
you drink and vote for the best one. It keeps a calendar with the winning
photo of each day and a running score of who's ahead. No accounts, no app
store: it installs on your phone as a PWA straight from the browser.

## How it works

- On first visit, each device picks who it is ("Person A" / "Person B",
  with whatever names you give them). That choice is stored only on that
  phone (`localStorage`) — no username or password needed.
- Throughout the day, each person uploads photos of their coffees from the
  **Today** tab.
- Each person votes, once a day, for their favorite photo among all the
  ones uploaded (both their own and their partner's). Votes stay hidden
  until both people have voted, so nobody is influenced.
- Once both have voted, the day's winning photo (or a tie) is revealed and
  a point is added to the score.
- The **Calendar** tab shows the winning photo for each day of the month.
- The **Score** tab shows the running total and lets you change both
  people's names.

Anyone who opens the URL sees the same data — there's no access control
beyond the URL not being public, so don't share it around.

## Local development

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Data (photos and votes) is stored in `data/db.json` and `data/uploads/`,
which are not committed to the repository.

## Deploying so both phones can use it

You need the server reachable over the internet (`localhost` won't work,
since each person is on a different phone). The simplest, free way:

### Option A: Render.com (recommended)

1. Create an account at [render.com](https://render.com) and connect this
   GitHub repository.
2. "New Web Service" → select the `coffee-date` repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add a **persistent disk** (Render → "Disks") mounted at
   `/opt/render/project/src/data` so photos and votes survive redeploys.
5. Once deployed, you'll get a URL like
   `https://coffee-date-xxxx.onrender.com`.

### Option B: Railway / Fly.io

Both support the Dockerfile in this repo directly, plus a persistent disk
for the `data/` folder. Push the repo and mount a volume at `/app/data`.

### Option C: Docker on your own server / VPS / Raspberry Pi

```bash
docker build -t coffee-date .
docker run -d -p 3000:3000 -v coffee-date-data:/app/data coffee-date
```

Put a proxy (Caddy, nginx, Cloudflare Tunnel...) in front to serve HTTPS on
your domain or subdomain — HTTPS is required for the PWA (and the phone
camera) to work properly.

## Installing on your phone (no app store)

Once the app is deployed at an HTTPS URL:

- **Android (Chrome)**: open the URL → menu (⋮) → "Add to Home screen" /
  "Install app".
- **iPhone (Safari)**: open the URL → share button (□↑) → "Add to Home
  Screen".

It sits on the phone like any other app icon, full screen, no browser
chrome.

## Project structure

```
server.js                 Express server + API routes
lib/store.js               data logic (photos, votes, calendar, score)
assets/logo-source.png     original logo artwork (icon + wordmark)
public/                    frontend (vanilla HTML/CSS/JS) + PWA manifest + service worker
public/icons/                PWA icons generated from the logo
data/                       (not versioned) uploaded photos and JSON database
```
