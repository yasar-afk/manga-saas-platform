/**
 * MANGA EDITOR PRO - SaaS Cloud Infrastructure (v4)
 * Bu dosya tüm lisans ve log sistemini buluta (Firebase) taşır.
 */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB5NM3oVRFtPMRec_Z-bFQaQhUd_xbvqRM",
    authDomain: "manga-saas.firebaseapp.com",
    databaseURL: "https://manga-saas-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "manga-saas",
    storageBucket: "manga-saas.firebasestorage.app",
    messagingSenderId: "74507743831",
    appId: "1:74507743831:web:fa432ecd9447560b32a912"
};

window.db = null;
window.useCloud = false;

// 1. Firebase Başlatma
try {
    if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.apiKey === "AIzaSyB5NM3oVRFtPMRec_Z-bFQaQhUd_xbvqRM") {
        firebase.initializeApp(FIREBASE_CONFIG);
        window.db = firebase.database();
        window.useCloud = true;
        console.log("✅ SaaS Cloud Başarıyla Bağlandı.");
    } else {
        console.warn("⚠️ Firebase ayarları yapılmamış. Yerel (localStorage) modda çalışıyor.");
    }
} catch (e) {
    console.error("❌ Bulut bağlantı hatası:", e);
}

// 2. Merkezi Lisans Doğrulama
async function cloudVerifyLicense(key) {
    const inputKey = key.trim().toUpperCase();
    const adminToken = (localStorage.getItem('manga_admin_token') || 'root').toUpperCase();
    
    // SaaS: Global Padişah Anahtarı (Case-Insensitive Destekli)
    if (inputKey === `SINIRSIZ-ADMIN-${adminToken}`) {
        return { type: 'SINIRSIZ-ADMIN', used: 0, limit: 999999, engine: 'all', isAdmin: true };
    }

    if (!useCloud) {
        // Yerel Mod (LocalStorage)
        const localDb = JSON.parse(localStorage.getItem('manga_saas_db') || '{}');
        return localDb[key] || null;
    }

    // Bulut Modu (Firebase)
    try {
        const snapshot = await window.db.ref(`licenses/${key}`).once('value');
        return snapshot.val();
    } catch (e) {
        console.error("Lisans sorgulama hatası:", e);
        return null;
    }
}

// 3. Merkezi Kredi Tüketimi
async function cloudConsumeCredit(key) {
    if (!useCloud) {
        const localDb = JSON.parse(localStorage.getItem('manga_saas_db') || '{}');
        if (localDb[key] && localDb[key].used < localDb[key].limit) {
            localDb[key].used++;
            localStorage.setItem('manga_saas_db', JSON.stringify(localDb));
            return true;
        }
        return (key.startsWith('SINIRSIZ-ADMIN'));
    }

    // Bulut Modu
    try {
        const ref = window.db.ref(`licenses/${key}`);
        const snapshot = await ref.once('value');
        const data = snapshot.val();
        if (data && data.used < data.limit) {
            await ref.update({ used: data.used + 1 });
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// 4. Merkezi Loglama (NSFW dahil)
async function cloudLogEvent(type, message, evidence = null) {
    const logData = {
        type,
        message,
        evidence, // base64 image (opsiyonel)
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };

    if (!useCloud) {
        const logs = JSON.parse(localStorage.getItem('manga_admin_logs') || '[]');
        logs.unshift(logData);
        if (logs.length > 200) logs.pop(); // Hafıza koruması
        localStorage.setItem('manga_admin_logs', JSON.stringify(logs));
        return;
    }

    // Bulut Modu
    try {
        await window.db.ref('logs').push(logData);
        // İstatistikleri güncelle
        if (type === 'SUCCESS') window.db.ref('stats/totalPages').transaction(curr => (curr || 0) + 1);
        if (type === 'NSFW_DETECTED') window.db.ref('stats/nsfwCount').transaction(curr => (curr || 0) + 1);
    } catch (e) {
        console.error("Bulut loglama hatası:", e);
    }
}

// 5. Sistem Ayarları (API Keyleri vb.) Buluttan Çekme
async function cloudGetSystemSettings() {
    if (!useCloud) {
        return {
            gemini_keys: localStorage.getItem('manga_edit_api_keys') || "",
            grok_key: localStorage.getItem('manga_grok_key') || ""
        };
    }
    try {
        const snap = await window.db.ref('settings').once('value');
        const settings = snap.val() || {};
        
        // 🔒 HARDCODED FALLBACK: Bulutta veri yoksa veya hata varsa bu anahtarı kullan
        if (!settings.gemini_keys) {
            settings.gemini_keys = "AIzaSyCURFhB8fEvKzVpN7J6p5SMyj7tAfRXvNw";
        }
        
        return settings;
    } catch (e) {
        console.error("Ayar çekme hatası:", e);
        return {};
    }
}

async function cloudUpdateSystemSettings(settings) {
    if (!useCloud) {
        if(settings.gemini_keys) localStorage.setItem('manga_edit_api_keys', settings.gemini_keys);
        if(settings.grok_key) localStorage.setItem('manga_grok_key', settings.grok_key);
        return;
    }
    try {
        await window.db.ref('settings').update(settings);
    } catch (e) {
        console.error("Bulut ayar güncelleme hatası:", e);
    }
}
