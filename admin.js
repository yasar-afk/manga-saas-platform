// ================= ADMIN PANEL LOGIC (v4 SaaS Cloud) =================

let useCloud = false;
let dbRef = null;

// Bulut Durumu Kontrolü (cloud.js üzerinden)
function checkCloudStatus() {
    if (typeof firebase !== 'undefined' && typeof db !== 'undefined' && db !== null) {
        useCloud = true;
        dbRef = firebase.database();
        document.getElementById('cloud-status').className = 'status-dot online';
        document.getElementById('cloud-status-text').textContent = 'Buluta Bağlı (SaaS)';
        return true;
    } else {
        document.getElementById('cloud-status').className = 'status-dot offline';
        document.getElementById('cloud-status-text').textContent = 'Yerel Mod (Geliştirici)';
        return false;
    }
}

// 1. Verileri Yükle (Bulut ve Yerel Hibrit)
async function loadData() {
    console.log("📊 SaaS Verileri senkronize ediliyor...");
    checkCloudStatus();
    
    let dbKeys = {};
    let logs = [];
    let stats = { totalPages: 0, nsfwCount: 0, totalCost: 0 };

    if (useCloud) {
        // --- BULUT MODU (Firebase) ---
        try {
            const licenseSnap = await dbRef.ref('licenses').once('value');
            dbKeys = licenseSnap.val() || {};
            
            const logSnap = await dbRef.ref('logs').limitToLast(100).once('value');
            const logVal = logSnap.val();
            logs = logVal ? Object.values(logVal).reverse() : [];
            
            const statSnap = await dbRef.ref('stats').once('value');
            const cloudStats = statSnap.val() || {};
            stats.totalPages = cloudStats.totalPages || 0;
            stats.nsfwCount = cloudStats.nsfwCount || 0;
            stats.totalCost = cloudStats.totalCost || 0;
        } catch (e) {
            console.error("Bulut veri hatası:", e);
        }
    } else {
        // --- YEREL MOD (LocalStorage Fallback) ---
        dbKeys = JSON.parse(localStorage.getItem('manga_saas_db')) || {};
        logs = JSON.parse(localStorage.getItem('manga_admin_logs')) || [];
        
        Object.keys(dbKeys).forEach(key => {
            stats.totalPages += (parseInt(localStorage.getItem(`manga_license_usage_${key}`)) || 0);
        });
        stats.nsfwCount = logs.filter(l => l.type === 'NSFW_BLOCK' || l.type === 'NSFW_DETECTED').length;
    }

    // UI Güncelle (İstatistikler)
    document.getElementById('stat-total-keys').textContent = Object.keys(dbKeys).length;
    document.getElementById('stat-total-pages').textContent = stats.totalPages;
    document.getElementById('stat-total-cost').textContent = stats.totalCost.toFixed(4);
    document.getElementById('stat-nsfw-count').textContent = stats.nsfwCount;

    // Token Detayları (Yerel/Bulut karışık gösterilebilir)
    renderTokenProgress();

    // 2. Tabloları ve Galeriyi Doldur
    renderKeysTable(dbKeys);
    renderLogs(logs);
    renderGallery(logs);
    
    // 3. Bulut Sistem Ayarlarını Yükle (API Keyleri vb.)
    const settings = await cloudGetSystemSettings();
    if (settings) {
        if (document.getElementById('cloud-gemini-keys')) document.getElementById('cloud-gemini-keys').value = settings.gemini_keys || '';
        if (document.getElementById('cloud-grok-key'))   document.getElementById('cloud-grok-key').value = settings.grok_key || '';
        
        const adminKey = Object.values(dbKeys).find(k => k.isAdmin || k.type === 'SINIRSIZ-ADMIN');
        if (adminKey) {
            document.getElementById('admin-password-input').value = adminKey.password || settings.admin_password || 'root';
        }
    }
}

// Token Progress Bar Render
function renderTokenProgress() {
    const geminiIn = parseInt(localStorage.getItem('manga_tokens_in')) || 0;
    const geminiOut = parseInt(localStorage.getItem('manga_tokens_out')) || 0;
    const grokIn = parseInt(localStorage.getItem('grok_tokens_in')) || 0;
    const grokOut = parseInt(localStorage.getItem('grok_tokens_out')) || 0;

    const maxTokens = Math.max(geminiIn + geminiOut + grokIn + grokOut, 10000);
    document.getElementById('gemini-token-count').textContent = `${geminiIn.toLocaleString()} / ${geminiOut.toLocaleString()}`;
    document.getElementById('grok-token-count').textContent = `${grokIn.toLocaleString()} / ${grokOut.toLocaleString()}`;
    
    document.getElementById('gemini-progress').style.width = `${((geminiIn + geminiOut) / maxTokens * 100)}%`;
    document.getElementById('grok-progress').style.width = `${((grokIn + grokOut) / maxTokens * 100)}%`;
}

