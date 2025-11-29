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
        console.log("Firebase Auth başlatıldı.");
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
        if(screenName && screens[screenName]) screens[screenName].classList.remove('hidden');
    }

    function createFakeEmail(nickname) {
        const cleanNick = nickname.trim().replace(/\s+/g, '').toLowerCase()
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
        return `${cleanNick}@emonrg.game`;
    }

    // --- AUTH İŞLEMLERİ ---
    async function handleAuth() {
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
            if (isRegisterMode) {
                console.log("Kayıt isteği gönderiliyor...");
                const cred = await auth.createUserWithEmailAndPassword(email, password);
                console.log("Kayıt başarılı, profil güncelleniyor...");
                await cred.user.updateProfile({ displayName: nickname });
            } else {
                console.log("Giriş isteği gönderiliyor...");
                await auth.signInWithEmailAndPassword(email, password);
            }
            console.log("İşlem tamamlandı.");
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

    // --- SOCKET.IO EVENTLERİ ---
    function setupSocketListeners() {
        // Oda oluşturulduğunda
        socket.on('roomCreated', ({ roomId, room }) => {
            console.log("Oda oluşturuldu:", roomId);
            enterRoom(roomId, room);
        });

        // Oda güncellendiğinde (Biri girdi/çıktı)
        socket.on('roomUpdated', (room) => {
            updateRoomUI(room);
        });

        // Hata mesajları
        socket.on('error', (msg) => {
            alert(msg);
        });

        // Oyun Başladı
        socket.on('gameStarted', () => {
            console.log("Oyun başlıyor!");
            showScreen(null); // Lobi ekranlarını kapat
            document.getElementById('game').classList.remove('hidden');
            // Multiplayer modunda başlat
            if (window.startGameSingle) window.startGameSingle(currentUser.displayName);
        });
    }

    // --- ODA YÖNETİMİ ---

    function createRoom() {
        if (!currentUser) return;
        const isPublic = roomPublicSwitch ? roomPublicSwitch.checked : true;
        
        socket.emit('createRoom', {
            uid: currentUser.uid,
            name: currentUser.displayName,
            isPublic: isPublic
        });
    }

    function joinRoom(code) {
        if (!currentUser) return;
        socket.emit('joinRoom', {
            roomId: code.toUpperCase(),
            uid: currentUser.uid,
            name: currentUser.displayName
        });
    }

    function joinRandom() {
        if (!currentUser) return;
        socket.emit('joinRandom', {
            uid: currentUser.uid,
            name: currentUser.displayName
        });
    }

    function enterRoom(roomId, room) {
        currentRoomId = roomId;
        showScreen('roomLobby');
        displayRoomCode.textContent = roomId;
        updateRoomUI(room);
    }

    function leaveRoom() {
        socket.emit('leaveRoom');
        currentRoomId = null;
        showScreen('lobbyMenu');
    }

    function updateRoomUI(room) {
        if(!room || !room.players) return;

        roomPlayerList.innerHTML = '';
        const players = Object.values(room.players);
        playerCountSpan.textContent = players.length;

        // Oyuncu Listesi
        players.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="avatar">👤</span> ${p.name}`;
            roomPlayerList.appendChild(li);
        });

        // Boş Slotlar
        for(let i=players.length; i<6; i++) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'Boş Slot';
            roomPlayerList.appendChild(li);
        }

        // Başlat Butonu (Sadece Host ve socket.id eşleşiyorsa)
        // Not: Server'dan gelen room.host bir socket.id'dir.
        const isHost = (room.host === socket.id);
        
        if (isHost) {
            btnStartGame.style.display = 'block';
            if (players.length >= 4) {
                btnStartGame.disabled = false;
                btnStartGame.textContent = "Oyunu Başlat";
                roomStatusMsg.textContent = "Oyun başlatılabilir!";
            } else {
                btnStartGame.disabled = true;
                btnStartGame.textContent = `En az 4 kişi gerekli (${players.length}/4)`;
                roomStatusMsg.textContent = "Oyuncular bekleniyor...";
            }
        } else {
            btnStartGame.style.display = 'none';
            roomStatusMsg.textContent = "Oda kurucusu bekleniyor...";
        }
    }

    // --- EVENT LISTENERS ---
    if(btnAction) {
        btnAction.addEventListener('click', handleAuth);
    } else {
        console.error("btnAction bulunamadı!");
    }

    if(btnToggleMode) btnToggleMode.addEventListener('click', toggleAuthMode);
    if(btnLogout) btnLogout.addEventListener('click', () => auth.signOut());

    if(btnSingleplayer) {
        btnSingleplayer.addEventListener('click', () => {
            showScreen(null);
            document.getElementById('game').classList.remove('hidden');
            if (window.startGameSingle) window.startGameSingle(currentUser.displayName);
        });
    }

    if(btnSettings) {
        btnSettings.addEventListener('click', () => alert("Ayarlar menüsü yapım aşamasında."));
    }

    if(btnShowCreate) btnShowCreate.addEventListener('click', () => showScreen('createRoom'));
    if(btnShowJoin) btnShowJoin.addEventListener('click', () => showScreen('joinRoom'));
    if(btnCreateCancel) btnCreateCancel.addEventListener('click', () => showScreen('lobbyMenu'));
    if(btnJoinCancel) btnJoinCancel.addEventListener('click', () => showScreen('lobbyMenu'));

    if(btnCreateConfirm) btnCreateConfirm.addEventListener('click', createRoom);
    
    if(btnJoinConfirm) btnJoinConfirm.addEventListener('click', () => {
        const code = roomCodeInput.value.trim();
        if(code.length === 6) joinRoom(code);
        else {
            joinError.textContent = "Lütfen 6 haneli kodu girin.";
            joinError.classList.remove('hidden');
        }
    });

    if(btnJoinRandom) btnJoinRandom.addEventListener('click', joinRandom);
    if(btnLeaveRoom) btnLeaveRoom.addEventListener('click', leaveRoom);
    
    if(btnStartGame) btnStartGame.addEventListener('click', () => {
        if(currentRoomId) {
            socket.emit('startGame', currentRoomId);
        }
    });

    // Auth Durum İzleyici
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            console.log("Kullanıcı girişi doğrulandı:", user.displayName);
            if(document.getElementById('welcome-msg')) 
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
