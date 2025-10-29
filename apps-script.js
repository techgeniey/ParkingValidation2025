/*
 *********************** Firestore handling routine ********************
 */
// ============================================
// FIREBASE CONFIGURATION - UPDATE THESE!
// ============================================
const FIREBASE_URL = 'https://parking-validation-5fe17-default-rtdb.firebaseio.com'; // Your Firebase Realtime Database URL

// Requires Apps Script Properties of FirebaseSecret to be set for the firebase realtime db secret key.
// To get that console.firebase.google.com -> Project -> Project Settings -> Service Accounts -> Database secrets.
//

// Get secret from Script Properties (not hardcoded!)
function getFirebaseSecret() {
  const scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('FirebaseSecret');
}

// Google Sheet configuration
const SHEET_NAME = 'ValidationsTab';

/**
 * Main function to sync Google Sheet data to Firebase
 * Triggered on form submit or can be run manually
 */
function syncToFirebase() {
  try {
    Logger.log('Starting Firebase sync...');

    // Get the sheet data
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found!`);
    }

    // Get all data from the sheet
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (values.length <= 1) {
      Logger.log('No data to sync (only header row exists)');
      return;
    }

    // Parse the data
    const validations = [];
    const headers = values[0]; // First row is headers

    // Find column indices
    const licensePlateCol = headers.indexOf('LicensePlate');
    const statusCol = headers.indexOf('Status');
    const userIdCol = headers.indexOf('UserID');

    if (licensePlateCol === -1 || statusCol === -1 || userIdCol === -1) {
      throw new Error('Required columns "LicensePlate", "Status", and "UserID" not found!');
    }

    // Process each row (skip header)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const licensePlate = String(row[licensePlateCol] || '').trim();
      const status = String(row[statusCol] || '').trim();
      const userId = String(row[userIdCol] || '').trim();

      if (licensePlate) {
        validations.push({
          licensePlate: licensePlate,
          status: status,
          userId: userId,
          rowIndex: i + 1, // 1-based row number
          lastUpdated: new Date().toISOString()
        });
      }
    }

    Logger.log(`Processed ${validations.length} validation records`);

    // Prepare the data structure for Firebase
    const firebaseData = {
      validations: validations,
      metadata: {
        totalRecords: validations.length,
        lastSync: new Date().toISOString(),
        source: 'google-sheets'
      }
    };

    // Write to Firebase
    writeToFirebase(firebaseData);

    Logger.log('Firebase sync completed successfully!');

  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Writes data to Firebase Realtime Database
 */
function writeToFirebase(data) {
  const firebase_secret = getFirebaseSecret(); // Your Firebase Web API Key

  if (!firebase_secret) {
      Logger.log('ERROR: Firebase secret not found in Script Properties!');
      return false;
  }

  const url = `${FIREBASE_URL}/parkingValidation.json?auth=${firebase_secret}`;

  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(`Firebase write failed with status ${responseCode}: ${response.getContentText()}`);
  }

  Logger.log('Data written to Firebase successfully');

  // Also update a separate "lastUpdate" timestamp for quick polling
  updateLastModifiedTimestamp();
}

/**
 * Updates a timestamp in Firebase to signal data changes
 */
function updateLastModifiedTimestamp() {
  const firebase_secret = getFirebaseSecret(); // Your Firebase Web API Key

  if (!firebase_secret) {
      Logger.log('ERROR: Firebase secret not found in Script Properties!');
      return false;
  }
  const url = `${FIREBASE_URL}/parkingValidation/metadata/lastModified.json?auth=${firebase_secret}`;

  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(Date.now()),
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch(url, options);
}

/**
 * Function to test Firebase connection
 * Run this manually to verify your configuration
 */
function testFirebaseConnection() {
  try {
    Logger.log('Testing Firebase connection...');

    const firebase_secret = getFirebaseSecret();

    const testUrl = `${FIREBASE_URL}/.json?auth=${firebase_secret}`;

    const options = {
      method: 'get',
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(testUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log('✓ Firebase connection successful!');
      Logger.log(`Response: ${response.getContentText()}`);
      return true;
    } else {
      Logger.log(`✗ Firebase connection failed with status ${responseCode}`);
      Logger.log(`Response: ${response.getContentText()}`);
      return false;
    }

  } catch (error) {
    Logger.log(`✗ Firebase connection error: ${error.message}`);
    return false;
  }
}

/**
 * Trigger function that runs on form submit
 * This is the function you should set up in the trigger
 */
function onFormSubmit(e) {
  Logger.log('Form submitted - triggering sync');
  syncToFirebase();
}

/**
 * Initialize: Sets up the required structure
 * Run this once after setting up the script
 */
function initialize() {
  Logger.log('Initializing...');

  // Test connection
  if (testFirebaseConnection()) {
    Logger.log('Connection test passed');

    // Perform initial sync
    Logger.log('Performing initial data sync...');
    syncToFirebase();

    Logger.log('Initialization complete!');
    Logger.log('Next steps:');
    Logger.log('1. Set up the onFormSubmit trigger');
    Logger.log('2. Test by submitting a form');
  } else {
    Logger.log('Initialization failed - fix Firebase configuration first');
  }
}

/**
 * Manual trigger for testing
 * You can run this from the Apps Script editor
 */
function manualSync() {
  Logger.log('=== Manual Sync Started ===');
  syncToFirebase();
  Logger.log('=== Manual Sync Completed ===');
}

/****************************************************************
 * WEB APP for USER-SPECIFIC DATA
 * - Deployed as a Web App to be called from the client.
 * - Returns submissions for a specific UserID.
 ****************************************************************/

/**
 * Handles HTTP GET requests to the script.
 * @param {Object} e - The event parameter containing request details.
 * e.g. ?user_id=user@example.com
 * @returns {ContentService.TextOutput} JSON string of user's records.
 */
function doGet(e) {
  let results = [];
  try {
    const userId = e.parameter.user_id;

    if (!userId) {
      throw new Error("user_id parameter is missing.");
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found.`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const userIdCol = headers.indexOf('UserID');
    const licensePlateCol = headers.indexOf('LicensePlate');
    const statusCol = headers.indexOf('Status');

    if (userIdCol === -1 || licensePlateCol === -1 || statusCol === -1) {
      throw new Error("Required column not found. Ensure 'UserID', 'LicensePlate', and 'Status' columns exist.");
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][userIdCol] == userId) {
        results.push({
          licensePlate: data[i][licensePlateCol],
          status: data[i][statusCol]
        });
      }
    }

  } catch (error) {
    Logger.log(error.toString());
    // Return a structured error object
    results = { error: true, message: error.message };
  }

  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}