// Lisans Tablosu Render
function renderKeysTable(db) {
    const tbody = document.getElementById('keys-table-body');
    tbody.innerHTML = '';

    Object.keys(db).sort().forEach(key => {
        const item = db[key];
        const used = item.used || 0;
        const limit = item.limit || 0;
        const progress = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="key-cell"><code>${key}</code> ${item.isAdmin ? '<span class="badge purple">ADMIN</span>' : ''}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="progress-container" style="width:60px; margin-bottom:0;">
                         <div class="progress-bar ${progress > 90 ? 'danger' : 'success'}" style="width:${progress}%"></div>
                    </div>
                    <span>${used}</span>
                </div>
            </td>
            <td><b>${limit}</b></td>
            <td><span class="badge ${(item.engine || 'gemini').includes('gemini') ? 'blue' : 'orange'}">${(item.engine || 'gemini').split('/')[0]}</span></td>
            <td><span class="status-dot ${used < limit ? 'online' : 'offline'}"></span> ${used < limit ? 'Aktif' : 'Limit Dolu'}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="icon-btn-sm" onclick="increaseLimit('${key}')" title="Limit Artır"><i class="fa-solid fa-plus-circle"></i></button>
                    ${!item.isAdmin ? `<button class="icon-btn-sm delete" onclick="deleteKey('${key}')" title="Sil"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Log Render
function renderLogs(logs) {
    const listPreview = document.getElementById('recent-logs-preview');
    const listAll = document.getElementById('all-logs-list');
    listPreview.innerHTML = '';
    listAll.innerHTML = '';

    if (logs.length === 0) {
        listPreview.innerHTML = '<p class="empty-msg">Kayıt yok.</p>';
        listAll.innerHTML = '<p class="empty-msg">Kayıt yok.</p>';
        return;
    }

    logs.forEach((log, idx) => {
        const type = log.type || '';
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Bilinmiyor';
        const msg = log.message || log.details || 'Mesaj yok';
        
        const logHtml = `
            <div class="log-item ${type.includes('NSFW') ? 'nsfw' : ''}">
                <span class="log-time">${time}</span>
                <span class="log-key">${log.key || 'Sistem'}</span>: 
                <span class="log-text">${msg}</span>
                ${log.evidence ? `<button class="action-btn secondary" style="padding:2px 8px; font-size:10px; margin-top:5px;" onclick="showTab('gallery')">Kanıtı Gör</button>` : ''}
            </div>
        `;
        if (idx < 5) listPreview.innerHTML += logHtml;
        listAll.innerHTML += logHtml;
    });
}

// Galeri Render
function renderGallery(logs) {
    const gallery = document.getElementById('evidence-gallery');
    gallery.innerHTML = '';
    const evidenceLogs = logs.filter(log => log.evidence);
    
    if (evidenceLogs.length === 0) {
        gallery.innerHTML = '<p class="empty-msg">Yakalanan fotoğraf yok.</p>';
        return;
    }

    evidenceLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'evidence-card';
        div.innerHTML = `
            <img src="${log.evidence}" alt="Evidence">
            <div class="info">
                <span><b>Tarih:</b> ${new Date(log.timestamp).toLocaleString()}</span><br>
                <span><b>Key:</b> ${log.key || 'Bilinmiyor'}</span>
                <span class="status">NSFW TESPİTİ</span>
            </div>
        `;
        gallery.appendChild(div);
    });
}

// ─── AKSİYONLAR (SaaS Cloud v4) ──────────────────────────────────────────────────

async function increaseLimit(key) {
    const amount = parseInt(prompt(`"${key}" için ne kadar yeni limit eklemek istersiniz?`, "50"));
    if (isNaN(amount) || amount <= 0) return;

    if (useCloud) {
        const ref = dbRef.ref(`licenses/${key}/limit`);
        await ref.transaction(curr => (curr || 0) + amount);
        await cloudLogEvent('LIMIT_UPGRADE', `Bulut Limiti Artırıldı: ${key} (+${amount})`);
    } else {
        const db = JSON.parse(localStorage.getItem('manga_saas_db'));
        db[key].limit += amount;
        localStorage.setItem('manga_saas_db', JSON.stringify(db));
    }
    loadData();
    alert("Limit güncellendi!");
}

async function deleteKey(key) {
    if (!confirm(`"${key}" lisansını silmek istediğinize emin misiniz?`)) return;

    if (useCloud) {
        await dbRef.ref(`licenses/${key}`).remove();
        await cloudLogEvent('KEY_DELETE', `Bulut Lisansı Silindi: ${key}`);
    } else {
        const db = JSON.parse(localStorage.getItem('manga_saas_db'));
        delete db[key];
        localStorage.setItem('manga_saas_db', JSON.stringify(db));
    }
    loadData();
}

async function saveNewKey() {
    const key = document.getElementById('new-key-input').value.trim().toUpperCase();
    const limit = parseInt(document.getElementById('new-limit-input').value);
    const engine = document.getElementById('new-engine-input').value;

    if (key.length < 5 || isNaN(limit)) return alert("Geçersiz veri!");

    const newKeyData = { limit, used: 0, engine, created: new Date().toISOString() };

    if (useCloud) {
        await dbRef.ref(`licenses/${key}`).set(newKeyData);
        await cloudLogEvent('NEW_KEY', `Yeni Bulut Lisansı: ${key}`);
    } else {
        const db = JSON.parse(localStorage.getItem('manga_saas_db')) || {};
        db[key] = newKeyData;
        localStorage.setItem('manga_saas_db', JSON.stringify(db));
    }
    
    closeModal();
    loadData();
}

async function updateSystemSettings() {
    const newPass = document.getElementById('admin-password-input').value.trim();
    const gKeys = document.getElementById('cloud-gemini-keys').value.trim();
    const oKey = document.getElementById('cloud-grok-key').value.trim();
    
    if (newPass.length < 3) return alert("Şifre çok kısa!");

    const settingsData = {
        admin_password: newPass,
        gemini_keys: gKeys,
        grok_key: oKey,
        updatedAt: new Date().toISOString()
    };

    if (useCloud) {
        // Tüm ayarları tek bir bulut düğümünde topla
        await firebase.database().ref('settings').update(settingsData);
        
        // Ayrıca lisans tablosundaki admin şifresini de güncelle (Geri uyumluluk için)
        const snap = await dbRef.ref('licenses').once('value');
        const db = snap.val() || {};
        const adminKey = Object.keys(db).find(k => db[k].isAdmin || db[k].type === 'SINIRSIZ-ADMIN');
        if (adminKey) await dbRef.ref(`licenses/${adminKey}/password`).set(newPass);
    } else {
        // Yerel Mod Kaydı
        localStorage.setItem('manga_edit_api_keys', gKeys);
        localStorage.setItem('manga_grok_key', oKey);
        const db = JSON.parse(localStorage.getItem('manga_saas_db'));
        const adminKey = Object.keys(db).find(k => db[k].isAdmin);
        if (adminKey) db[adminKey].password = newPass;
        localStorage.setItem('manga_saas_db', JSON.stringify(db));
    }
    
    alert("✅ Bulut Ayarları ve API Anahtarları Başarıyla Güncellendi!");
    loadData();
}

function generateRandomKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let k = 'MNG-';
    for (let i = 0; i < 8; i++) {
        if (i === 4) k += '-';
        k += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('new-key-input').value = k;
}

// ─── UI MANTIĞI ─────────────────────────────────────────────────────────────

// 5. Verileri ZIP Olarak İndir (Google Drive Hazırlığı)
if (document.getElementById('drive-export-btn')) {
    document.getElementById('drive-export-btn').addEventListener('click', async () => {
        let logs = [];
        if (useCloud) {
            const logSnap = await dbRef.ref('logs').once('value');
            logs = Object.values(logSnap.val() || {});
        } else {
            logs = JSON.parse(localStorage.getItem('manga_admin_logs') || '[]');
        }

        const evidenceLogs = logs.filter(log => log.evidence);
        if (evidenceLogs.length === 0) return alert("Aktarılacak fotoğraf bulunamadı!");
        if (typeof JSZip === 'undefined') return alert("JSZip kütüphanesi yüklenemedi!");

        const zip = new JSZip();
        evidenceLogs.forEach((log, idx) => {
            const base64Data = log.evidence.split(',')[1];
            zip.file(`evidence_${new Date(log.timestamp).getTime()}_${idx}.jpg`, base64Data, {base64: true});
        });

        const content = await zip.generateAsync({type: "blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `manga_nsfw_reports_${new Date().toLocaleDateString()}.zip`;
        link.click();
        
        await cloudLogEvent('DRIVE_EXPORT', `${evidenceLogs.length} kanıt fotoğrafı ZIP yapıldı.`);
    });
}

async function clearEvidence() {
    if (!confirm("Tüm yakalanan resimleri silmek istediğinize emin misiniz?")) return;
    
    if (useCloud) {
        // Bulutta resim içeren logları temizle veya resmi null yap
        const logSnap = await dbRef.ref('logs').once('value');
        const logs = logSnap.val() || {};
        for (let id in logs) {
            if (logs[id].evidence) {
                await dbRef.ref(`logs/${id}/evidence`).remove();
            }
        }
    } else {
        let logs = JSON.parse(localStorage.getItem('manga_admin_logs') || '[]');
        logs = logs.map(l => { delete l.evidence; return l; });
        localStorage.setItem('manga_admin_logs', JSON.stringify(logs));
    }
    loadData();
    alert("Tüm kanıtlar temizlendi.");
}

// ─── UI MANTIĞI ─────────────────────────────────────────────────────────────

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        a.classList.remove('active');
        if(a.getAttribute('onclick')?.includes(`'${tabId}'`)) a.classList.add('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function openNewKeyModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
    generateRandomKey();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function toggleAdminPassword() {
    const inp = document.getElementById('admin-password-input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

setInterval(() => {
    const el = document.getElementById('current-time');
    if (el) el.textContent = new Date().toLocaleTimeString('tr-TR');
}, 1000);

window.onload = loadData;
