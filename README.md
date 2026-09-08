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
since each person is on a different phone).

### Option A: Render.com (easiest, but sleeps on the free tier)

1. Create an account at [render.com](https://render.com) and connect this
   GitHub repository.
2. "New Web Service" → select the `coffee-date` repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add a **persistent disk** (Render → "Disks") mounted at
   `/opt/render/project/src/data` so photos and votes survive redeploys.
5. Once deployed, you'll get a URL like
   `https://coffee-date-xxxx.onrender.com`.

The **Free** instance type spins down after 15 minutes of inactivity
(~30s cold start on the next open). The **Starter** plan (~$7/month)
removes that — same setup, just pick the paid instance type.

### Option B: Railway / Fly.io

Both support the Dockerfile in this repo directly, plus a persistent disk
for the `data/` folder. Push the repo and mount a volume at `/app/data`.
Fly.io's smallest always-on machine runs a few dollars a month.

### Option C: Docker on your own server / VPS / Raspberry Pi

```bash
docker build -t coffee-date .
docker run -d -p 3000:3000 -v coffee-date-data:/app/data coffee-date
```

Put a proxy (Caddy, nginx, Cloudflare Tunnel...) in front to serve HTTPS on
your domain or subdomain — HTTPS is required for the PWA (and the phone
camera) to work properly.

### Option D: Google Cloud "Always Free" VM (free forever, always on)

Google Cloud's free tier includes one `e2-micro` VM that runs 24/7 at no
cost (in `us-west1`, `us-central1`, or `us-east1`). It needs a credit card
to verify the account but won't charge you within the free tier. This is
a real server you manage yourself, not a "connect GitHub and go" platform,
but it never sleeps and never expires.

1. **Create the VM** — [console.cloud.google.com](https://console.cloud.google.com)
   → Compute Engine → VM instances → Create Instance.
   - Region: `us-central1` (must be one of the 3 free-tier regions above)
   - Machine type: `e2-micro`
   - Boot disk: Ubuntu 22.04 LTS, 30 GB standard persistent disk (the free
     tier's max)
   - Under Firewall, check **Allow HTTP traffic** and **Allow HTTPS
     traffic**
   - Create it, then note its external IP (shown in the VM list, e.g.
     `34.123.45.67`)

2. **SSH in** using the "SSH" button next to the instance in the console
   (opens a terminal in your browser, nothing to install locally).

3. **Install Node.js and git:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git
   ```

4. **Clone and run the app** (until this branch is merged, check it out
   explicitly):
   ```bash
   git clone https://github.com/alopezlamata-glitch/coffee-date.git
   cd coffee-date
   git checkout claude/coffee-date-repo-cp3d5u
   npm install
   sudo npm install -g pm2
   pm2 start server.js --name coffee-date
   pm2 save
   pm2 startup   # then run the command it prints, so it survives reboots
   ```

5. **Get free HTTPS without owning a domain**, using
   [sslip.io](https://sslip.io) (a free DNS service that resolves
   `<your-ip-with-dashes>.sslip.io` to your VM's IP) plus
   [Caddy](https://caddyserver.com) for an automatic trusted certificate:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```
   Replace `34-123-45-67` below with your own VM's IP, dashes instead of
   dots:
   ```bash
   echo '34-123-45-67.sslip.io {
     reverse_proxy localhost:3000
   }' | sudo tee /etc/caddy/Caddyfile
   sudo systemctl restart caddy
   ```
   Your app is now live at `https://34-123-45-67.sslip.io` with a real,
   trusted certificate — no domain purchase needed. (Already have a
   domain on Cloudflare? A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
   works too, and skips opening any firewall ports at all.)

6. **To update the app later:**
   ```bash
   cd ~/coffee-date && git pull && pm2 restart coffee-date
   ```

Data lives in `~/coffee-date/data` on the VM's own disk, so it survives
reboots with no extra setup.

### Option E: Oracle Cloud "Always Free" VM (free forever, always on)

Same idea as Option D, on Oracle Cloud instead. Also needs a credit card
to verify the account, no charge within the free tier. Two things are
different enough from Google Cloud to trip people up, called out below.

1. **Create the instance** — [cloud.oracle.com](https://cloud.oracle.com)
   → ☰ menu → Compute → Instances → Create Instance.
   - Name: `coffee-date`
   - Image and shape → Edit → Image: **Canonical Ubuntu 22.04**; Shape:
     Change shape → select **VM.Standard.E2.1.Micro** (it's labeled
     "Always Free eligible" — this is a *separate* free allowance from
     the ARM `A1.Flex` shape, so it doesn't compete with another app
     already using your ARM quota)
   - Networking: keep the default VCN/subnet, and make sure **"Assign a
     public IPv4 address"** is set to Yes
   - Add SSH keys: choose **"Generate a key pair for me"** and download
     the private key file right away — it's only offered once
   - Create it, then note its public IP (e.g. `123.45.67.89`)

2. **Open the firewall — two layers, both need a rule for 80/443:**
   - In the console: Networking → Virtual Cloud Networks → your VCN →
     Security Lists → Default Security List → Add Ingress Rules, twice:
     Source CIDR `0.0.0.0/0`, TCP, destination port `80`, and the same
     for port `443`.
   - On the VM itself: Oracle's Ubuntu image also ships with `iptables`
     rules that block everything but SSH by default (a common gotcha —
     the console-level rule above isn't enough on its own). After SSH'ing
     in (step 3), run:
     ```bash
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```

3. **SSH in** using the key file you downloaded:
   ```bash
   chmod 600 ~/Downloads/ssh-key-*.key
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@123.45.67.89
   ```

4. **From here it's identical to the Google Cloud steps** — install
   Node.js + git, clone the repo, run it with `pm2`, and set up Caddy +
   sslip.io for free HTTPS (steps 3-6 in Option D above).

**On the "reclaimed for inactivity" risk:** Oracle's Always Free tier
can reclaim an instance it judges idle (very low CPU/network/memory for
~7 days straight). Two people using the app daily should keep it active
enough on its own; if you expect a long stretch of no one opening it, a
simple cron heartbeat avoids any doubt:
```bash
(crontab -l 2>/dev/null; echo "*/10 * * * * curl -s -o /dev/null http://localhost:3000/") | crontab -
```

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
