# How to Test Google Sign-In Locally (Step-by-Step)

This guide shows you **exactly where to get each environment variable** and how to test Google Sign-In **right now** on your phone/emulator.

---

## 🚀 Quick Start (Your Specific Values)

**Your Expo username:** `hassan0101`  
**Your PC IP:** `172.16.2.36` (from your current `.env`)  
**Redirect URI to add in Google Cloud:** `https://auth.expo.io/@hassan0101/myapp`

**What you need to do:**
1. Get Google Client ID and Secret from Google Cloud Console (Step 2)
2. Add them to `myapp/.env` and `server/.env` (Step 4)
3. Test it! (Step 5)

---

## Quick Overview

You need **2 files** with environment variables:
1. **`myapp/.env`** - For the mobile app (Expo)
2. **`server/.env`** - For the backend server

**Testing method:** Use **Expo Go** app (easiest - no build needed!)

---

## Step 1: Get Your Expo Username

This is needed for the Google redirect URI.

```bash
cd myapp
npx expo whoami
```

**✅ Your Expo username:** `hassan0101`  
**Note:** You'll use this in Step 3 for the redirect URI!

---

## Step 2: Get Google Client ID and Secret from Google Cloud Console

### 2.1 Open Google Cloud Console

1. Go to: **https://console.cloud.google.com/**
2. **Select project:** Make sure you're in the project linked to Firebase **bazaario-74850**
   - If you don't see it, go to [Firebase Console](https://console.firebase.google.com/) → project **bazaario-74850** → Project settings → scroll down to see the **Google Cloud project ID**

### 2.2 Enable OAuth Consent Screen (if not done)

1. In Google Cloud Console, go to: **APIs & Services** → **OAuth consent screen**
2. Choose **External** (or **Internal** if only for testing)
3. Fill in:
   - **App name:** `Bazaario`
   - **User support email:** Your email
   - **Developer contact:** Your email
4. Click **Save and Continue** → **Save and Continue** (skip scopes/test users for now)

### 2.3 Create Web Application OAuth Client

1. Go to: **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type:** Select **Web application**
4. **Name:** `Bazaario Web`
5. **Authorized redirect URIs:** Click **+ ADD URI** and add:
   ```
   https://auth.expo.io/@YOUR_EXPO_USERNAME/myapp
   ```
   Replace `YOUR_EXPO_USERNAME` with the username from Step 1!
   
   **Example:** For username `hassan0101`, add: `https://auth.expo.io/@hassan0101/myapp`
6. Click **CREATE**
7. **IMPORTANT:** A popup will show:
   - **Client ID** (looks like: `123456789-xxxxxxxxxx.apps.googleusercontent.com`)
   - **Client secret** (looks like: `GOCSPX-xxxxxxxxxxxxx`)
   
   **Copy both** - you'll need them!

---

## Step 3: Enable Google Sign-In in Firebase

1. Go to: **https://console.firebase.google.com/**
2. Select project **bazaario-74850**
3. Go to: **Authentication** → **Sign-in method**
4. Click on **Google**
5. Toggle **Enable** → **Save**
6. **Web SDK configuration** will show:
   - **Web client ID** (same as the Client ID from Step 2.3)
   - **Web client secret** (same as Client secret from Step 2.3)
   
   ✅ These are already set - Firebase uses the same Google Cloud project!

---

## Step 4: Add Environment Variables

### 4.1 Update `myapp/.env`

Open `myapp/.env` and add/update:

```env
# Google Sign-In (Web Client ID from Step 2.3)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE

# API URL (your PC's IP so phone can reach backend)
EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_IP:5007/api
```

**Replace:**
- `YOUR_CLIENT_ID_HERE` → The **Client ID** from Step 2.3 (e.g. `123456789-xxxxx.apps.googleusercontent.com`)
- `YOUR_PC_IP` → Your computer's local IP address (see below)

**To find your PC's IP:**
- **Windows:** Open PowerShell → run `ipconfig` → look for **IPv4 Address** (e.g. `192.168.1.100` or `172.16.2.36`)
- **Mac/Linux:** Run `ifconfig` or `ip addr` → look for your Wi-Fi IP

**Example `myapp/.env`:**
```env
EXPO_PUBLIC_API_BASE_URL=http://172.16.2.36:5007/api
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyCVjnNmds7kdXkoouK2xbAY8rN9J4mafeY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=bazaario-74850.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=bazaario-74850
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=bazaario-74850.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=953390001880
EXPO_PUBLIC_FIREBASE_APP_ID=1:953390001880:web:7fcac4ab580db16cd371ad

# Google Sign-In (Web Client ID)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789-xxxxxxxxxx.apps.googleusercontent.com
```

### 4.2 Update `server/.env`

Open `server/.env` and add:

```env
# Google Sign-In (from Step 2.3)
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
```

**Replace:**
- `YOUR_CLIENT_ID_HERE` → Same **Client ID** from Step 2.3
- `YOUR_CLIENT_SECRET_HERE` → The **Client secret** from Step 2.3

