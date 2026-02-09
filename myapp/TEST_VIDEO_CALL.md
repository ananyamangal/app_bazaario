# Step-by-step: Test video calling on 2 Android devices

Backend URL in this guide: **http://172.16.2.34:5007/api**  
Use the same Wi‑Fi on your PC and both phones so they can reach this IP.

---

## Icon (if EAS reports "image should be square" or icon size)

The app uses `assets/icon-square.png` for the launcher icon. It must be a **square** image; Expo recommends **1024×1024** pixels.

- If the build fails on icon: replace `myapp/assets/icon-square.png` with a **1024×1024 square PNG** of your logo (crop or resize your current `icon.png` with any image editor or [simpleimageresizer.com](https://www.simpleimageresizer.com/)), then run the build again.

---

## Part 1: Build the app (one-time)

### Step 1: Install EAS CLI

Open a terminal and run:

```bash
npm install -g eas-cli
```

### Step 2: Log in to Expo

```bash
eas login
```

- If you have an Expo account: enter email and password.
- If not: go to https://expo.dev/signup, create an account, then run `eas login` again.

### Step 3: Go to your app folder

```bash
cd "c:\Users\shams\Downloads\app_bazaario-main 3\app_bazaario-main\myapp"
```

(Or open a terminal already inside the `myapp` folder.)

### Step 4: Start the Android build

```bash
eas build --profile preview --platform android
```

- If asked “Would you like to create a new project?” → choose **Y** (Yes).
- If asked to link to an existing project → choose as you prefer (usually **Y** for first time).
- Wait for the build to finish (about 10–20 minutes). You can close the terminal; the build runs on Expo’s servers.

### Step 5: Download the APK

1. Open https://expo.dev in your browser and log in.
2. Go to **Projects** → your project (**myapp** / Bazaario).
3. Open the **Builds** tab.
4. Click the latest **Android** build (status: Finished).
5. Click **Download** (or “Install” / “APK”) and save the `.apk` file to your PC.

### Step 6: Install the APK on both phones

1. Transfer the same APK to **Phone 1** and **Phone 2** (USB, Google Drive, email, etc.).
2. On each phone:
   - Open the APK file.
   - If asked “Install from unknown sources?” → allow it (e.g. “Settings” → enable for Chrome/Files).
   - Tap **Install**, then **Open**.

---

## Part 2: Run the backend (every time you test)

### Step 7: Start the server on your PC

1. Open a terminal.
2. Go to the server folder:

   ```bash
   cd "c:\Users\shams\Downloads\app_bazaario-main 3\app_bazaario-main\server"
   ```

3. Start the backend:

   ```bash
   npm run dev
   ```

4. Leave this terminal open. You should see something like: `Backend running on http://localhost:5007`.

### Step 8: Same Wi‑Fi for PC and both phones

- Connect your **PC** to Wi‑Fi.
- Connect **Phone 1** and **Phone 2** to the **same** Wi‑Fi.
- Your PC’s IP on this network should be **172.16.2.34** (the one in the app).  
  To check on Windows: open Command Prompt and run `ipconfig`, and look at the IPv4 address of your Wi‑Fi adapter.

---

## Part 3: Test the video call on 2 devices

### Step 9: Log in on Phone 1 (e.g. seller)

1. Open the **Bazaario** app on Phone 1.
2. Log in (e.g. choose **Seller** and sign in with phone OTP, e.g. test number **9999999991** with OTP **123456** if you use test numbers).
3. Go to the seller side (dashboard / shop).

### Step 10: Log in on Phone 2 (e.g. customer)

1. Open the **Bazaario** app on Phone 2.
2. Log in as **Customer** (e.g. test number **9999999992**, OTP **123456** if you use test numbers).
3. Go to the customer side (home / explore).

### Step 11: Start a video call

**From customer side (Phone 2):**

1. Go to **Explore** or **Home** and open a **shop** that has video call (or your seller’s shop).
2. On the shop screen, tap the **video call** / **call** button (e.g. “Video call” or call icon).
3. The app should start the call (camera and mic on).

**On seller side (Phone 1):**

1. An **incoming call** screen or notification should appear.
2. Tap **Accept** (or open the app and accept the call).
3. You should see yourself and the other person; camera and mic should work.

### Step 12: Check that it works

- **Phone 1**: You see your own video and the remote video (customer).
- **Phone 2**: You see your own video and the remote video (seller).
- Try **mute**, **camera off**, and **end call** on both phones to confirm everything works.

---

## If something doesn’t work

| Problem | What to check |
|--------|-------------------------------|
| App can’t load / “Network error” | PC and both phones on same Wi‑Fi; backend running (`npm run dev`); PC IP is 172.16.2.34 on that Wi‑Fi. |
| Can’t log in | Backend running; use correct test numbers/OTP (e.g. 9999999991 / 9999999992, OTP 123456) if you use them. |
| No incoming call on seller phone | Seller app in foreground or allowed to show incoming-call UI; socket/backend and Agora config correct. |
| Video/audio not working | Allow camera and microphone when the app asks; in phone Settings → Apps → Bazaario, enable Camera and Microphone. |

---

## Quick checklist

- [ ] EAS CLI installed, `eas login` done  
- [ ] Build run: `eas build --profile preview --platform android`  
- [ ] APK downloaded from expo.dev and installed on **both** phones  
- [ ] Backend running on PC: `cd server` → `npm run dev`  
- [ ] PC and both phones on same Wi‑Fi (PC IP = 172.16.2.34)  
- [ ] Phone 1: logged in as seller  
- [ ] Phone 2: logged in as customer  
- [ ] Customer starts video call from a shop; seller accepts on the other phone  

Once all steps are done, you’ve tested the video call end-to-end on 2 Android devices.
