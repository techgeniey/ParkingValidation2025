# Authentication Setup Guide

This document explains the Google Sign-In authentication system implemented in the Parking Validation application.

---

## Overview

The application uses **Firebase Authentication** with **Google Sign-In** to protect access to the parking validation system. Only whitelisted email addresses can access the application.

---

## Authorized Users

Only the following Google accounts have access:

- `taejin.yoon@gmail.com`
- `finespaceinc@gmail.com`
- `jproltd@gmail.com`

To add or remove users, edit the `ALLOWED_EMAILS` array in `index.html` (around line 513).

---

## How It Works

### User Flow:

1. **User visits the page** → Sees login screen
2. **Clicks "Google로 로그인" button** → Google authentication popup appears
3. **User signs in with Google account** → Firebase verifies credentials
4. **Email check:**
   - ✅ If email is in whitelist → Access granted, app loads
   - ❌ If email NOT in whitelist → "Access denied" message, user is signed out
5. **While logged in:**
   - User can search parking validations
   - See real-time updates
   - Logout button in top-right
6. **User closes browser:**
   - Firebase remembers login
   - Next visit → automatically logged in (no need to sign in again)

### Security:

- **Client-side check:** Email whitelist in the HTML
- **Database security:** Firebase Rules require authentication
- **Data protection:** Unauthenticated users cannot access database even if they bypass HTML

---

## Firebase Console Setup Instructions

Follow these steps to configure Firebase Authentication and Security Rules:

### **Step 1: Enable Google Sign-In Provider**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **parking-validation-5fe17**
3. Click **Authentication** in the left sidebar
4. Click **Get Started** (if authentication is not already enabled)
5. Go to the **Sign-in method** tab
6. Find **Google** in the providers list
7. Click **Google** to open settings
8. Click the **Enable** toggle switch
9. Set **Project support email** (select your email from the dropdown)
10. Click **Save**

### **Step 2: Configure Firebase Realtime Database Security Rules**

Protect your database so only authenticated users can read data:

1. Click **Realtime Database** in the left sidebar
2. Click the **Rules** tab at the top
3. Replace the existing rules with:

```json
{
  "rules": {
    "parkingValidation": {
      ".read": "auth != null",
      ".write": false
    }
  }
}
```

**What these rules do:**
- `.read`: Only authenticated users can read parking validation data
- `.write`: No one can write through the web app (only Apps Script can write)

4. Click **Publish** to apply the rules

### **Step 3: Add Authorized Domain (Required for Hosting)**

When you deploy to GitHub Pages, Netlify, or any hosting service:

1. Go to **Authentication** → **Settings** tab
2. Scroll down to **Authorized domains** section
3. Click **Add domain**
4. Add your hosting domain:
   - For GitHub Pages: `yourusername.github.io`
   - For Netlify: `your-site-name.netlify.app`
   - For custom domain: `yourdomain.com`
5. Click **Add**

**Note:** `localhost` and your Firebase hosting domain are pre-authorized by default.

---

## Testing Authentication

### Test Locally:

1. Open `index.html` in a browser
2. You should see the login screen
3. Click "Google로 로그인"
4. Sign in with one of the authorized emails
5. You should see the parking validation search interface

### Test Authorization:

1. Sign in with an **unauthorized** Google account
2. You should see: "접근 권한이 없습니다. 허가된 계정으로 로그인해주세요."
3. You will be automatically signed out

---

## Deployment Options

### Option 1: GitHub Pages (Recommended)

**Pros:**
- ✅ Free
- ✅ Easy to set up
- ✅ Works perfectly with Firebase Auth
- ✅ Simple updates (just push code)

**Setup:**
1. Push your code to a GitHub repository
2. Go to repo **Settings** → **Pages**
3. Source: Select `main` branch
4. Click **Save**
5. Your site will be at: `https://yourusername.github.io/ParkingValidation2025/`
6. Add this domain to Firebase Authorized domains (Step 3 above)

### Option 2: Netlify

**Pros:**
- ✅ Free
- ✅ Drag-and-drop deployment
- ✅ Custom domains

**Setup:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop your `index.html` file
3. Get URL like: `https://your-site-name.netlify.app`
4. Add this domain to Firebase Authorized domains (Step 3 above)

### Option 3: Firebase Hosting

**Requires Firebase CLI installation**

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Firebase Hosting domain is pre-authorized automatically.

---

## Troubleshooting

### "Popup blocked" error

**Problem:** Browser is blocking the Google Sign-In popup

**Solution:**
- Allow popups for your site
- Or use redirect mode (requires code changes)

### "Unauthorized domain" error

**Problem:** Your hosting domain is not in Firebase Authorized domains

**Solution:**
- Add your domain in Firebase Console → Authentication → Settings → Authorized domains

### User can't access data after login

**Problem:** Firebase Security Rules are too restrictive

**Solution:**
- Check your rules in Firebase Console → Realtime Database → Rules
- Ensure you have: `".read": "auth != null"`

### Email is whitelisted but access denied

**Problem:** Email not matching exactly (case-sensitive, spaces, etc.)

**Solution:**
- Check the exact email in Firebase Console → Authentication → Users
- Update the `ALLOWED_EMAILS` array in `index.html` to match exactly

---

## Managing Authorized Users

### To add a new user:

1. Open `index.html`
2. Find the `ALLOWED_EMAILS` array (around line 513)
3. Add the new email:

```javascript
const ALLOWED_EMAILS = [
    'taejin.yoon@gmail.com',
    'finespaceinc@gmail.com',
    'jproltd@gmail.com',
    'newemail@example.com'  // Add here
];
```

4. Save and redeploy

### To remove a user:

1. Open `index.html`
2. Find the `ALLOWED_EMAILS` array
3. Remove the email from the list
4. Save and redeploy

---

## Security Best Practices

### Current Implementation:

✅ Email whitelist in code
✅ Firebase Authentication required
✅ Database rules enforce authentication
✅ No write access from web app

### Additional Security (Optional):

For even stronger security, you can implement:

1. **Server-side email validation:**
   - Use Firebase Cloud Functions
   - Validate email against a database-stored whitelist

2. **Domain restrictions:**
   - Restrict to `@yourcompany.com` emails only

3. **Session timeout:**
   - Implement automatic logout after inactivity

4. **Audit logging:**
   - Log all access attempts to Firebase

---

## Architecture Summary

```
User Browser
    ↓
Google Sign-In Popup
    ↓
Firebase Authentication
    ↓
Email Whitelist Check (client-side)
    ↓
    ├─ ✅ Authorized → Load App
    │       ↓
    │   Firebase Realtime Database (protected by auth rules)
    │       ↓
    │   Display Parking Validation Data
    │
    └─ ❌ Unauthorized → Show Error & Sign Out
```

---

## Support

If you encounter issues:

1. Check browser console for error messages (F12)
2. Verify Firebase Console settings
3. Confirm email is in the whitelist
4. Check Firebase Realtime Database Rules
5. Ensure hosting domain is authorized

---

## File Locations

- **Authentication Code:** `index.html` (lines 750-830)
- **Email Whitelist:** `index.html` (lines 513-517)
- **Firebase Config:** `index.html` (lines 494-502)
- **This Guide:** `AUTH_README.md`