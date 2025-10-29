# Parking Validation App - Setup Instructions

## Architecture Overview

This app uses **real-time event-driven architecture**:

```
Google Forms → Google Sheets → Apps Script → Firebase Realtime DB → HTML App (instant updates)
```

## Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "parking-validation" (or your choice)
4. Disable Google Analytics (not needed)
5. Click "Create project"

### 2. Set Up Firebase Realtime Database

1. In Firebase Console, click "Realtime Database" in left menu
2. Click "Create Database"
3. Choose location closest to you
4. Start in **"Test mode"** (we'll secure it later)
5. Click "Enable"

### 3. Get Firebase Configuration

1. In Firebase Console, click the gear icon → "Project settings"
2. Scroll down to "Your apps" section
3. Click the web icon `</>`
4. Register app with nickname: "parking-validation-web"
5. Copy the `firebaseConfig` object - you'll need this!

It looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 4. Set Up Google Apps Script

1. Open your Google Sheet
2. Click **Extensions → Apps Script**
3. Delete any default code
4. Copy the code from `apps-script.js` in this folder
5. **IMPORTANT:** Update the Firebase configuration:
   - Line 2: Set your `FIREBASE_URL` (from databaseURL above)
   - Line 3: Set your `FIREBASE_SECRET` (from Web API Key)
6. Save the script (Ctrl+S or File → Save)
7. Name it "Parking Validation Sync"

### 5. Set Up Triggers

1. In Apps Script editor, click the **clock icon** (Triggers) in left sidebar
2. Click "+ Add Trigger" (bottom right)
3. Configure:
   - Function: `syncToFirebase`
   - Event source: "From spreadsheet"
   - Event type: "On form submit"
4. Click "Save"
5. Authorize the script when prompted

### 6. Initial Data Sync

1. In Apps Script editor, select `syncToFirebase` from dropdown
2. Click "Run" button
3. This will push all current data to Firebase
4. Check Firebase Console → Realtime Database to verify data appears

### 7. Configure HTML App

1. Open `index.html`
2. Find the `firebaseConfig` object (around line 504)
3. Replace it with YOUR Firebase config from Step 3
4. Save the file
5. Repeat for `my-submissions.html` and `admin/script.js` if using those features

### 8. Security Rules (Production)

Once everything works, secure your Firebase:

1. Go to Firebase Console → Realtime Database → Rules
2. Replace with:

```json
{
  "rules": {
    "validations": {
      ".read": true,
      ".write": false
    }
  }
}
```

This allows public read (for the app) but prevents unauthorized writes.

## Testing

1. Open `index.html` in browser
2. Sign in with Google (must be an authorized email in Firebase Rules)
3. Submit a test form entry in Google Forms
4. Watch the HTML app update **instantly** without refresh
5. Open browser console (F12) to see Firebase connection status

## How It Works

1. **Google Form Submit** → Triggers Apps Script
2. **Apps Script** → Reads sheet data and writes to Firebase
3. **Firebase** → Pushes update event to all connected clients
4. **HTML App** → Listens to Firebase, updates UI in real-time
5. **Offline Mode** → Firebase caches data locally for offline access

## Troubleshooting

**No real-time updates?**
- Check browser console for errors
- Verify Firebase config in HTML matches your project
- Check Apps Script execution log (View → Executions)

**Apps Script errors?**
- Verify FIREBASE_URL and FIREBASE_SECRET are correct
- Check Apps Script execution permissions

**Firebase permission denied?**
- Check Security Rules allow `.read: true`
- Verify databaseURL is correct

## Cost

- Firebase Spark Plan (Free):
  - 10GB storage
  - 100 simultaneous connections
  - 1GB/month download

More than enough for this use case!