/****************************************************************
 * CUSTOM MENU AND FORCE SYNC WITH CLEANING
 ****************************************************************/

/**
 * Creates a custom menu in Google Sheets when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚗 Parking Sync')
      .addItem('Manual Sync to Firebase', 'manualSync')
      .addItem('Force Sync with Cleaning', 'forceSyncWithCleaning')
      .addSeparator()
      .addItem('Test Firebase Connection', 'testFirebaseConnection')
      .addToUi();
}

/**
 * Force sync from Google Sheets with data cleaning
 * Removes duplicates and resolves conflicts before syncing to Firebase
 * COMPLETELY WIPES Firebase and replaces with cleaned Google Sheets data
 */
function forceSyncWithCleaning() {
  try {
    Logger.log('Starting force sync with cleaning...');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found!`);
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (values.length <= 1) {
      Logger.log('No data to sync (only header row exists)');
      SpreadsheetApp.getUi().alert('No data to sync');
      return;
    }

    const headers = values[0];
    const licensePlateCol = headers.indexOf('LicensePlate');
    const statusCol = headers.indexOf('Status');
    const userIdCol = headers.indexOf('UserID');

    if (licensePlateCol === -1 || statusCol === -1 || userIdCol === -1) {
      throw new Error('Required columns "LicensePlate", "Status", and "UserID" not found!');
    }

    // Parse all data from sheet
    const allData = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const licensePlate = String(row[licensePlateCol] || '').trim();
      const status = String(row[statusCol] || '').trim();
      const userId = String(row[userIdCol] || '').trim();

      if (licensePlate) {
        allData.push({
          licensePlate: licensePlate,
          status: status,
          userId: userId,
          rowIndex: i + 1,
          lastUpdated: new Date().toISOString()
        });
      }
    }

    Logger.log(`Fetched ${allData.length} records from sheet`);

    // Apply cleaning logic
    const cleanedData = cleanDuplicates(allData);

    Logger.log(`Cleaned data: ${allData.length} -> ${cleanedData.length} records`);

    // Prepare Firebase data structure
    const firebaseData = {
      validations: cleanedData,
      metadata: {
        totalRecords: cleanedData.length,
        lastSync: new Date().toISOString(),
        lastModified: Date.now(),
        source: 'google-sheets-force-sync'
      }
    };

    // Write to Firebase (complete wipe and replace)
    writeToFirebase(firebaseData);

    Logger.log('Force sync with cleaning completed successfully!');

    // Show success message in Google Sheets UI
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Sync Complete',
      `Successfully synced to Firebase!\n\n` +
      `Original records: ${allData.length}\n` +
      `After cleaning: ${cleanedData.length}\n` +
      `Removed duplicates: ${allData.length - cleanedData.length}`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
    throw error;
  }
}

/**
 * Clean duplicates using same logic as admin panel
 * Keeps one record per license plate, preferring:
 * 1. Valid status over invalid
 * 2. Permanent (직원차량) over temporary (유효)
 * 3. Newer records over older (by lastUpdated timestamp)
 */
function cleanDuplicates(allData) {
  const plateMap = new Map();

  allData.forEach(record => {
    const plate = record.licensePlate;
    if (!plate) return; // Skip records without a license plate

    const existing = plateMap.get(plate);
    const isPermanent = record.status === '직원차량';
    const isValid = record.status === '유효' || isPermanent;

    if (!existing) {
      plateMap.set(plate, record);
    } else {
      const existingIsPermanent = existing.status === '직원차량';
      const existingIsValid = existing.status === '유효' || existingIsPermanent;

      // Prefer valid over invalid
      if (isValid && !existingIsValid) {
        plateMap.set(plate, record);
      }
      // If both permanent, prefer newer
      else if (isPermanent && existingIsPermanent) {
        if (new Date(record.lastUpdated) > new Date(existing.lastUpdated)) {
          plateMap.set(plate, record);
        }
      }
    }
  });

  return Array.from(plateMap.values());
}