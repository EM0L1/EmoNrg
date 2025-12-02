console.log("AUTH.JS YÜKLENİYOR..."); // Bu logu konsolda görmelisin

// --- FIREBASE AUTH KONFIGURASYONU ---
const firebaseConfig = {
    apiKey: "AIzaSyCN7_FvUFjWAjIFmdG7yO_nJUL0RJZmD_0",
    authDomain: "mini-golf-arena-493dc.firebaseapp.com",
    projectId: "mini-golf-arena-493dc",
    storageBucket: "mini-golf-arena-493dc.firebasestorage.app",
    messagingSenderId: "1025857887392",
    appId: "1:1025857887392:web:5ad0a2428311f8a679bdc5",
    measurementId: "G-1899GSVYY6"
};

let app, auth;
let socket; // Socket.io bağlantısı
let currentUser = null;
let currentRoomId = null;

function initAuth() {
    console.log("DOM Hazır, initAuth çalışıyor...");

    // 1. Firebase Auth Başlat
    try {
        if (typeof firebase === 'undefined') {
            throw new Error("Firebase kütüphaneleri yüklenemedi!");
        }
        if (!firebase.apps.length) app = firebase.initializeApp(firebaseConfig);
        else app = firebase.app();
        auth = firebase.auth();
        window.db = firebase.firestore(); // Global erişim için window'a atadık
        console.log("Firebase Auth ve Firestore başlatıldı.");

        // --- FIRESTORE HELPERS (ARTIK SOCKET ÜZERİNDEN) ---
        window.fetchLeaderboard = function () {
            const tbody = document.getElementById('leaderboard-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Yükleniyor...</td></tr>';

            // Sunucudan iste (UID ile beraber)
            if (window.gameSocket) {
                const myUid = currentUser ? currentUser.uid : null;
                window.gameSocket.emit('requestLeaderboard', myUid);
            }
        };

        // saveGameStats ARTIK YOK (Sunucu hallediyor)
        window.saveGameStats = null;

    } catch (e) {
        console.error("Firebase Hatası:", e);
        alert("Firebase yüklenemedi. İnternet bağlantınızı kontrol edin.");
        return;
    }

    // 2. Socket.io Bağlantısı
    try {
        if (typeof io === 'undefined') {
            throw new Error("Socket.io kütüphanesi yüklenemedi!");
        }
        socket = io();
        console.log("Socket.io bağlantısı kuruldu.");
        // Oyun tarafının da kullanabilmesi için global'e at
        window.gameSocket = socket;

        // Socket Event Dinleyicileri
        setupSocketListeners();
    } catch (e) {
        console.error("Socket.io Hatası:", e);
    }

    // --- DOM ELEMENTLERİ ---
    const screens = {
        auth: document.getElementById('auth-screen'),
        lobbyMenu: document.getElementById('lobby-menu'),
        createRoom: document.getElementById('create-room-modal'),
        joinRoom: document.getElementById('join-room-modal'),
        roomLobby: document.getElementById('room-lobby')
    };

    // Auth Elemanları
    const nicknameInput = document.getElementById('auth-nickname');
    const passwordInput = document.getElementById('auth-password');
    const btnAction = document.getElementById('btn-auth-action');
    const btnToggleMode = document.getElementById('btn-toggle-mode');
    const authError = document.getElementById('auth-error');

    // Lobi Menü
    const btnShowCreate = document.getElementById('btn-show-create');
    const btnShowJoin = document.getElementById('btn-show-join');
    const btnJoinRandom = document.getElementById('btn-join-random');
    const btnLogout = document.getElementById('btn-logout');
    const btnSingleplayer = document.getElementById('btn-singleplayer');
    const btnSettings = document.getElementById('btn-settings');

    // Modal
    const btnCreateConfirm = document.getElementById('btn-create-confirm');
    const btnCreateCancel = document.getElementById('btn-create-cancel');
    const btnJoinConfirm = document.getElementById('btn-join-confirm');
    const btnJoinCancel = document.getElementById('btn-join-cancel');
    const roomCodeInput = document.getElementById('room-code-input');
    const joinError = document.getElementById('join-error');
    const roomPublicSwitch = document.getElementById('room-public-switch');

    // Oda İçi
    const displayRoomCode = document.getElementById('display-room-code');
    const roomPlayerList = document.getElementById('room-player-list');
    const playerCountSpan = document.getElementById('player-count');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnLeaveRoom = document.getElementById('btn-leave-room');
    const roomStatusMsg = document.getElementById('room-status-msg');

    let isRegisterMode = false;

    function showScreen(screenName) {
        Object.values(screens).forEach(el => el.classList.add('hidden'));
        if (screenName && screens[screenName]) screens[screenName].classList.remove('hidden');

        // Liderlik tablosunu güncelle
        if (screenName === 'lobbyMenu' && window.fetchLeaderboard) {
            window.fetchLeaderboard();
        }
    }

    function createFakeEmail(nickname) {
        const cleanNick = nickname.trim().replace(/\s+/g, '').toLowerCase()
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
        return `${cleanNick}@emonrg.game`;
    }

    // --- AUTH İŞLEMLERİ ---
    // --- AUTH İŞLEMLERİ ---
    async function handleAuth(e) {
        if (e) e.preventDefault(); // Form submit engelleme

        console.log("handleAuth tetiklendi. Mod:", isRegisterMode ? "Kayıt" : "Giriş");
        const nickname = nicknameInput.value;
        const password = passwordInput.value;

        if (nickname.length < 3 || password.length < 6) {
            authError.textContent = "Geçersiz giriş bilgileri.";
            authError.classList.remove('hidden');
            return;
        }

        const email = createFakeEmail(nickname);
        btnAction.disabled = true;

        try {
            let cred;
            if (isRegisterMode) {
                console.log("Kayıt isteği gönderiliyor...");
                cred = await auth.createUserWithEmailAndPassword(email, password);
                console.log("Kayıt başarılı, profil güncelleniyor...");
                await cred.user.updateProfile({ displayName: nickname });

                // Firestore'a ilk kaydı aç
                if (!window.db) {
                    console.warn("window.db tanımlı değil, tekrar başlatılıyor...");
                    if (firebase.firestore) {
                        window.db = firebase.firestore();
                    }
                }

                if (window.db) {
                    console.log("Firestore yazma işlemi başlıyor...");
                    await window.db.collection('users').doc(cred.user.uid).set({
                        uid: cred.user.uid,
                        displayName: nickname,
                        email: email,
                        totalScore: 0,
                        gamesPlayed: 0,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                        .then(() => console.log("Firestore kaydı BAŞARIYLA oluşturuldu."))
                        .catch((error) => console.error("Firestore yazma hatası:", error));
                } else {
                    console.error("KRİTİK HATA: Firestore başlatılamadığı için veri yazılamadı!");
                    alert("Veritabanı bağlantı hatası! Puanlarınız kaydedilmeyebilir.");
                }
            } else {
                console.log("Giriş isteği gönderiliyor...");
                cred = await auth.signInWithEmailAndPassword(email, password);
            }
            console.log("İşlem tamamlandı.");

            // BAŞARILI DURUM: Kullanıcıyı hemen lobiye al
            authError.classList.add('hidden');
            // Butonu hemen açma, authStateChanged halledecek veya hata olursa catch bloğu açacak

            currentUser = cred.user;
            if (currentUser) {
                const welcomeEl = document.getElementById('welcome-msg');
                if (welcomeEl) {
                    welcomeEl.textContent = `Merhaba, ${currentUser.displayName || nickname}`;
                }
                showScreen('lobbyMenu');
            }
        } catch (error) {
            console.error("Auth Hatası:", error);
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = "Bu kullanıcı adı zaten alınmış.";
            if (error.code === 'auth/invalid-credential') msg = "Kullanıcı adı veya şifre hatalı.";
            if (error.code === 'auth/network-request-failed') msg = "İnternet bağlantısı yok.";

            authError.textContent = msg;
            authError.classList.remove('hidden');
            btnAction.disabled = false;
        }
    }

    function toggleAuthMode() {
        isRegisterMode = !isRegisterMode;
        document.getElementById('auth-title').textContent = isRegisterMode ? "Kayıt Ol" : "Giriş Yap";
        btnAction.textContent = isRegisterMode ? "Kayıt Ol" : "Giriş Yap";
        btnToggleMode.textContent = isRegisterMode ? "Zaten hesabın var mı? Giriş Yap" : "Hesabın yok mu? Kayıt Ol";
        authError.classList.add('hidden');
    }

    // ... (Socket listeners remain same) ...

    // --- EVENT LISTENERS ---
    if (btnAction) {
        // Önceki listener'ları temizlemek mümkün değil ama yeni bir listener ekliyoruz.
        // Çift tıklamayı önlemek için 'once' kullanmıyoruz ama disabled kontrolü yapıyoruz.
        btnAction.onclick = handleAuth; // addEventListener yerine onclick atayarak tek listener garanti ediyoruz
        console.log("btn-auth-action listener atandı.");
    } else {
        console.error("btn-auth-action (Giriş Yap butonu) DOM'da bulunamadı!");
    }

    // EKSTRA GÜVENLİK: Global click listener'ı KALDIRIYORUZ çünkü çift tetiklemeye sebep oluyor.
    // document.addEventListener('click', ... );  <-- SİLİNDİ

    if (btnToggleMode) btnToggleMode.addEventListener('click', toggleAuthMode);
    if (btnLogout) btnLogout.addEventListener('click', () => auth.signOut());

    if (btnSingleplayer) {
        btnSingleplayer.addEventListener('click', () => {
            showScreen(null);
            document.getElementById('game').classList.remove('hidden');
            if (window.startGameSingle) window.startGameSingle(currentUser.displayName);
        });
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', () => alert("Ayarlar menüsü yapım aşamasında."));
    }

    if (btnShowCreate) btnShowCreate.addEventListener('click', () => showScreen('createRoom'));
    if (btnShowJoin) btnShowJoin.addEventListener('click', () => showScreen('joinRoom'));
    if (btnCreateCancel) btnCreateCancel.addEventListener('click', () => showScreen('lobbyMenu'));
    if (btnJoinCancel) btnJoinCancel.addEventListener('click', () => showScreen('lobbyMenu'));

    if (btnCreateConfirm) btnCreateConfirm.addEventListener('click', createRoom);

    if (btnJoinConfirm) btnJoinConfirm.addEventListener('click', () => {
        const code = roomCodeInput.value.trim();
        if (code.length === 6) joinRoom(code);
        else {
            joinError.textContent = "Lütfen 6 haneli kodu girin.";
            joinError.classList.remove('hidden');
        }
    });

    if (btnJoinRandom) btnJoinRandom.addEventListener('click', joinRandom);
    if (btnLeaveRoom) btnLeaveRoom.addEventListener('click', leaveRoom);

    if (btnStartGame) btnStartGame.addEventListener('click', () => {
        if (currentRoomId) {
            socket.emit('startGame', currentRoomId);
        }
    });

    // RENK SEÇİMİ BUTONLARI
    const colorButtons = document.querySelectorAll('.color-option');
    colorButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.target.dataset.color;
            if (currentRoomId && color) {
                console.log("Renk seçildi:", color);
                socket.emit('selectColor', { roomId: currentRoomId, color: color });

                // Görsel geri bildirim (seçili olanı işaretle)
                colorButtons.forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        });
    });

    // Auth Durum İzleyici
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            console.log("Kullanıcı girişi doğrulandı:", user.displayName);
            if (document.getElementById('welcome-msg'))
                document.getElementById('welcome-msg').textContent = `Merhaba, ${user.displayName}`;
            showScreen('lobbyMenu');
        } else {
            console.log("Kullanıcı çıkış yaptı.");
            showScreen('auth');
        }
    });


}

// DOM yüklendiğinde başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
