# Google Sign-In Setup for Bazaario

You can test Google Sign-In in **two ways**:

1. **Expo Go (easiest)** – Uses a browser OAuth flow; no native build. Add a redirect URI and backend env (see below).
2. **Development build** – Uses the native Google Sign-In SDK; needs Android/iOS OAuth clients and SHA-1.

---

## 1. Google Cloud Console (same project as Firebase)

Firebase project **bazaario-74850** is linked to a Google Cloud project. Use that project.

### 1.1 Open credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Select the project that backs your Firebase app (same as Firebase project **bazaario-74850**).
3. Go to **APIs & Services** → **Credentials**.

### 1.2 OAuth consent screen (if not done)

1. Go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (or Internal for testing-only).
3. Fill **App name** (e.g. Bazaario), **User support email**, **Developer contact**.
4. **Scopes**: Add `.../auth/userinfo.email` and `.../auth/userinfo.profile` if you need them (Firebase often only needs the default).
5. **Test users**: If app is in "Testing", add the Gmail addresses that will sign in.

### 1.3 Create OAuth 2.0 Client IDs

You need **three** client IDs (all in the same Google Cloud project):

#### A. Web application (required for both Expo Go and native)

1. **Credentials** → **Create Credentials** → **OAuth client ID**.
2. Application type: **Web application**.
3. Name: e.g. **Bazaario Web**.
4. **Authorized redirect URIs** – add **both**:
   - **Expo Go testing:** `https://auth.expo.io/@YOUR_EXPO_USERNAME/myapp`  
     Replace `YOUR_EXPO_USERNAME` with your Expo account username (run `npx expo whoami` in `myapp` to see it). The app slug is `myapp` (from `app.json`).
   - You can also add `http://localhost` for local web testing if needed.
5. **Authorized JavaScript origins** (optional): add your backend URL if you use it from a web client (e.g. `http://localhost:5007`).
6. Create → copy the **Client ID** and **Client secret**.  
   - **Client ID** → use as `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in the app.  
   - **Client secret** → use as `GOOGLE_CLIENT_SECRET` in the **server** `.env` (required for Expo Go flow).

#### B. Android

1. **Create Credentials** → **OAuth client ID**.
2. Application type: **Android**.
3. Name: e.g. **Bazaario Android**.
4. **Package name**: `com.bazaario.app` (must match `app.json` → `expo.android.package`).
5. **SHA-1 certificate fingerprint**:
   - **Debug (local builds):**  
     Run:
     ```bash
     cd myapp
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
     Copy the **SHA1** line (e.g. `AA:BB:CC:...`).
   - **Release (EAS / Play Store):**  
     From EAS: `eas credentials` → view Android keystore → SHA-1. Or from your upload keystore with `keytool -list -v -keystore your-upload-key.keystore`.
6. Add both SHA-1s if you use debug and release. Create.

#### C. iOS (for App Store build later)

1. **Create Credentials** → **OAuth client ID**.
2. Application type: **iOS**.
3. **Bundle ID**: e.g. `com.bazaario.app` (must match your Expo iOS bundle identifier; add in `app.json` under `expo.ios.bundleIdentifier` if needed).
4. Create.

---

## 2. Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/) → project **bazaario-74850**.
2. **Authentication** → **Sign-in method** → **Google** → **Enable**, save.
3. **Project settings** (gear) → **Your apps**:
   - **Android** app: Add the **SHA-1**(s) from step 1.3.B (debug + release). This links the Android app to Google Sign-In.
   - **iOS** app: No extra step for Google beyond enabling the provider; bundle ID must match the iOS OAuth client.

---

## 3. App environment and build

### 3.1 Web client ID in the app

The native SDK needs the **Web client ID** (from step 1.3.A) to verify the token.

- **Local / dev:** In `myapp/.env` add:
  ```env
  EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789-xxxxxxxxxx.apps.googleusercontent.com
  ```
  Replace with your actual Web client ID.

- **EAS / production:** In **EAS Secrets** or in `eas.json` under `build.production.env`:
  ```json
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "123456789-xxxxxxxxxx.apps.googleusercontent.com"
  ```
  So production builds get the same value.

### 3.2 Testing in Expo Go (no native build)

1. In **Google Cloud** Web client, add the redirect URI: `https://auth.expo.io/@YOUR_EXPO_USERNAME/myapp` (see 1.3.A).
2. In **server `.env`** set:
   ```env
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-web-client-secret
   ```
3. In **myapp `.env`** set:
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_IP:5007/api
   ```
   Use your machine’s LAN IP (e.g. `192.168.1.8`) so the phone/emulator can reach the backend.
4. Start the **server** (`npm run dev` in `server`).
5. Start Expo: `cd myapp && npx expo start`, then open the app in **Expo Go** on your device.
6. Tap **Continue with Google** (Auth or Login screen). A browser will open; sign in with Google; you are redirected back and signed in.

### 3.3 Development build (optional – native Google Sign-In)

For a **native** Google Sign-In flow (no browser), use a development build:

- **Android:** `cd myapp && npx expo prebuild && npx expo run:android` (or EAS build + install APK).
- **iOS:** `npx expo prebuild && npx expo run:ios`.

Then the app uses the native SDK when available; otherwise it falls back to the Expo Go (browser) flow.

---

## 4. Backend (required for Expo Go flow)

- **Expo Go / browser flow:** The backend **must** have `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Web client) in `.env`. The app sends the OAuth code to **POST /api/auth/google-id-token** and receives an `idToken` to sign in with Firebase.
- **Native flow only:** The device gets the id token from the native SDK; the backend does not need to exchange a code. You can still set the env vars for Expo Go testing.

