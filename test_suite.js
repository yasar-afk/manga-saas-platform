// ==========================================
// MANGA EDITOR PRO - OTOMASYON TESTLERİ
// ==========================================

function logTest(msg, type = 'info') {
    const box = document.getElementById('test-logs');
    const colorClass = type === 'error' ? 'log-error' : (type === 'warn' ? 'log-warn' : (type === 'success' ? 'success' : 'log-info'));
    const time = new Date().toLocaleTimeString('tr-TR');
    box.innerHTML += `<div class="${colorClass}">[${time}] ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
}

function clearLogs() {
    document.getElementById('test-logs').innerHTML = '';
}

// 1. JSON Parse System Testi (En son hata aldığımız yer)
function parseRobustJSON(text) {
    if (!text) throw new Error("Boş");
    try {
        let clean = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            let extracted = jsonMatch[0].replace(/,\s*([\}\]])/g, '$1');
            return JSON.parse(extracted);
        }
        throw new Error("Parse Fail");
    }
}

async function runAllTests() {
    clearLogs();
    document.getElementById('run-all-tests').disabled = true;
    logTest("🚀 Kapsamlı Sistem Testleri Başlatılıyor...", "info");

    try {
        // --- TEST 1: Array Parsing ---
        logTest("⏳ Test 1/4: Qwen/Gemini Dizi (Array) Parse Kontrolü...", "info");
        const dummyArrayResponse = "```json\n[{\"id\":1, \"original\":\"Test\", \"translated\":\"Deneme\", \"box\":{\"x\":10,\"y\":10,\"w\":20,\"h\":10}}]\n```";
        const parsedArray = parseRobustJSON(dummyArrayResponse);
        let finalDetectedTexts = Array.isArray(parsedArray) ? parsedArray : (parsedArray.translations || []);
        if (finalDetectedTexts.length === 1 && finalDetectedTexts[0].translated === "Deneme") {
            logTest("✅ Test 1 Başarılı: Array formatı başarıyla algılandı ve translations listesine kaybolmadan eklendi.", "success");
        } else {
            throw new Error("Test 1 Başarısız: Liste boş kaldı.");
        }

        // --- TEST 2: Object Parsing ---
        logTest("⏳ Test 2/4: Standart Obje (Object) Parse Kontrolü...", "info");
        const dummyObjResponse = "{\"is_nsfw\":false, \"translations\": [{\"id\":1, \"original\":\"Test2\", \"translated\":\"Deneme2\", \"box\":{}}]}";
        const parsedObj = parseRobustJSON(dummyObjResponse);
        let finalDetectedTexts2 = Array.isArray(parsedObj) ? parsedObj : (parsedObj.translations || []);
        if (finalDetectedTexts2.length === 1 && finalDetectedTexts2[0].translated === "Deneme2") {
            logTest("✅ Test 2 Başarılı: Object formatı ve içindeki array başarıyla çıkarıldı.", "success");
        } else {
            throw new Error("Test 2 Başarısız: Object boş atandı.");
        }

        // --- TEST 3: Lisans Kota Sistemi (Yerel) ---
        logTest("⏳ Test 3/4: Lisans Anahtarı Kota (Credit) Düzenlemesi...", "info");
        // LocalStorage'a sahte veri göm
        const testMangaDB = { "DEMO-KEY": { limit: 2, used: 0, engine: "gemini" } };
        localStorage.setItem('manga_saas_db', JSON.stringify(testMangaDB));
        
        // Kredi harcama simülasyonu
        let isSuccess = await cloudConsumeCredit("DEMO-KEY");
        if (isSuccess) {
            const dbCheck = JSON.parse(localStorage.getItem('manga_saas_db'));
            if (dbCheck["DEMO-KEY"].used === 1) {
                logTest("✅ Test 3 Başarılı: Kredi 0'dan 1'e başarıyla düştü.", "success");
            } else {
                throw new Error("Test 3 Başarısız: Kredi miktarı veritabanında güncellenmedi.");
            }
        } else {
            throw new Error("Test 3 Başarısız: Kota olduğu halde reddedildi.");
        }

        // --- TEST 4: Sınırsız Patron Anahtarı ---
        logTest("⏳ Test 4/4: ULTIMATE-PRO Master Key Özel Kontrolü...", "info");
        let bypassSuccess = await cloudConsumeCredit("ULTIMATE-PRO-2026");
        if (bypassSuccess) {
            logTest("✅ Test 4 Başarılı: Patron anahtarı veritabanı boşken bile sorgusuz içeri alındı.", "success");
        } else {
            throw new Error("Test 4 Başarısız: Patron anahtarı (ULTIMATE-PRO) kapıda kaldı.");
        }

        // TAMAMLANDI
        logTest("🎉 TÜM SİSTEM BAŞARIYLA DOĞRULANDI, ÜRETİME HAZIR!", "success");

    } catch (error) {
        logTest(`❌ HATA: ${error.message}`, "error");
    } finally {
        document.getElementById('run-all-tests').disabled = false;
    }
}
