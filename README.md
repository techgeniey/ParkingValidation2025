# Parking Validation Web App

Real-time parking validation lookup system with event-driven architecture.

## Features

- **Real-time updates** - Instant sync when Google Forms are submitted
- **Progressive search** - Filter by last 4 digits as you type
- **Color-coded status**
  - Blue: "직원차량" (Valid employee vehicle)
  - Red: "무효" or empty (Invalid)
- **Mobile responsive** - Works on all devices
- **Offline support** - Firebase automatically caches data
- **Connection status** - Visual indicator of real-time connection

## Architecture

```
Google Forms → Google Sheets → Apps Script → Firebase → Web App
                                            (Real-time sync)
```

When a form is submitted:
1. Google Forms writes to Google Sheets
2. Apps Script trigger fires automatically
3. Script pushes data to Firebase Realtime Database
4. All connected web clients receive update **instantly**
5. UI updates without page refresh

## Files

- `index.html` - Main web app with Firebase integration
- `apps-script.js` - Google Apps Script for Sheet → Firebase sync
- `SETUP.md` - Detailed setup instructions
- `parking-validation.html` - (Legacy polling version - not needed)

## Quick Start

### 1. Firebase Setup (5 minutes)

1. Create Firebase project at https://console.firebase.google.com/
2. Enable Realtime Database (Test mode)
3. Get your Firebase config

### 2. Apps Script Setup (3 minutes)

1. Open Google Sheet → Extensions → Apps Script
2. Paste code from `apps-script.js`
3. Update `FIREBASE_URL` and `FIREBASE_SECRET`
4. Run `initialize()` function
5. Set up trigger: On form submit → `onFormSubmit`

### 3. Web App Setup (2 minutes)

1. Open `index.html`
2. Replace `firebaseConfig` (line 280) with your Firebase config
3. Deploy to web server or open locally

### 4. Test

1. Submit a test Google Form
2. Watch the web app update **instantly**
3. No page refresh needed!

## Configuration

### Google Sheet Structure

Required columns:
- `LicensePlate` - Full license plate number
- `Status` - Validation status ("직원차량" or empty/"무효")

Example:
```
| LicensePlate | Status    |
|--------------|-----------|
| 12호1234     | 직원차량  |
| 333가1245    | 무효      |
```

### Firebase Security Rules (Production)

```json
{
  "rules": {
    "parkingValidation": {
      ".read": true,
      ".write": false
    }
  }
}
```

This allows public read access but prevents unauthorized writes.

## Usage

1. Open `index.html` in browser
2. Type last 4 digits of license plate
3. See results update in real-time
4. Connection status shows live sync state

## Troubleshooting

**No real-time updates?**
- Check browser console (F12) for errors
- Verify Firebase config matches your project
- Check Apps Script execution log

**Apps Script errors?**
- Verify `FIREBASE_URL` ends with `.firebaseio.com`
- Check `FIREBASE_SECRET` is your Web API Key
- Run `testFirebaseConnection()` to diagnose

**Connection shows "disconnected"?**
- Check internet connection
- Verify Firebase database URL is correct
- Check Firebase security rules allow reading

## Performance

- **Latency**: Sub-second updates (typically <500ms)
- **Concurrent users**: Up to 100 on free tier
- **Data limit**: 10GB storage (free tier)
- **Bandwidth**: 1GB/month download (free tier)

## Development

Debug in browser console:
```javascript
debugInfo() // Shows connection status and data
```

## License

MIT

## Support

See `SETUP.md` for detailed setup instructions.
