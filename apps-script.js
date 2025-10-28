/*
 *********************** Firestore handling routine ********************
 */
// ============================================
// FIREBASE CONFIGURATION - UPDATE THESE!
// ============================================
const FIREBASE_URL = 'https://parking-validation-5fe17-default-rtdb.firebaseio.com'; // Your Firebase Realtime Database URL

// Requires Apps Script Properties of FiorebaseSecret to be set for the firebase realtime db secret key.
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

    if (licensePlateCol === -1 || statusCol === -1) {
      throw new Error('Required columns "LicensePlate" and "Status" not found!');
    }

    // Process each row (skip header)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const licensePlate = String(row[licensePlateCol] || '').trim();
      const status = String(row[statusCol] || '').trim();

      if (licensePlate) {
        validations.push({
          licensePlate: licensePlate,
          status: status,
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
