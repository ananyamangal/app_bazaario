# Debugging Google Sign-In Error

You're seeing: **"Something went wrong trying to finish signing in"** on `auth.expo.io`

This means Google redirected back successfully, but the backend exchange failed.

---

## Quick Checks

### 1. Is Backend Server Running?

**Check:** Open terminal where you ran `npm run dev` in `server/` folder.

**Should see:** `Server running on port 5007` or similar

**If not running:**
```bash
cd server
npm run dev
```

**Keep this terminal open!**

---

### 2. Can Phone Reach Backend?

**Test on your phone's browser:**
1. Open browser on phone (same Wi-Fi as PC)
2. Go to: `http://172.16.2.34:5007/api/auth/google-id-token`
3. **Expected:** Should see an error like "Method not allowed" or "code and redirectUri are required" (this means backend is reachable!)
4. **If "can't connect" or timeout:** Backend not reachable (see Network section below)

---

### 3. Check Backend Console Logs

When you click "Continue with Google", **watch the backend terminal**. You should see:

**If backend receives request:**
```
[Google Token] 400 ... (error from Google)
```

**If you see nothing:** Backend not receiving requests (network/firewall issue)

**If you see error:** Check the error message - it will tell you what's wrong

---

### 4. Common Issues & Fixes

#### ❌ "Failed to exchange Google code: redirect_uri_mismatch"

**Problem:** Redirect URI in Google Cloud doesn't match what we're sending

**Fix:**
1. Go to: https://console.cloud.google.com/ → **bazaario-74850** → **Credentials**
2. Click your **Web application** OAuth client
3. Under **Authorized redirect URIs**, make sure you have:
   ```
   https://auth.expo.io/@hassan0101/myapp
   ```
4. **Save** and wait 1-2 minutes
5. Try again

---

#### ❌ "Google sign-in is not configured" (503 error)

**Problem:** Backend `.env` missing Google credentials

**Fix:**
1. Open `server/.env`
2. Make sure you have:
   ```env
   GOOGLE_CLIENT_ID=953390001880-sglenrhe806sokejmang1dg6193hqa6j.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   ```
3. **Restart backend:** Stop (`Ctrl+C`) and run `npm run dev` again

---

#### ❌ Backend not reachable (network error)

**Problem:** Phone can't connect to `http://172.16.2.34:5007`

**Fixes:**

1. **Check IP address:**
   - On Windows: Open PowerShell → `ipconfig`
   - Look for **IPv4 Address** under your Wi-Fi adapter
   - Update `myapp/.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_NEW_IP:5007/api`
   - Restart Expo: Stop and run `npx expo start` again

2. **Check Wi-Fi:**
   - Phone and PC must be on **same Wi-Fi network**
   - Try disconnecting and reconnecting phone to Wi-Fi

3. **Check Windows Firewall:**
   - Windows might be blocking port 5007
   - Try temporarily disabling firewall to test
   - Or add exception for Node.js / port 5007

4. **Try different IP:**
   - Sometimes `172.16.x.x` is a VPN or virtual network
   - Try your main Wi-Fi IP (usually `192.168.x.x`)

---

#### ❌ "Failed to get Google token" (no backend error)

**Problem:** Backend is reachable but returning error

**Check backend terminal** - it will show the actual error from Google

**Common causes:**
- Redirect URI mismatch (see above)
- Invalid Client ID/Secret
- Code already used (try again)

---

## Step-by-Step Debug Process

1. **✅ Backend running?**
   ```bash
   cd server
   npm run dev
   ```
   Should see: "Server running on port 5007"

2. **✅ Test backend from phone browser:**
   - Go to: `http://172.16.2.34:5007/api/auth/google-id-token`
   - Should see error (means backend is reachable)

3. **✅ Check `.env` files:**
   - `server/.env`: Has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`?
   - `myapp/.env`: Has `EXPO_PUBLIC_GOOGLE_CLIENT_ID`?
   - `myapp/.env`: Has `EXPO_PUBLIC_API_BASE_URL` with correct IP?

4. **✅ Check Google Cloud:**
   - Redirect URI `https://auth.expo.io/@hassan0101/myapp` added?
   - Web client ID matches what's in `.env` files?

5. **✅ Try sign-in again:**
   - Watch backend terminal for errors
   - Check phone browser console (if possible) or React Native debugger

---

## Still Not Working?

**Check backend logs** - they will show the exact error from Google's API.

**Common final issues:**
- Redirect URI has typo (extra space, wrong username)
- Client Secret expired (regenerate in Google Cloud)
- OAuth consent screen not published (if using External, add test users)

---

## Quick Test Commands

**Test backend is running:**
```bash
curl http://localhost:5007/api/auth/google-id-token
# Should return: {"message":"code and redirectUri are required"}
```

**Test from phone browser:**
```
http://172.16.2.34:5007/api/auth/google-id-token
# Should return same error (means backend reachable)
```
