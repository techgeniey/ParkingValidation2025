# Authentication Setup Guide

This document explains the Google Sign-In authentication system implemented in the Parking Validation application.

---

## Overview

The application uses **Firebase Authentication** with **Google Sign-In** to protect access to the parking validation system. Only whitelisted email addresses can access the application.

---

## Authorized Users

Access is controlled via **Firebase Security Rules** (server-side), not client code.

Example authorized users:
- `admin@example.com`
- `user1@example.com`
- `user2@example.com`

To add or remove users, update the Firebase Security Rules in Firebase Console → Realtime Database → Rules.

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

- **Server-side authorization:** Email whitelist enforced by Firebase Security Rules
- **Database security:** Firebase Rules check authentication AND email address
- **Data protection:** Impossible to bypass - authorization is server-side only
- **Privacy:** No email addresses exposed in public client code

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

Protect your database with email-based authorization:

1. Click **Realtime Database** in the left sidebar
2. Click the **Rules** tab at the top
3. Replace the existing rules with:

```json
{
  "rules": {
    "parkingValidation": {
      ".read": "auth != null && (
        auth.token.email == 'admin@example.com' ||
        auth.token.email == 'user1@example.com' ||
        auth.token.email == 'user2@example.com'
      )",
      ".write": "auth != null && (
        auth.token.email == 'admin@example.com'
      )",
      "validations": {
        ".indexOn": ["userId"]
      }
    }
  }
}
```

**What these rules do:**
- `.read`: Only specific authenticated emails can read data
- `.write`: Only admin emails can write (for admin panel data cleanup)
- `.indexOn`: Creates index for efficient userId queries
- **Replace example emails with your actual authorized email addresses**

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

**Problem:** Email not matching exactly in Firebase Rules (case-sensitive, spaces, etc.)

**Solution:**
- Check the exact email in Firebase Console → Authentication → Users
- Update the Firebase Security Rules in Realtime Database → Rules to match exactly

---

## Managing Authorized Users

Authorization is managed through **Firebase Security Rules** (server-side), not client code.

### To add a new user:

1. Go to Firebase Console → Realtime Database → Rules
2. Add the new email to the `.read` rule:

```json
".read": "auth != null && (
  auth.token.email == 'admin@example.com' ||
  auth.token.email == 'user1@example.com' ||
  auth.token.email == 'user2@example.com' ||
  auth.token.email == 'newuser@example.com'  // Add here
)",
```

3. Click **Publish**
4. New user can access immediately (no code deployment needed)

### To remove a user:

1. Go to Firebase Console → Realtime Database → Rules
2. Remove the email line from the `.read` rule
3. Click **Publish**
4. User access is revoked immediately

---

## Security Best Practices

### Current Implementation:

✅ **Server-side authorization** - Email whitelist enforced by Firebase Security Rules
✅ **Firebase Authentication** required
✅ **No PII exposure** - Email addresses hidden from client code
✅ **Impossible to bypass** - Authorization enforced server-side only
✅ **Admin-only write access** - Only specific emails can modify data

### Additional Security (Optional):

For even stronger security, you can implement:

1. **Domain restrictions:**
   - Restrict to `@yourcompany.com` emails only in Firebase Rules:
   ```json
   ".read": "auth != null && auth.token.email.matches(/.*@yourcompany\\.com$/)"
   ```

2. **Session timeout:**
   - Implement automatic logout after inactivity

3. **Audit logging:**
   - Use Firebase Cloud Functions to log all access attempts

4. **Multi-factor authentication:**
   - Enable in Firebase Console → Authentication → Sign-in method

---

## Architecture Summary

```
User Browser
    ↓
Google Sign-In Popup
    ↓
Firebase Authentication (user authenticated)
    ↓
User requests data from Firebase Realtime Database
    ↓
Firebase Security Rules Check (SERVER-SIDE)
    ├─ Check: auth != null?
    ├─ Check: email in whitelist?
    ↓
    ├─ ✅ AUTHORIZED (both checks pass)
    │       ↓
    │   Return Parking Validation Data
    │       ↓
    │   Display in Browser
    │
    └─ ❌ PERMISSION_DENIED (any check fails)
            ↓
        Error returned to browser
            ↓
        User sees "Access denied" → Signed out
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

- **Authentication Code:** `index.html` (Firebase Auth integration)
- **Email Whitelist:** Firebase Console → Realtime Database → Rules (server-side)
- **Firebase Config:** `index.html`, `admin/script.js`, `my-submissions.html`
- **This Guide:** `AUTH_README.md`
- **Admin Panel:** `admin/index.html` and `admin/script.js`