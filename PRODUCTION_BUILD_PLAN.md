# Bazaario – Production Build & Store Deployment Plan

This document is a step-by-step plan to build and deploy the Bazaario app to **Google Play Store** and **Apple App Store**, with **free or minimal-cost** options where possible.

---

## Table of contents

1. [Overview & costs](#1-overview--costs)
2. [Prerequisites (accounts & tools)](#2-prerequisites-accounts--tools)
3. [Backend deployment](#3-backend-deployment)
4. [Environment variables](#4-environment-variables)
5. [Mobile app production build (EAS)](#5-mobile-app-production-build-eas)
6. [Google Play Store](#6-google-play-store)
7. [Apple App Store](#7-apple-app-store)
8. [Post-launch & updates](#8-post-launch--updates)
9. [Checklist summary](#9-checklist-summary)

---

## 1. Overview & costs

| Item | Free / low cost | Notes |
|------|-----------------|--------|
| **Backend hosting** | Render / Railway free tier, or Fly.io | Free tier limits; upgrade when needed |
| **Database** | MongoDB Atlas free tier | You already use this |
| **Firebase** | Free tier | Auth, FCM, no credit card for Spark |
| **Cloudinary** | Free tier | Images |
| **EAS Build (Expo)** | Free tier | ~30 builds/month on free plan |
| **Google Play** | **$25 one-time** | Developer account |
| **Apple App Store** | **$99/year** | Apple Developer Program |
| **Twilio** | Pay-as-you-go | OTP has cost per SMS |
| **Agora** | Free tier | 10k min/month then paid |
| **Razorpay** | No fixed fee | Transaction fees when you charge |
| **Domain + SSL** | Optional | Many hosts give free subdomain + HTTPS |

**Rough minimum to go live:**  
- **Android only:** ~$25 (Play) + optional backend (~$0 on free tiers).  
- **iOS only:** $99/year (Apple) + optional backend.  
- **Both:** $25 + $99/year + backend (can stay free at low traffic).

---

## 2. Prerequisites (accounts & tools)

Create/verify these **before** starting builds.

### 2.1 Accounts

- [ ] **Expo** – [expo.dev](https://expo.dev) (free account).
- [ ] **Google Play Console** – [play.google.com/console](https://play.google.com/console) – **$25 one-time**.
- [ ] **Apple Developer Program** – [developer.apple.com](https://developer.apple.com) – **$99/year**.
- [ ] **MongoDB Atlas** – already in use; ensure cluster is not paused.
- [ ] **Firebase** – project `bazaario-74850`; enable Auth (Phone, Google, Facebook if used) and Cloud Messaging.
- [ ] **Cloudinary** – free tier for images.
- [ ] **Twilio** – for OTP (pay-as-you-go).
- [ ] **Agora** – for video calls (free tier).
- [ ] **Razorpay** – for payments (when you go live with payments).

### 2.2 Local tools

- [ ] **Node.js** 18+ and npm.
- [ ] **EAS CLI:**  
  `npm install -g eas-cli`  
  Then: `eas login`.
- [ ] **Git** – repo pushed to GitHub (or similar) for EAS and CI if you add it later.

### 2.3 EAS project link

Your app already has an EAS project ID in `myapp/app.json`:

- `extra.eas.projectId`: `97598083-d5ed-4400-9d4d-aeab04010c9a`

If you haven’t linked the project:

```bash
cd myapp
eas init
# Choose “Link to existing project” and use the ID above if prompted.
```

---

## 3. Backend deployment

The app expects the API at `EXPO_PUBLIC_API_BASE_URL` (e.g. `https://your-api.example.com/api`). You need a **public URL** and **HTTPS**.

### Option A: Render (free tier, simple)

1. Go to [render.com](https://render.com), sign up (free).
2. **New → Web Service**; connect your Git repo (e.g. only `server/` or monorepo root).
3. **Build:**
   - **Root directory:** `server` (if repo root is app_bazaario).
   - **Build command:** `npm install && npx tsc` (or `npm run build` if you add a `build` script that compiles TypeScript).
   - **Start command:** `node dist/index.js` or `npx ts-node src/index.ts` (prefer compiled for production).
4. **Environment:** Add all variables from [Section 4.2](#42-server-backend) (no `.env` in Git).
5. **Plan:** Free; sleep after 15 min inactivity (cold starts). Upgrade when you need always-on.

**Important:** On free tier Render gives a URL like `https://your-service.onrender.com`. Use:

`EXPO_PUBLIC_API_BASE_URL=https://your-service.onrender.com/api`

### Option B: Railway (free tier)

1. [railway.app](https://railway.app) → New project → Deploy from GitHub.
2. Set root to `server`, add build/start commands (same idea as Render).
3. Add env vars; Railway gives a `*.railway.app` URL. Use that for `EXPO_PUBLIC_API_BASE_URL`.

### Option C: Fly.io (free tier)

1. Install: `curl -L https://fly.io/install.sh | sh`.
2. In `server/`: `fly launch` (follow prompts; create app, region).
3. Add a `Dockerfile` if needed, or use `fly.toml` with a buildpack/node.
4. Set secrets: `fly secrets set MONGO_URI=... FIREBASE_SERVICE_ACCOUNT=...` (all from [4.2](#42-server-backend)).
5. Deploy: `fly deploy`. Your API URL will be `https://your-app.fly.dev`.

### Backend production checklist

- [ ] Add a **build script** in `server/package.json` that compiles TypeScript (e.g. `tsc`) and a **start** script that runs `node dist/index.js` (or your compiled entry).
- [ ] Use **HTTPS only**; no `http://` in production.
- [ ] Set **CORS** to your app’s origins only (and EAS / Expo origins if needed).
- [ ] Use a **strong `JWT_SECRET`** and never commit it.
- [ ] Keep **Firebase service account** and **Twilio/Agora/Razorpay** keys only in host env (not in Git).

---

## 4. Environment variables

### 4.1 Mobile app (Expo / EAS)

These are baked into the app at **build time** via EAS. Use **EAS Secrets** or **eas.json** `env` for production so you don’t put secrets in Git.

**Required for production:**

| Variable | Description | Example (replace with yours) |
|----------|-------------|------------------------------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL (must end with `/api`) | `https://your-api.onrender.com/api` |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | From Firebase Console |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `bazaario-74850.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `bazaario-74850` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `bazaario-74850.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | From Firebase |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | From Firebase |

**Optional (if you use them):**

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google Sign-In (Web client ID from Google Cloud Console) |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Facebook Login app ID |

**Setting for EAS production builds:**

- Either in **eas.json** under `build.production.env` (non-secret values only), or  
- **EAS Secrets** for anything sensitive:  
  `eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value "https://your-api.com/api" --scope project`

### 4.2 Server (backend)

Set these on the host (Render / Railway / Fly.io) as environment variables. **Never commit** real production values.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | e.g. `5007` or host default (e.g. `8080` on Render) |
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `FIREBASE_SERVICE_ACCOUNT` | Yes | JSON string of Firebase admin key |
| `JWT_SECRET` | Yes | Strong random string (change from default) |
| `CLOUDINARY_URL` | Yes | Cloudinary URL |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio token |
| `TWILIO_SERVICE_SID` | Yes | Twilio Verify service SID |
| `AGORA_APP_ID` | Yes | Agora app ID |
| `AGORA_APP_CERTIFICATE` | Yes | Agora certificate |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | If using Google sign-in | From Google Cloud Console |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | If using Facebook login | From Meta for Developers |
| Razorpay keys | When you enable payments | From Razorpay dashboard |

---

## 5. Mobile app production build (EAS)

You already have `myapp/eas.json` with `production` and `preview` profiles. Below is a production-ready flow.

### 5.1 Add production env to EAS

1. **Option A – eas.json (for non-secret values):**

In `myapp/eas.json`, under `build.production`, add an `env` block with your **production** API URL and Firebase vars (or keep Firebase in EAS Secrets if you prefer):

```json
"production": {
  "android": { "buildType": "app-bundle" },
  "ios": {},
  "env": {
    "EXPO_PUBLIC_API_BASE_URL": "https://YOUR-PRODUCTION-API-URL/api",
    "EXPO_PUBLIC_FIREBASE_API_KEY": "...",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "bazaario-74850.firebaseapp.com",
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "bazaario-74850",
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "bazaario-74850.firebasestorage.app",
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "...",
    "EXPO_PUBLIC_FIREBASE_APP_ID": "..."
  }
}
```

2. **Option B – EAS Secrets (recommended for API URL and keys):**

```bash
cd myapp
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value "https://your-api.onrender.com/api" --scope project
# Repeat for other EXPO_PUBLIC_* if you don’t want them in eas.json
```

Secrets are injected into the build environment; your app already reads `process.env.EXPO_PUBLIC_*`.

**Google Sign-In in the published app:** The production build uses the **native** Google Sign-In SDK. For it to work after you publish to Play Store / App Store, you must: (1) set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in production env (or EAS Secrets), (2) add the **release** Android SHA-1 (from EAS credentials) to Google Cloud Android OAuth client and to Firebase, and (3) create an iOS OAuth client in Google Cloud with bundle ID `com.bazaario.app`. Full steps: **[GOOGLE_AUTH_SETUP.md – §8 Before you publish](GOOGLE_AUTH_SETUP.md#8-before-you-publish-play-store--app-store)**.

### 5.2 App version and build numbers

- In **myapp/app.json**: bump `version` (e.g. `"1.0.0"`) for store listing.
- **Android:** `versionCode` is set by EAS by default (auto-increment) or you can set it in `app.json` under `expo.android.versionCode`.
- **iOS:** `expo.ios.buildNumber` – increment for each App Store upload.

Example for next release:

```json
"version": "1.0.0",
"android": { "package": "com.bazaario.app", "versionCode": 1 },
"ios": { "buildNumber": "1" }
```

### 5.3 Build commands

From the **myapp** directory:

```bash
# Android production (AAB for Play Store)
eas build --profile production --platform android

# iOS production (for App Store)
eas build --profile production --platform ios

# Both
eas build --profile production --platform all
```

First time for iOS, EAS will prompt for Apple credentials (Apple ID, team, provisioning). Have your **Apple Developer** account and, if needed, a **distribution certificate** and **provisioning profile** (EAS can create them).

### 5.4 After the build

- Builds run in the cloud; you get a link to download the **Android AAB** (or APK) and **iOS IPA**.
- **Android:** Download the AAB and use it in Play Console (see Section 6).
- **iOS:** Download the IPA and use it in App Store Connect (see Section 7), or use **EAS Submit** (next).

### 5.5 Optional: EAS Submit (automate store upload)

After a successful build you can submit from the CLI:

```bash
# Submit latest production Android build to Play Store
eas submit --platform android --latest

# Submit latest production iOS build to App Store
eas submit --platform ios --latest
```

You’ll need to configure **Google Service Account** (Play Console) and **App Store Connect API key** (Apple) for fully automated submit. See EAS docs: [Submit to stores](https://docs.expo.dev/submit/introduction/).

---

## 6. Google Play Store

### 6.1 One-time setup

1. **Google Play Console** – pay **$25** and complete account setup.
2. **Create app** – “Create app”, name: Bazaario, default language, type (App), etc.
3. **App content:**
   - Privacy policy URL (required) – host a simple page (e.g. on your backend or GitHub Pages).
   - Data safety form – declare what data you collect (e.g. phone, email, usage).
   - Target audience and content rating (questionnaire).
   - Ads declaration – if you don’t show ads, say “No”.

### 6.2 First release (Production)

1. **Release → Production → Create new release.**
2. **Upload AAB** from EAS build (download from EAS dashboard or link from CLI).
3. **Release name:** e.g. `1.0.0 (1)`.
4. **Release notes** (short description of what’s new).
5. **Review and roll out.**

### 6.3 Store listing (required)

- **Short description** (max 80 chars).
- **Full description** (max 4000 chars).
- **Graphics:**  
  - App icon 512×512.  
  - Feature graphic 1024×500.  
  - Screenshots (phone): at least 2, max 8 (e.g. 16:9 or 9:16).

### 6.4 Android-specific

- **Package name** must match `app.json`: `com.bazaario.app`.
- **Signing:** EAS Build signs the AAB with a key it manages (or you can use your own). For EAS-managed, you can later export the key from EAS if needed.

---

## 7. Apple App Store

### 7.1 One-time setup

1. **Apple Developer Program** – **$99/year**.
2. **App Store Connect** – [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → create an **App** (e.g. Bazaario, bundle ID must match Expo/iOS).
3. **Bundle ID:** Ensure it matches your Expo app. In `app.json` you have `android.package`; for iOS, Expo typically derives from `expo.ios.bundleIdentifier` or the slug. If not set, add in `app.json`:
   - `"ios": { "bundleIdentifier": "com.bazaario.app" }`
4. **Certificates & profiles:** EAS can create these on first iOS build (you sign in with Apple ID when prompted).

### 7.2 First release

1. **App Store Connect → Your app → + Version** (e.g. 1.0.0).
2. **Build:** After EAS build, either:
   - **EAS Submit:** `eas submit --platform ios --latest`, or  
   - **Transporter app (Mac):** Upload the IPA from EAS.
3. **Version info:** What’s New, description, keywords, support URL, privacy policy URL.
4. **Pricing:** Free or paid.
5. **Submit for Review.**

### 7.3 App Store listing

- **Screenshots** (required for each device size you support – e.g. 6.7", 6.5", 5.5").
- **App icon** (1024×1024).
- **Privacy policy URL.**
- **Category** (e.g. Shopping or Social).

### 7.4 iOS-specific

- **Permissions:** You already have camera and microphone usage descriptions in `app.json`; that’s good for video calls.
- **Signing:** Let EAS handle it on first build, or configure your own in EAS.

---

## 8. Post-launch & updates

### 8.1 Over-the-air (OTA) updates with EAS Update (optional)

- You can ship JS/assets changes without a new store build:  
  `eas update --branch production`
- Users get the update on next app open (if you integrated `expo-updates`).  
- Good for small fixes; still need a new store build for native or Expo SDK upgrades.

### 8.2 New store builds

- Bump **version** and/or **buildNumber** / **versionCode** in `app.json`.
- Run `eas build --profile production --platform all` again.
- Submit new AAB/IPA to Play and App Store as needed.

### 8.3 Monitoring (free / low cost)

- **Firebase Crashlytics** – free; add to the app for crash reports.
- **Expo / EAS** – build and submit logs.
- **Backend:** Use your host’s logs (Render/Railway/Fly) and add a simple health route (e.g. `GET /api/health`) for uptime checks.

---

## 9. Checklist summary

Use this as a quick checklist; details are in the sections above.

**Before any production build**

- [ ] Backend deployed and reachable at HTTPS URL.
- [ ] `EXPO_PUBLIC_API_BASE_URL` and all Firebase (and optional Google/Facebook) vars set for production (EAS env or secrets).
- [ ] **Google Sign-In for store:** Complete [GOOGLE_AUTH_SETUP.md §8 (Before you publish)](GOOGLE_AUTH_SETUP.md#8-before-you-publish-play-store--app-store): replace placeholders in EAS production env, add **release** SHA-1 to Google Cloud + Firebase for Android, and add iOS OAuth client with bundle ID `com.bazaario.app`.
- [ ] Server env vars set on host (MongoDB, Firebase, Twilio, Agora, JWT_SECRET, etc.).
- [ ] `myapp/app.json`: version and, for iOS, `ios.buildNumber` and `ios.bundleIdentifier` if needed.
- [ ] `eas build --profile production --platform android` succeeds and produces AAB.
- [ ] `eas build --profile production --platform ios` succeeds and produces IPA (after Apple setup).

**Google Play**

- [ ] Play Console account ($25), app created, content form and data safety done.
- [ ] Store listing: icon, feature graphic, screenshots, short/full description, privacy policy.
- [ ] Production release created with AAB; rolled out.

**Apple App Store**

- [ ] Apple Developer ($99/year), App Store Connect app created, bundle ID aligned.
- [ ] Store listing: icon, screenshots, description, privacy policy, category.
- [ ] Build uploaded (EAS Submit or Transporter); version submitted for review.

**Ongoing**

- [ ] Strong JWT_SECRET and no secrets in Git.
- [ ] Privacy policy and data handling documented and linked in both stores.
- [ ] Plan for OTA updates (EAS Update) and when to do full store releases.

---

**Document version:** 1.0  
**Last updated:** Feb 2025  
**Project:** Bazaario (Expo + Node backend)
