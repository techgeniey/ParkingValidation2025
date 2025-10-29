import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ===========================================
// CONFIGURATION
// ===========================================
const firebaseConfig = {
    apiKey: "AIzaSyDuSPZ-3f0bsS9SjrHJx9BtglbkkPi8yKY",
    authDomain: "parking-validation-5fe17.firebaseapp.com",
    databaseURL: "https://parking-validation-5fe17-default-rtdb.firebaseio.com",
    projectId: "parking-validation-5fe17",
    storageBucket: "parking-validation-5fe17.firebasestorage.app",
    messagingSenderId: "574605771807",
    appId: "1:574605771807:web:c746340352b61004e2c12a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const appContent = document.getElementById('appContent');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const scanBtn = document.getElementById('scanBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');

let allData = [];
let issuesFound = [];

// ===========================================
// AUTHENTICATION
// ===========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in - Firebase rules will enforce admin authorization
        showApp(user);
    } else {
        // User is signed out
        showLogin();
    }
});

googleSignInBtn.addEventListener('click', () => {
    signInWithPopup(auth, googleProvider).catch(error => console.error('Sign-in error', error));
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

function showApp(user) {
    loginScreen.classList.remove('visible');
    appContent.classList.add('visible');
    userEmail.textContent = `관리자: ${user.email}`;
}

function showLogin() {
    appContent.classList.remove('visible');
    loginScreen.classList.add('visible');
}

// ===========================================
// APP LOGIC
// ===========================================
scanBtn.addEventListener('click', async () => {
    loading.style.display = 'block';
    results.innerHTML = '';
    cleanupBtn.disabled = true;

    try {
        const snapshot = await get(ref(database, 'parkingValidation/validations'));
        allData = snapshot.val() || [];

        if (!Array.isArray(allData)) {
            allData = Object.values(allData);
        }

        findIssues();
        displayIssues();
    } catch (error) {
        console.error('Error fetching data:', error);

        // Handle permission denied errors
        if (error.code === 'PERMISSION_DENIED') {
            alert('접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.');
            signOut(auth);
            return;
        }

        results.innerHTML = '<p style="color: red;">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    } finally {
        loading.style.display = 'none';
    }
});

cleanupBtn.addEventListener('click', async () => {
    if (!confirm(`정말로 ${issuesFound.length}개의 문제를 해결하고 데이터를 정리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    loading.style.display = 'block';

    try {
        const cleanedData = getCleanedData();
        // Corrected data structure for the 'set' operation
        const dataToUpdate = {
            validations: cleanedData,
            metadata: {
                totalRecords: cleanedData.length,
                lastSync: new Date().toISOString(),
                lastModified: Date.now()
            }
        };

        await set(ref(database, 'parkingValidation'), dataToUpdate);

        results.innerHTML = `<p style="color: green; font-weight: bold;">성공적으로 데이터를 정리했습니다. ${allData.length - cleanedData.length}개의 레코드가 삭제되었습니다.</p>`;
        cleanupBtn.disabled = true;
    } catch (error) {
        console.error('Error cleaning data:', error);

        // Handle permission denied errors
        if (error.code === 'PERMISSION_DENIED') {
            alert('접근 권한이 없습니다. 관리자 계정으로 로그인해주세요.');
            signOut(auth);
            return;
        }

        results.innerHTML = '<p style="color: red;">데이터 정리 중 오류가 발생했습니다.</p>';
    } finally {
        loading.style.display = 'none';
    }
});

function findIssues() {
    const groupedByPlate = allData.reduce((acc, record) => {
        const plate = record.licensePlate;
        if (!acc[plate]) {
            acc[plate] = [];
        }
        acc[plate].push(record);
        return acc;
    }, {});

    issuesFound = [];
    for (const plate in groupedByPlate) {
        const records = groupedByPlate[plate];
        if (records.length > 1) {
            const hasValid = records.some(r => r.status === '유효' || r.status === '직원차량');
            const hasInvalid = records.some(r => r.status === '무효' || r.status === '');

            if (hasValid && hasInvalid) {
                issuesFound.push({ plate, records, type: 'Conflict' });
            } else {
                issuesFound.push({ plate, records, type: 'Duplicate' });
            }
        }
    }
}

function displayIssues() {
    if (issuesFound.length === 0) {
        results.innerHTML = '<p>데이터 무결성 검사를 통과했습니다. 발견된 문제가 없습니다.</p>';
        return;
    }

    let html = `<div class="summary">총 ${issuesFound.length}개의 차량 번호에서 문제를 발견했습니다.</div>`;
    issuesFound.forEach(({ plate, records, type }) => {
        html += `
            <div class="issue">
                <h3>차량번호: ${plate} (${type === 'Conflict' ? '상태 충돌' : '중복 레코드'})</h3>`;
        records.forEach(record => {
            const statusClass = (record.status === '유효' || record.status === '직원차량') ? 'status-valid' : 'status-invalid';
            html += `<div class="record">상태: <span class="${statusClass}">${record.status || '무효'}</span></div>`;
        });
        html += '</div>';
    });

    results.innerHTML = html;
    cleanupBtn.disabled = false;
}

function getCleanedData() {
    const plateMap = new Map();

    allData.forEach(record => {
        const plate = record.licensePlate;
        if (!plate) return; // Skip records without a license plate

        const existing = plateMap.get(plate);
        const isPermanent = record.status === '직원차량'; // Assuming '직원차량' is permanent
        const isValid = record.status === '유효' || isPermanent;

        if (!existing) {
            plateMap.set(plate, record);
        } else {
            const existingIsPermanent = existing.status === '직원차량';
            const existingIsValid = existing.status === '유효' || existingIsPermanent;

            // If the new record is valid and the existing one is not, replace it.
            if (isValid && !existingIsValid) {
                plateMap.set(plate, record);
            }
            // If both are permanent, we prefer the one being processed (often the newer one in the list).
            // A more robust solution might compare timestamps if available.
            else if (isPermanent && existingIsPermanent) {
                 // Keep the existing one, assuming it's the first one encountered.
                 // Or, if lastUpdated is available, compare them:
                 if (new Date(record.lastUpdated) > new Date(existing.lastUpdated)) {
                    plateMap.set(plate, record);
                 }
            }
        }
    });

    return Array.from(plateMap.values());
}