---

## 5. Quick checklist (Expo Go testing)

- [ ] Google Cloud: OAuth consent screen configured.
- [ ] Google Cloud: **Web application** client created; **Client ID** and **Client secret** copied.
- [ ] Google Cloud: Web client **Authorized redirect URIs** includes `https://auth.expo.io/@YOUR_EXPO_USERNAME/myapp`.
- [ ] Firebase: Google sign-in method **enabled**.
- [ ] Server `.env`: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set (Web client values).
- [ ] myapp `.env`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_API_BASE_URL` (e.g. `http://YOUR_IP:5007/api`) set.
- [ ] Run server, then `npx expo start`, open in Expo Go, tap **Continue with Google**.

---

## 6. Where Google sign-in is used in the app

- **LoginScreen** – “Google” button → `signInWithGoogle(role)` (role = Customer/Seller).
- **AuthScreen** – “Continue with Google” → `signInWithGoogle('customer')`.
- **CustomerSignUpScreen** – “Continue with Google” → `signInWithGoogle('customer')`.

After a successful sign-in, Firebase Auth state updates and the app loads user data (or registers the social user on the backend with the chosen role).

---

## 7. Test in 5 steps (Expo Go)

1. **Get your Expo username:** In `myapp` run `npx expo whoami`. Note the username (e.g. `yourname`).

2. **Google Cloud** → Web client → **Authorized redirect URIs** → add:
   ```text
   https://auth.expo.io/@yourname/myapp
   ```
   (Replace `yourname` with the username from step 1.)

3. **Server `.env`** (in `server/`):
   ```env
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-web-client-secret
   ```

4. **myapp `.env`**:
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_IP:5007/api
   ```
   (Use your computer’s IP, e.g. `192.168.1.8`, so the phone can reach the backend.)

5. **Run and test:**
   - Terminal 1: `cd server && npm run dev`
   - Terminal 2: `cd myapp && npm install && npx expo start`
   - Open the app in **Expo Go** on your phone (same Wi‑Fi as PC).
   - Tap **Continue with Google** → sign in in the browser → you should return to the app and be logged in.

---

## 8. Before you publish (Play Store / App Store)

When you build for **production** and publish the app, the installed app uses the **native** Google Sign-In SDK (no browser). To make sure it works in the published app:

### 8.1 App config (already set)

- **Android package:** `com.bazaario.app` (in `app.json` → `expo.android.package`).
- **iOS bundle ID:** `com.bazaario.app` (in `app.json` → `expo.ios.bundleIdentifier`).

### 8.2 EAS production build env

Production builds must get the **Web client ID** and your **production API URL** at build time. Two options:

**Option A – EAS Secrets (recommended)**  
So you don’t commit real values:

```bash
cd myapp
eas secret:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com" --scope project --type string
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value "https://your-api.example.com/api" --scope project --type string
```

**Option B – eas.json**  
In `myapp/eas.json`, under `build.production.env`, replace the placeholders:

- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` → your Web client ID from Google Cloud (same as 1.3.A).
- `EXPO_PUBLIC_API_BASE_URL` → your production API base URL (e.g. `https://api.bazaario.com/api`).

Then run: `eas build --profile production --platform all`.

### 8.3 Google Cloud – Android (Play Store)

1. **Release SHA-1:** After your first production Android build, EAS has a keystore. Get the SHA-1:
   - Run: `eas credentials --platform android` → choose your project → view keystore / signing key → copy **SHA-1**.
   - Or in [Expo dashboard](https://expo.dev) → your project → Credentials → Android → view SHA-1.
2. In **Google Cloud** → **Credentials** → your **Android** OAuth client (package `com.bazaario.app`) → add this **release** SHA-1 (in addition to debug SHA-1 if you use it).
3. In **Firebase** → Project settings → Your apps → Android app → add the same **release** SHA-1.

Without the release SHA-1, Google Sign-In will fail in the app downloaded from Play Store.

### 8.4 Google Cloud – iOS (App Store)

1. In **Google Cloud** → **Credentials** → create (or use) an **iOS** OAuth client.
2. **Bundle ID** must be exactly: `com.bazaario.app` (same as `app.json` → `expo.ios.bundleIdentifier`).
3. No SHA-1 for iOS; Firebase Google sign-in works once the provider is enabled and bundle ID matches.

### 8.5 Production checklist (publish)

- [ ] **app.json:** `expo.ios.bundleIdentifier` = `com.bazaario.app` (done).
- [ ] **EAS production:** `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_API_BASE_URL` set via EAS Secrets or `eas.json` (no placeholders).
- [ ] **Google Cloud – Android:** Android OAuth client has **release** SHA-1 from EAS/Play keystore; package `com.bazaario.app`.
- [ ] **Google Cloud – iOS:** iOS OAuth client with bundle ID `com.bazaario.app`.
- [ ] **Firebase:** Google sign-in enabled; Android app has **release** SHA-1 in project settings.
- [ ] **Backend:** Production server has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in env (only needed if you ever use the web/Expo Go fallback from production; native flow doesn’t call the backend for Google).

After this, when users install the app from Play Store or App Store, **Continue with Google** uses the native SDK and works as intended.
