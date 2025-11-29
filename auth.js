// Importları doğrudan CDN'den yapıyoruz. Versiyon 10.7.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

console.log("Auth.js yüklendi - Firebase başlatılıyor...");

// --- FIREBASE KONFIGURASYONU ---
const firebaseConfig = {
  apiKey: "AIzaSyCN7_FvUFjWAjIFmdG7yO_nJUL0RJZmD_0",
  authDomain: "mini-golf-arena-493dc.firebaseapp.com",
  projectId: "mini-golf-arena-493dc",
  storageBucket: "mini-golf-arena-493dc.firebasestorage.app",
  messagingSenderId: "1025857887392",
  appId: "1:1025857887392:web:5ad0a2428311f8a679bdc5",
  measurementId: "G-1899GSVYY6"
};

// Firebase'i Başlat
let app, auth;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log("Firebase başarıyla başlatıldı.");
} catch (e) {
    console.error("Firebase başlatma hatası:", e);
    alert("Firebase bağlantı hatası: " + e.message);
}

// DOM Elementleri
const authScreen = document.getElementById('auth-screen');
const lobbyScreen = document.getElementById('lobby');
const authError = document.getElementById('auth-error');

const nicknameInput = document.getElementById('auth-nickname');
const passwordInput = document.getElementById('auth-password');
const btnAction = document.getElementById('btn-auth-action');
const btnToggleMode = document.getElementById('btn-toggle-mode');

const lobbyPlayerName = document.getElementById('player-name'); 

// Durum
let isRegisterMode = false; 

// --- YARDIMCI FONKSİYONLAR ---

function createFakeEmail(nickname) {
    const cleanNick = nickname.trim().replace(/\s+/g, '').toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
    return `${cleanNick}@emonrg.game`;
}

function showError(msg) {
    console.warn("Auth Hatası:", msg);
    if(authError) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
    }
}

function toggleAuthMode() {
    console.log("Mod değiştiriliyor...");
    isRegisterMode = !isRegisterMode;
    if(authError) authError.classList.add('hidden');
    
    const titleEl = document.getElementById('auth-title');

    if (isRegisterMode) {
        if(titleEl) titleEl.textContent = "Kayıt Ol";
        if(btnAction) btnAction.textContent = "Kayıt Ol";
        if(btnToggleMode) btnToggleMode.textContent = "Zaten hesabın var mı? Giriş Yap";
    } else {
        if(titleEl) titleEl.textContent = "Giriş Yap";
        if(btnAction) btnAction.textContent = "Giriş Yap";
        if(btnToggleMode) btnToggleMode.textContent = "Hesabın yok mu? Kayıt Ol";
    }
}

// --- AUTH İŞLEMLERİ ---

async function handleAuth() {
    console.log("Auth işlemi başlatıldı. Mod:", isRegisterMode ? "Kayıt" : "Giriş");
    
    const nickname = nicknameInput.value;
    const password = passwordInput.value;

    if (nickname.length < 3) return showError("Nickname en az 3 karakter olmalı.");
    if (password.length < 6) return showError("Şifre en az 6 karakter olmalı.");

    const email = createFakeEmail(nickname);
    console.log("Email oluşturuldu:", email);

    if(btnAction) btnAction.disabled = true;

    try {
        if (isRegisterMode) {
            console.log("Kayıt isteği gönderiliyor...");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log("Kayıt başarılı, profil güncelleniyor...");
            await updateProfile(userCredential.user, {
                displayName: nickname
            });
        } else {
            console.log("Giriş isteği gönderiliyor...");
            await signInWithEmailAndPassword(auth, email, password);
        }
        console.log("İşlem tamamlandı.");
    } catch (error) {
        console.error("Auth İşlem Hatası:", error);
        let msg = "Bir hata oluştu: " + error.code;
        if (error.code === 'auth/email-already-in-use') msg = "Bu kullanıcı adı zaten alınmış.";
        if (error.code === 'auth/invalid-credential') msg = "Kullanıcı adı veya şifre hatalı.";
        if (error.code === 'auth/weak-password') msg = "Şifre çok zayıf.";
        if (error.code === 'auth/network-request-failed') msg = "İnternet bağlantısı hatası.";
        showError(msg);
        if(btnAction) btnAction.disabled = false;
    }
}

// --- EVENT LISTENERS ---

if(btnAction) {
    btnAction.addEventListener('click', handleAuth);
    console.log("Action butonu dinleniyor.");
} else {
    console.error("Action butonu bulunamadı!");
}

if(btnToggleMode) {
    btnToggleMode.addEventListener('click', toggleAuthMode);
}

if(passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAuth();
    });
}

// Oturum Durumu İzleyici
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Kullanıcı oturumu açık:", user.uid);
        
        if(authScreen) authScreen.classList.add('hidden');
        if(lobbyScreen) lobbyScreen.classList.remove('hidden');

        if (lobbyPlayerName) {
            lobbyPlayerName.value = user.displayName || user.email.split('@')[0];
            lobbyPlayerName.disabled = true; 
        }

    } else {
        console.log("Kullanıcı oturumu kapalı.");
        if(authScreen) authScreen.classList.remove('hidden');
        if(lobbyScreen) lobbyScreen.classList.add('hidden');
        if(btnAction) btnAction.disabled = false;
    }
});