**Example `server/.env`:**
```env
PORT=5007
MONGO_URI=mongodb+srv://...
FIREBASE_SERVICE_ACCOUNT={...}
CLOUDINARY_URL=cloudinary://...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_SERVICE_SID=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...

# Google Sign-In
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```

---

## Step 5: Test It!

### 5.1 Start the Backend Server

```bash
cd server
npm run dev
```

**Wait for:** `Server running on port 5007` or similar  
**Keep this terminal open!**

### 5.2 Start Expo

**Open a NEW terminal:**

```bash
cd myapp
npx expo start
```

**You should see:**
- QR code in terminal
- Metro bundler starting

### 5.3 Open App in Expo Go

1. **On your phone:** Install **Expo Go** app (from Play Store / App Store) if you don't have it
2. **Make sure phone and PC are on the same Wi-Fi network**
3. **Scan the QR code** from the terminal with:
   - **Android:** Expo Go app (camera)
   - **iOS:** Camera app (then tap "Open in Expo Go")

### 5.4 Test Google Sign-In

1. In the app, go to **Login** or **Auth** screen
2. Tap **"Continue with Google"** or **"Google"** button
3. **Expected flow:**
   - Browser opens (or in-app browser)
   - Google sign-in page appears
   - Sign in with your Google account
   - Browser closes
   - **You should be logged in!** ✅

---

## Troubleshooting

### ❌ "Google sign-in is not configured"

**Fix:** Check `myapp/.env` has `EXPO_PUBLIC_GOOGLE_CLIENT_ID` set correctly.  
**Restart Expo:** Stop (`Ctrl+C`) and run `npx expo start` again.

### ❌ "Failed to get Google token" or backend error

**Fix:** Check `server/.env` has both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.  
**Restart server:** Stop and run `npm run dev` again.

### ❌ Browser opens but says "redirect_uri_mismatch"

**Fix:** 
1. Go to Google Cloud Console → Credentials → your Web client
2. Check **Authorized redirect URIs** includes: `https://auth.expo.io/@hassan0101/myapp`
3. Make sure it matches exactly (your username is `hassan0101`)

### ❌ Phone can't connect to backend (network error)

**Fix:**
1. Make sure phone and PC are on **same Wi-Fi**
2. Check `EXPO_PUBLIC_API_BASE_URL` in `myapp/.env` uses your **PC's IP** (not `localhost` or `127.0.0.1`)
3. Check Windows Firewall isn't blocking port `5007`
4. Try `http://YOUR_PC_IP:5007/api` in phone's browser - should show API response or error (not "can't connect")

### ❌ App shows "Loading..." forever

**Fix:** Check backend is running and reachable. Open `http://YOUR_PC_IP:5007/api` in phone browser to test.

---

## Quick Checklist

Before testing, make sure:

- [ ] **Expo username noted** (from `npx expo whoami`)
- [ ] **Google Cloud:** OAuth consent screen configured
- [ ] **Google Cloud:** Web OAuth client created with redirect URI `https://auth.expo.io/@hassan0101/myapp`
- [ ] **Google Cloud:** Client ID and Client secret copied
- [ ] **Firebase:** Google sign-in method **enabled**
- [ ] **`myapp/.env`:** `EXPO_PUBLIC_GOOGLE_CLIENT_ID` set (Client ID)
- [ ] **`myapp/.env`:** `EXPO_PUBLIC_API_BASE_URL` set (with your PC IP, not localhost)
- [ ] **`server/.env`:** `GOOGLE_CLIENT_ID` set (Client ID)
- [ ] **`server/.env`:** `GOOGLE_CLIENT_SECRET` set (Client secret)
- [ ] **Backend running** (`npm run dev` in `server/`)
- [ ] **Expo running** (`npx expo start` in `myapp/`)
- [ ] **Phone and PC on same Wi-Fi**

---

## Where to Find Each Environment Variable

| Variable | Where to Get It |
|----------|----------------|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials → Web OAuth client → **Client ID** |
| `GOOGLE_CLIENT_ID` (server) | Same as above (Client ID) |
| `GOOGLE_CLIENT_SECRET` (server) | Google Cloud Console → Credentials → Web OAuth client → **Client secret** |
| `EXPO_PUBLIC_API_BASE_URL` | Your PC's local IP (from `ipconfig` / `ifconfig`) + `:5007/api` |
| `EXPO_PUBLIC_FIREBASE_*` | Firebase Console → Project settings → Your apps → Web app config (already in your `.env`) |

---

## Next Steps (After Testing Works)

Once Google Sign-In works in Expo Go:

1. **For native builds (development):** See `GOOGLE_AUTH_SETUP.md` → Section 1.3.B (Android SHA-1) and 1.3.C (iOS bundle ID)
2. **For production (Play Store / App Store):** See `GOOGLE_AUTH_SETUP.md` → Section 8 (Before you publish)

---

**Need help?** Check the full guide: `GOOGLE_AUTH_SETUP.md`
