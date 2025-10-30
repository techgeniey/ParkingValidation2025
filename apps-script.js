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

// Debug logging flag - set to true to enable detailed trace logs
const ENABLE_TRACE_LOGGING = true;

/**
 * Helper function for trace logging
 */
function traceLog(message, data) {
  if (ENABLE_TRACE_LOGGING) {
    Logger.log(`[TRACE] ${message}`);
    if (data !== undefined) {
      Logger.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Clean duplicates helper function
 * Keeps one record per license plate, preferring:
 * 1. Permanent (영구) over temporary (유효) when both are valid
 * 2. Valid status over invalid
 * 3. Newer records over older (by lastUpdated timestamp)
 */
function cleanDuplicates(allData) {
  traceLog('=== cleanDuplicates START ===');
  traceLog(`Total records to process: ${allData.length}`);

  const plateMap = new Map();

  allData.forEach((record, index) => {
    const plate = record.licensePlate;
    if (!plate) {
      traceLog(`Record ${index}: SKIPPED (no license plate)`, record);
      return; // Skip records without a license plate
    }

    const existing = plateMap.get(plate);
    const isPermanent = record.status === '영구';
    const isValid = record.status === '유효' || isPermanent;

    traceLog(`\nRecord ${index}: Processing plate "${plate}"`, {
      licensePlate: record.licensePlate,
      status: record.status,
      userId: record.userId,
      rowIndex: record.rowIndex,
      lastUpdated: record.lastUpdated,
      isPermanent: isPermanent,
      isValid: isValid
    });

    if (!existing) {
      traceLog(`  -> ADDED (first occurrence)`);
      plateMap.set(plate, record);
    } else {
      const existingIsPermanent = existing.status === '영구';
      const existingIsValid = existing.status === '유효' || existingIsPermanent;

      traceLog(`  -> DUPLICATE FOUND. Existing record:`, {
        licensePlate: existing.licensePlate,
        status: existing.status,
        userId: existing.userId,
        rowIndex: existing.rowIndex,
        lastUpdated: existing.lastUpdated,
        isPermanent: existingIsPermanent,
        isValid: existingIsValid
      });

      // Priority 1: Permanent always beats temporary (when both valid)
      if (isPermanent && !existingIsPermanent && isValid && existingIsValid) {
        traceLog(`  -> REPLACED (Priority 1: New permanent beats existing temporary)`);
        plateMap.set(plate, record);
      }
      // Priority 2: Valid over invalid
      else if (isValid && !existingIsValid) {
        traceLog(`  -> REPLACED (Priority 2: New valid beats existing invalid)`);
        plateMap.set(plate, record);
      }
      // Priority 3: If both permanent, prefer newer
      else if (isPermanent && existingIsPermanent) {
        if (new Date(record.lastUpdated) > new Date(existing.lastUpdated)) {
          traceLog(`  -> REPLACED (Priority 3: Both permanent, new is newer)`);
          plateMap.set(plate, record);
        } else {
          traceLog(`  -> KEPT EXISTING (Priority 3: Both permanent, existing is newer or same)`);
        }
      }
      // Priority 4: If both temporary valid, prefer newer
      else if (!isPermanent && !existingIsPermanent && isValid && existingIsValid) {
        if (new Date(record.lastUpdated) > new Date(existing.lastUpdated)) {
          traceLog(`  -> REPLACED (Priority 4: Both temporary valid, new is newer)`);
          plateMap.set(plate, record);
        } else {
          traceLog(`  -> KEPT EXISTING (Priority 4: Both temporary valid, existing is newer or same)`);
        }
      }
      // Note: If existing is permanent and new is temporary, we keep existing (no action)
      else {
        traceLog(`  -> KEPT EXISTING (No replacement condition met - likely existing permanent vs new temporary)`);
      }
    }
  });

  const result = Array.from(plateMap.values());
  traceLog('\n=== cleanDuplicates END ===');
  traceLog(`Final cleaned records: ${result.length}`);
  traceLog('Final records:', result);

  return result;
}

/**
 * Main function to sync Google Sheet data to Firebase
 * Triggered on form submit or can be run manually
 * Automatically cleans duplicates before syncing
 */
function syncToFirebase() {
  try {
    Logger.log('Starting Firebase sync...');
    traceLog('=== syncToFirebase START ===');

    // Get the sheet data
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found!`);
    }

    // Get all data from the sheet
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    traceLog(`Read ${values.length} rows from spreadsheet (including header)`);

    if (values.length <= 1) {
      Logger.log('No data to sync (only header row exists)');
      traceLog('No data to sync');
      return;
    }

    // Parse the data
    const validations = [];
    const headers = values[0]; // First row is headers
    traceLog('Spreadsheet headers:', headers);

    // Find column indices
    const licensePlateCol = headers.indexOf('LicensePlate');
    const statusCol = headers.indexOf('Status');
    const userIdCol = headers.indexOf('UserID');

    traceLog(`Column indices: LicensePlate=${licensePlateCol}, Status=${statusCol}, UserID=${userIdCol}`);

    if (licensePlateCol === -1 || statusCol === -1 || userIdCol === -1) {
      throw new Error('Required columns "LicensePlate", "Status", and "UserID" not found!');
    }

    // Process each row (skip header)
    traceLog('\n=== Reading all rows from spreadsheet ===');
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const licensePlate = String(row[licensePlateCol] || '').trim();
      const status = String(row[statusCol] || '').trim();
      const userId = String(row[userIdCol] || '').trim();

      if (licensePlate) {
        const record = {
          licensePlate: licensePlate,
          status: status,
          userId: userId,
          rowIndex: i + 1, // 1-based row number
          lastUpdated: new Date().toISOString()
        };
        validations.push(record);
        traceLog(`Row ${i + 1}:`, record);
      } else {
        traceLog(`Row ${i + 1}: SKIPPED (no license plate)`);
      }
    }

    Logger.log(`Processed ${validations.length} validation records`);
    traceLog(`\nTotal records read from spreadsheet: ${validations.length}`);

    // Clean duplicates before syncing
    const cleanedData = cleanDuplicates(validations);
    Logger.log(`After cleaning: ${validations.length} -> ${cleanedData.length} records (removed ${validations.length - cleanedData.length} duplicates)`);

    // Prepare the data structure for Firebase
    const firebaseData = {
      validations: cleanedData,
      metadata: {
        totalRecords: cleanedData.length,
        lastSync: new Date().toISOString(),
        source: 'google-sheets'
      }
    };

    traceLog('\n=== Data prepared for Firebase ===');
    traceLog('Complete Firebase data structure:', firebaseData);

    // Write to Firebase
    writeToFirebase(firebaseData);

    Logger.log('Firebase sync completed successfully!');
    traceLog('=== syncToFirebase END ===');

  } catch (error) {
    Logger.log(`ERROR: ${error.message}`);
    Logger.log(error.stack);
    traceLog(`ERROR: ${error.message}`);
    throw error;
  }
}

/**
 * Writes data to Firebase Realtime Database
 */
function writeToFirebase(data) {
  traceLog('=== writeToFirebase START ===');
  traceLog('Data being written to Firebase:', data);

  const firebase_secret = getFirebaseSecret(); // Your Firebase Web API Key

  if (!firebase_secret) {
      Logger.log('ERROR: Firebase secret not found in Script Properties!');
      traceLog('ERROR: Firebase secret not found');
      return false;
  }

  const url = `${FIREBASE_URL}/parkingValidation.json?auth=${firebase_secret}`;
  traceLog(`Writing to Firebase URL: ${FIREBASE_URL}/parkingValidation.json`);

  const payload = JSON.stringify(data);
  traceLog(`Payload size: ${payload.length} characters`);

  const options = {
    method: 'put',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  traceLog(`Firebase response code: ${responseCode}`);

  if (responseCode !== 200) {
    const errorText = response.getContentText();
    traceLog(`Firebase write FAILED: ${errorText}`);
    throw new Error(`Firebase write failed with status ${responseCode}: ${errorText}`);
  }

  Logger.log('Data written to Firebase successfully');
  traceLog('Firebase write SUCCESS');
  traceLog('=== writeToFirebase END ===');

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
  traceLog('=== onFormSubmit TRIGGERED ===');
  traceLog('Form submission event data:', e);
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
    traceLog('=== forceSyncWithCleaning START ===');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found!`);
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    traceLog(`Read ${values.length} rows from spreadsheet (including header)`);

    if (values.length <= 1) {
      Logger.log('No data to sync (only header row exists)');
      traceLog('No data to sync');
      SpreadsheetApp.getUi().alert('No data to sync');
      return;
    }

    const headers = values[0];
    traceLog('Spreadsheet headers:', headers);

    const licensePlateCol = headers.indexOf('LicensePlate');
    const statusCol = headers.indexOf('Status');
    const userIdCol = headers.indexOf('UserID');

    traceLog(`Column indices: LicensePlate=${licensePlateCol}, Status=${statusCol}, UserID=${userIdCol}`);

    if (licensePlateCol === -1 || statusCol === -1 || userIdCol === -1) {
      throw new Error('Required columns "LicensePlate", "Status", and "UserID" not found!');
    }

    // Parse all data from sheet
    const allData = [];
    traceLog('\n=== Reading all rows from spreadsheet ===');
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const licensePlate = String(row[licensePlateCol] || '').trim();
      const status = String(row[statusCol] || '').trim();
      const userId = String(row[userIdCol] || '').trim();

      if (licensePlate) {
        const record = {
          licensePlate: licensePlate,
          status: status,
          userId: userId,
          rowIndex: i + 1,
          lastUpdated: new Date().toISOString()
        };
        allData.push(record);
        traceLog(`Row ${i + 1}:`, record);
      } else {
        traceLog(`Row ${i + 1}: SKIPPED (no license plate)`);
      }
    }

    Logger.log(`Fetched ${allData.length} records from sheet`);
    traceLog(`\nTotal records read from spreadsheet: ${allData.length}`);

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

    traceLog('\n=== Data prepared for Firebase ===');
    traceLog('Complete Firebase data structure:', firebaseData);

    // Write to Firebase (complete wipe and replace)
    writeToFirebase(firebaseData);

    Logger.log('Force sync with cleaning completed successfully!');
    traceLog('=== forceSyncWithCleaning END ===');

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
    traceLog(`ERROR: ${error.message}`);
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
    throw error;
  }
}