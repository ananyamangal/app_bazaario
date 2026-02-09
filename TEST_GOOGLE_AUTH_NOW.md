# Test Google Sign-In - Step-by-Step Checklist

**Your new IP:** `192.168.0.200`  
**Backend URL:** `http://192.168.0.200:5007/api`

---

## ✅ Step 1: Update Environment Files

**Already done:** `myapp/.env` updated with new IP ✅

**Verify `server/.env` has Google credentials:**
```env
GOOGLE_CLIENT_ID=953390001880-sglenrhe806sokejmang1dg6193hqa6j.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

---

## ✅ Step 2: Start Backend Server

**Open Terminal 1:**
```bash
cd server
npm run dev
```

**Wait for:**
```
Backend running on http://localhost:5007
Socket.io server ready
MongoDB connected
```

**✅ Keep this terminal open and visible!**

---

## ✅ Step 3: Test Backend is Reachable

**On your phone (same Wi-Fi as PC):**

1. Open phone's browser (Chrome/Safari)
2. Go to: `http://192.168.0.200:5007/api/auth/google-id-token`

**Expected result:**
- ✅ **Success:** You see a JSON message: `{"message":"This endpoint requires POST method...", "method":"POST"}`
- ❌ **Fail:** "Can't connect" or timeout → Check Wi-Fi, firewall, or IP address

**If it works:** Backend is reachable! ✅  
**If it fails:** Backend not reachable - check:
- Phone and PC on same Wi-Fi?
- Windows Firewall blocking port 5007?
- IP address correct? (Check with `ipconfig` in PowerShell)

---

## ✅ Step 4: Restart Expo (to pick up new IP)

**Open Terminal 2:**
```bash
cd myapp
npx expo start
```

**Important:** 
- Stop old Expo if running (`Ctrl+C`)
- Start fresh so it picks up the new `.env` IP

**Wait for:** QR code appears

---

## ✅ Step 5: Open App in Expo Go

1. **On your phone:** Open **Expo Go** app
2. **Scan QR code** from Terminal 2
3. **Wait for app to load**

---

## ✅ Step 6: Test Google Sign-In

1. **In the app:** Go to Login/Auth screen
2. **Tap:** "Continue with Google" or "Google" button
3. **Expected flow:**
   - Browser opens (or in-app browser)
   - Google sign-in page appears
   - Select your Google account
   - Tap "Continue" or "Allow"
   - Browser closes
   - **You should be logged in!** ✅

---

## ✅ Step 7: Watch Backend Terminal

**While testing (Step 6), watch Terminal 1 (backend):**

**✅ Success logs:**
```
POST /api/auth/google-id-token 200 ...
[Google Auth] Exchanging code for token...
```

**❌ Error logs (what to check):**
```
POST /api/auth/google-id-token 404
→ Route not found - restart backend

POST /api/auth/google-id-token 503
→ Google credentials missing - check server/.env

POST /api/auth/google-id-token 400
[Google Token] 400 ...
→ Check error message - likely redirect_uri_mismatch
→ Fix: Add `https://auth.expo.io/@hassan0101/myapp` to Google Cloud
```

---

## 🔍 Troubleshooting

### ❌ "Can't connect" when testing backend (Step 3)

**Check IP address:**
```powershell
ipconfig
```
Look for **IPv4 Address** under your Wi-Fi adapter. Update `myapp/.env` if different.

**Check Windows Firewall:**
- Temporarily disable to test
- Or add exception for Node.js / port 5007

**Check Wi-Fi:**
- Phone and PC must be on **same Wi-Fi network**
- Try disconnecting and reconnecting phone

---

### ❌ Backend shows 404 for POST request

**Fix:** Restart backend server (Step 2)

---

### ❌ "redirect_uri_mismatch" error

**Fix:**
1. Go to: https://console.cloud.google.com/
2. Select project: **bazaario-74850**
3. Go to: **APIs & Services** → **Credentials**
4. Click your **Web application** OAuth client
5. Under **Authorized redirect URIs**, add:
   ```
   https://auth.expo.io/@hassan0101/myapp
   ```
6. **Save** and wait 1-2 minutes
7. Try again

---

### ❌ "Google sign-in is not configured" (503)

**Fix:** Check `server/.env` has:
```env
GOOGLE_CLIENT_ID=953390001880-sglenrhe806sokejmang1dg6193hqa6j.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

Then **restart backend**.

---

### ❌ App shows "Something went wrong" after Google sign-in

**Check:**
1. Backend terminal for error logs (Step 7)
2. Backend is running (Step 2)
3. Backend is reachable (Step 3)
4. Google Cloud redirect URI is correct (see above)

---

## ✅ Success Indicators

**Everything working when:**
- ✅ Backend terminal shows: `POST /api/auth/google-id-token 200`
- ✅ App successfully logs you in after Google sign-in
- ✅ You see your profile/user data in the app

---

## Quick Test Summary

1. ✅ Backend running → `npm run dev` in `server/`
2. ✅ Test backend → `http://192.168.0.200:5007/api/auth/google-id-token` in phone browser
3. ✅ Expo restarted → `npx expo start` in `myapp/`
4. ✅ Open app → Scan QR code in Expo Go
5. ✅ Test sign-in → Tap "Continue with Google"
6. ✅ Watch backend → Check terminal for success/error

**If all steps pass:** Google auth is working! 🎉
