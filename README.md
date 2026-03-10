# Demographics Radius Tool

A public web app to explore U.S. Census ACS demographic data for any address and radius (1, 5, or 10 miles), with county, city, and state comparison points.

---

## ⚡ Deploying to Vercel (Step-by-Step)

### Prerequisites
- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account
- Your U.S. Census API key (get one free at https://api.census.gov/data/key_signup.html)

---

### Step 1 — Put the code on GitHub

1. Go to https://github.com/new and create a **new repository** (e.g. `demographics-radius-tool`). Make it **Private** if you prefer.
2. On your computer, open Terminal (Mac) or Command Prompt (Windows).
3. Navigate to this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/shelbyshumard-cofc/census_demo_app.git 
git push -u origin main
```
```bash
cd census-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/shelbyshumard-cofc/census_demo_app.git 
git push -u origin main
```
---

### Step 2 — Deploy to Vercel

1. Go to https://vercel.com and sign in (use your GitHub account for easiest setup).
2. Click **"Add New Project"**.
3. Click **"Import"** next to your `demographics-radius-tool` repository.
4. Vercel will auto-detect it as a Next.js project. Leave all settings as default.
5. **Before clicking Deploy**, scroll down to **"Environment Variables"** and add:

| Name | Value |
|------|-------|
| `CENSUS_API_KEY` | `your_actual_census_api_key` |

6. Click **Deploy**.
7. Wait ~2 minutes. Vercel will give you a live URL like `demographics-radius-tool.vercel.app`.

---

### Step 3 — Test It

1. Open your Vercel URL.
2. Enter an address (e.g. `123 King St, Charleston, SC`).
3. Select a radius and year, then click **Get Demographics**.

---

### Updating the App Later

Any time you push changes to GitHub, Vercel automatically re-deploys:

```bash
git add .
git commit -m "Update description"
git push
```

---

## 🔑 Getting a Census API Key

1. Go to https://api.census.gov/data/key_signup.html
2. Fill in your name, email, and organization.
3. You'll receive the key by email within a few minutes.
4. The key is free and has no rate limits for normal usage.

---

## 🗂️ Project Structure

```
census-app/
├── pages/
│   ├── index.js          # Main app page
│   └── api/
│       └── demographics.js   # Server-side Census API handler
├── components/
│   ├── DemographicsMap.js    # Leaflet map component
│   └── DataTable.js          # Results table with tabs
├── lib/
│   ├── census.js             # Census API logic & data processing
│   └── export.js             # CSV & Excel export utilities
├── styles/
│   └── globals.css           # All styles
└── .env.local.example        # Copy to .env.local for local development
```

---

## 💻 Running Locally

```bash
# 1. Copy environment file
cp .env.local.example .env.local
# Edit .env.local and add your Census API key

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev

# 4. Open http://localhost:3000
```

---

## 📊 Data Sources

- **Demographics**: U.S. Census Bureau American Community Survey (ACS) 5-Year Estimates
- **Geocoding**: U.S. Census Bureau Geocoding Services (free, no key required)
- **Map tiles**: CARTO + OpenStreetMap (free)

## ⚠️ Notes

- Radius figures are **approximations** based on Census block groups whose centroids fall within the selected radius.
- ACS 5-year estimates represent an average over a 5-year period ending in the selected year (e.g., "2023" = 2019–2023 average).
- Some geographies (especially small cities) may return `—` if the Census API does not have data for that place.
