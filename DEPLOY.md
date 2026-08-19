# Deploying B'JAY CLOSET to Render

This app is a Node.js/Express server, not a static site — it needs a real Node
host (not GitHub Pages/Netlify/Vercel static hosting). Render's free tier
works well for getting it live quickly.

**Free tier tradeoff:** Render's free web services don't include a persistent
disk. That means any products you add/edit or images you upload through the
admin panel will be reset back to the code's seed content whenever the
service restarts or you redeploy (Render free instances also spin down after
~15 minutes of inactivity and take 30-60s to wake back up on the next visit).
This is fine for getting the storefront live and testing the admin panel —
just don't rely on it for real day-to-day catalog changes yet. See
**Upgrading to persistent storage** below for when you're ready to fix that.

## 1. Push this code to GitHub

You'll need a GitHub account (free) and a new empty repository — create both
yourself at github.com, since I can't create accounts or repos on your
behalf. Once you have an empty repo, copy its URL (looks like
`https://github.com/your-username/bjay-closet.git`) and run:

```bash
git remote add origin https://github.com/your-username/bjay-closet.git
git branch -M main
git commit -m "Initial commit"
git push -u origin main
```

(If you already ran `git commit`, skip that line and just push.)

## 2. Create a Render account

Go to [render.com](https://render.com) and sign up (you can sign up with your
GitHub account, which also makes step 3 easier).

## 3. Deploy using the included Blueprint

This project includes a `render.yaml` file that pre-configures everything.

1. In the Render dashboard, click **New +** → **Blueprint**.
2. Connect your GitHub account if prompted, then select your `bjay-closet` repo.
3. Render will detect `render.yaml` and show the `bjay-closet` web service.
4. It will ask you to fill in two values it can't generate itself:
   - **ADMIN_USERNAME** — the username you'll use to log into `/admin/login`.
   - **ADMIN_PASSWORD** — at least 8 characters. This becomes your admin password on first boot.
   - (`SESSION_SECRET` is generated automatically by Render — you don't need to set it.)
5. Click **Apply** / **Create**. Render will build and deploy the service.

Once deployed, Render gives you a URL like `https://bjay-closet.onrender.com`.

## 4. Log in

Visit `https://your-app.onrender.com/admin/login` and log in with the
`ADMIN_USERNAME`/`ADMIN_PASSWORD` you set in step 3. The account is created
automatically the first time the server boots with those variables set.

## 5. (Optional) Custom domain

In the Render dashboard, open your service → **Settings** → **Custom
Domains**, and follow Render's instructions to point your own domain (e.g.
`bjaycloset.com`) at it via a CNAME record with your domain registrar.

## Deploying without the Blueprint (manual setup)

If you'd rather configure the service by hand instead of using
`render.yaml`:

- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:**
  - `NODE_ENV=production`
  - `SESSION_SECRET` — a long random string. Generate one locally with:
    ```bash
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
    ```
  - `ADMIN_USERNAME` — your admin login username
  - `ADMIN_PASSWORD` — at least 8 characters

## Upgrading to persistent storage (when you're ready)

To stop losing admin edits/uploads on restart:

1. On Render, add a **Disk** to the service (Settings → Disks), e.g. 1GB
   mounted at `/var/data`. This costs roughly $0.25/GB/month and requires a
   paid instance type (Starter, ~$7/month) rather than the free tier.
2. Add these environment variables pointing at the mounted disk:
   - `DATA_DIR=/var/data/data`
   - `UPLOADS_DIR=/var/data/uploads`
   - `SERVER_DATA_DIR=/var/data/server-data`
3. Redeploy. On first boot, the server automatically copies its starting
   product/site data from `seed-data/` onto the new disk, and your existing
   admin login (if `server-data/admin.json` doesn't exist yet on the disk)
   will be re-bootstrapped from `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

No code changes are needed for this — the app already reads these paths from
environment variables with the current local-folder behavior as the default.
