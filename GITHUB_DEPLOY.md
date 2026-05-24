# Maggie App — GitHub Deployment Guide

Complete instructions for hosting the Maggie Performer App on GitHub Pages with PDF storage via GitHub Releases.

---

## Part 1: Set Up Your GitHub Repository

### Step 1: Create a new repo on GitHub
1. Go to [github.com/new](https://github.com/new)
2. Name it **`maggie-app`** (or anything you prefer)
3. Set it to **Public** (required for free GitHub Pages)
4. **Do NOT** initialize with a README — leave it empty
5. Click **Create repository**

---

### Step 2: Get the project files onto your computer

The project lives in this conversation's workspace. You have two options:

#### Option A — Download a ZIP from this conversation
Ask Computer: *"Can you zip the maggie-app project and share it as a download?"*

#### Option B — Copy directly if you have the Perplexity desktop app
The files are at `/home/user/workspace/maggie-app/` in the sandbox.

Once you have the files locally, open a terminal in the `maggie-app` folder.

---

### Step 3: Push the code to GitHub

```bash
# Inside the maggie-app folder:
git init
git add .
git commit -m "Initial commit — Maggie Performer App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maggie-app.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Part 2: Configure GitHub Pages

### Step 4: Update the homepage URL in package.json

Open `package.json` and update line 4:

```json
"homepage": "https://YOUR_USERNAME.github.io/maggie-app",
```

Replace `YOUR_USERNAME` with your actual GitHub username. Save the file.

---

### Step 5: Install dependencies (first time only)

```bash
npm install
```

---

### Step 6: Deploy to GitHub Pages

```bash
npm run deploy
```

This command:
1. Builds the app (`vite build`)
2. Pushes the built files to a `gh-pages` branch in your repo

Wait about 60 seconds after it finishes.

---

### Step 7: Enable GitHub Pages in your repo settings

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Set **Branch** to `gh-pages` / `/ (root)`
4. Click **Save**

Your app will be live at:
```
https://YOUR_USERNAME.github.io/maggie-app
```

---

## Part 3: Set Up PDF Storage (GitHub Releases)

PDF files are stored as GitHub Release Assets — free, unlimited, no extra service needed.

### Step 8: Create a Personal Access Token (PAT)

1. Go to [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Give it a name: **Maggie App PDF Storage**
4. Set expiration: **No expiration** (or 1 year)
5. Under **Repository access**: select **Only select repositories** → choose `maggie-app`
6. Under **Permissions → Contents**: set to **Read and Write**
7. Click **Generate token**
8. **Copy the token immediately** — you won't see it again

---

### Step 9: Configure the app

1. Open your Maggie app at `https://YOUR_USERNAME.github.io/maggie-app`
2. Click **Settings** in the top navigation
3. Paste your PAT into the **Personal Access Token** field
4. Click **Verify** — it will validate and load your repos
5. Select **maggie-app** from the dropdown
6. Click **Save Configuration**

You're now set up! When you upload a PDF to any song, it will be stored in a `pdf-storage` Release in your GitHub repo.

---

## Part 4: Updating the App in the Future

Any time you want to update the app (after changes are made in a Perplexity session):

```bash
# Get the updated files, then:
npm run deploy
```

That's it — one command rebuilds and republishes.

---

## Quick Reference

| What | Where |
|------|-------|
| App URL | `https://YOUR_USERNAME.github.io/maggie-app` |
| Audience request URL | `https://YOUR_USERNAME.github.io/maggie-app/#/audience` |
| PDF storage | GitHub Releases → `pdf-storage` tag |
| To redeploy | `npm run deploy` in the project folder |
| Song data | Stored in your browser (localStorage) |
| Setlists & venues | Stored in your browser (localStorage) |
| PDFs | Stored in GitHub Release Assets |

---

## Important Notes

### Data is stored in your browser
Songs, setlists, venues, and performance notes are all saved in **localStorage** in whatever browser you use the app in. This means:
- They persist between sessions on the same browser ✓
- They do NOT sync across devices automatically
- Clearing browser data will erase them (PDFs are safe on GitHub)

### PDF tokens need to be re-entered after refresh
For security, your GitHub PAT is kept in memory only and is **not saved to disk**. After refreshing the app, go to Settings and re-enter your token. (The repo config IS saved, so you only re-enter the token itself.)

### The audience URL for gig night
Share this link with the crowd via QR code or text:
```
https://YOUR_USERNAME.github.io/maggie-app/#/audience
```
The app has a built-in QR code generator in the Audience view.
