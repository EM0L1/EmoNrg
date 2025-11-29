// --- FIREBASE KONFIGURASYONU ---
const firebaseConfig = {
  apiKey: "AIzaSyCN7_FvUFjWAjIFmdG7yO_nJUL0RJZmD_0",
  authDomain: "mini-golf-arena-493dc.firebaseapp.com",
  projectId: "mini-golf-arena-493dc",
  storageBucket: "mini-golf-arena-493dc.firebasestorage.app",
  messagingSenderId: "1025857887392",
  appId: "1:1025857887392:web:5ad0a2428311f8a679bdc5",
  measurementId: "G-1899GSVYY6",
  databaseURL: "https://mini-golf-arena-493dc-default-rtdb.firebaseio.com" // Veritabanı URL'si önemli!
};

let app, auth, db;
let currentUser = null;
let currentRoomId = null;
let roomListener = null;

function initAuth() {
    console.log("DOM Hazır, initAuth çalışıyor...");

    // Firebase'i Başlat (Compat Modu)
    try {
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }
        auth = firebase.auth();
        db = firebase.database(); // Realtime Database
        console.log("Firebase başarıyla başlatıldı.");
    } catch (e) {
        console.error("Firebase başlatma hatası:", e);
        alert("Firebase bağlantı hatası: " + e.message);
        return;
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

    // Lobi Menü Butonları
    const btnShowCreate = document.getElementById('btn-show-create');
    const btnShowJoin = document.getElementById('btn-show-join');
    const btnJoinRandom = document.getElementById('btn-join-random');
    const btnLogout = document.getElementById('btn-logout');
    const btnSingleplayer = document.getElementById('btn-singleplayer');
    const btnSettings = document.getElementById('btn-settings');

    // Modal Butonları
    const btnCreateConfirm = document.getElementById('btn-create-confirm');
    const btnCreateCancel = document.getElementById('btn-create-cancel');
    const btnJoinConfirm = document.getElementById('btn-join-confirm');
    const btnJoinCancel = document.getElementById('btn-join-cancel');
    const roomCodeInput = document.getElementById('room-code-input');
    const joinError = document.getElementById('join-error');
    const roomPublicSwitch = document.getElementById('room-public-switch');

    // Oda İçi Elemanları
    const displayRoomCode = document.getElementById('display-room-code');
    const roomPlayerList = document.getElementById('room-player-list');
    const playerCountSpan = document.getElementById('player-count');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnLeaveRoom = document.getElementById('btn-leave-room');
    const roomStatusMsg = document.getElementById('room-status-msg');

    let isRegisterMode = false; 

    // --- EKRAN YÖNETİMİ ---
    function showScreen(screenName) {
        Object.values(screens).forEach(el => el.classList.add('hidden'));
        if(screens[screenName]) screens[screenName].classList.remove('hidden');
    }

    // --- YARDIMCI FONKSİYONLAR ---
    function createFakeEmail(nickname) {
        const cleanNick = nickname.trim().replace(/\s+/g, '').toLowerCase()
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
        return `${cleanNick}@emonrg.game`;
    }

    function generateRoomId() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Karışıklık önlemek için I, O, 0, 1 çıkardım
        let result = "";
        for(let i=0; i<6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // --- AUTH İŞLEMLERİ ---
    async function handleAuth() {
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
                const cred = await auth.createUserWithEmailAndPassword(email, password);
                await cred.user.updateProfile({ displayName: nickname });
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            authError.textContent = error.message;
            authError.classList.remove('hidden');
            btnAction.disabled = false;
        }
    }

    function toggleAuthMode() {
        isRegisterMode = !isRegisterMode;
        document.getElementById('auth-title').textContent = isRegisterMode ? "Kayıt Ol" : "Giriş Yap";
        btnAction.textContent = isRegisterMode ? "Kayıt Ol" : "Giriş Yap";
        btnToggleMode.textContent = isRegisterMode ? "Zaten hesabın var mı? Giriş Yap" : "Hesabın yok mu? Kayıt Ol";
    }

    // --- ODA YÖNETİMİ ---

    // 1. ODA OLUŞTURMA
    async function createRoom() {
        if (!currentUser) return;
        
        const roomId = generateRoomId();
        const isPublic = roomPublicSwitch.checked;

        const roomData = {
            id: roomId,
            host: currentUser.uid,
            isPublic: isPublic,
            status: 'waiting',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            players: {
                [currentUser.uid]: {
                    name: currentUser.displayName,
                    score: 0,
                    ready: true
                }
            }
        };

        try {
            // Veritabanına yaz
            await db.ref('rooms/' + roomId).set(roomData);
            enterRoom(roomId);
        } catch (error) {
            console.error("Oda oluşturulamadı:", error);
            alert("Oda oluşturulurken hata oluştu.");
        }
    }

    // 2. ODAYA KATILMA (KOD İLE)
    async function joinRoom(roomId) {
        if (!currentUser) return;
        roomId = roomId.toUpperCase();

        const roomRef = db.ref('rooms/' + roomId);
        
        try {
            const snapshot = await roomRef.get();
            if (!snapshot.exists()) {
                throw new Error("Böyle bir oda bulunamadı.");
            }

            const room = snapshot.val();
            if (room.status !== 'waiting') {
                throw new Error("Bu oda şu an oyunda.");
            }

            const playerCount = Object.keys(room.players || {}).length;
            if (playerCount >= 6) {
                throw new Error("Oda dolu (Max 6 kişi).");
            }

            // Odaya kendini ekle
            await roomRef.child('players/' + currentUser.uid).set({
                name: currentUser.displayName,
                score: 0,
                ready: false
            });

            enterRoom(roomId);

        } catch (error) {
            joinError.textContent = error.message;
            joinError.classList.remove('hidden');
        }
    }

    // 3. RASTGELE ODAYA KATILMA
    async function joinRandom() {
        try {
            // Sadece 'waiting' durumundaki ve 'isPublic' olan odaları getir
            // Firebase query sınırlı olduğu için istemci tarafında filtreleyeceğiz
            // Gerçek projede cloud function veya daha iyi bir indexleme gerekir
            const snapshot = await db.ref('rooms')
                .orderByChild('status').equalTo('waiting')
                .limitToFirst(20) // İlk 20 odayı getir
                .get();

            if (!snapshot.exists()) {
                alert("Şu an uygun oda yok. Kendiniz bir oda kurabilirsiniz!");
                showScreen('createRoom');
                return;
            }

            const rooms = snapshot.val();
            // Uygun odayı bul (Public olan ve dolu olmayan)
            const availableRoom = Object.values(rooms).find(r => 
                r.isPublic === true && Object.keys(r.players || {}).length < 6
            );

            if (availableRoom) {
                joinRoom(availableRoom.id);
            } else {
                alert("Uygun oda bulunamadı.");
            }

        } catch (error) {
            console.error(error);
            alert("Hata: " + error.message);
        }
    }

    // 4. ODA İÇİ DİNLEME VE ARAYÜZ GÜNCELLEME
    function enterRoom(roomId) {
        currentRoomId = roomId;
        showScreen('roomLobby');
        displayRoomCode.textContent = roomId;
        
        // Oda değişikliklerini dinle
        const roomRef = db.ref('rooms/' + roomId);
        
        roomListener = roomRef.on('value', (snapshot) => {
            const room = snapshot.val();
            
            if (!room) {
                // Oda silinmiş veya kurucu kapatmış
                leaveRoom(true);
                return;
            }

            updateRoomUI(room);
        });
    }

    function leaveRoom(forced = false) {
        if (currentRoomId) {
            // Listener'ı kaldır
            db.ref('rooms/' + currentRoomId).off('value', roomListener);
            
            // Eğer kendi isteğimizle çıkıyorsak veritabanından silelim
            if (!forced && currentUser) {
                db.ref(`rooms/${currentRoomId}/players/${currentUser.uid}`).remove();
            }

            currentRoomId = null;
        }
        
        if (forced) alert("Oda kapatıldı.");
        showScreen('lobbyMenu');
    }

    function updateRoomUI(room) {
        roomPlayerList.innerHTML = '';
        const players = Object.values(room.players || {});
        playerCountSpan.textContent = players.length;

        // Listeyi Doldur
        players.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="avatar">👤</span> ${p.name}`;
            roomPlayerList.appendChild(li);
        });

        // Boş slotları göster (Toplam 6 slot)
        for(let i=players.length; i<6; i++) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'Boş Slot';
            roomPlayerList.appendChild(li);
        }

        // Başlat Butonu Kontrolü (Sadece Host görebilir, En az 4 kişi)
        const isHost = (room.host === currentUser.uid);
        
        if (isHost) {
            btnStartGame.style.display = 'block';
            if (players.length >= 4) { // GEREKSİNİM: En az 4 kişi
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
    
    // Auth
    btnAction.addEventListener('click', handleAuth);
    btnToggleMode.addEventListener('click', toggleAuthMode);
    btnLogout.addEventListener('click', () => auth.signOut());
    
    // Menü Navigasyon
    if(btnSingleplayer) {
        btnSingleplayer.addEventListener('click', () => {
            showScreen(null); // Tüm overlayleri kapat
            document.getElementById('game').classList.remove('hidden');
            // script.js'deki oyunu başlat (Global fonksiyona ihtiyaç duyabiliriz)
            if (window.startGameSingle) window.startGameSingle(currentUser.displayName);
            else console.warn("startGameSingle fonksiyonu bulunamadı!");
        });
    }

    if(btnSettings) {
        btnSettings.addEventListener('click', () => {
            alert("Ayarlar menüsü yapım aşamasında.");
        });
    }

    btnShowCreate.addEventListener('click', () => showScreen('createRoom'));
    btnShowJoin.addEventListener('click', () => showScreen('joinRoom'));
    btnCreateCancel.addEventListener('click', () => showScreen('lobbyMenu'));
    btnJoinCancel.addEventListener('click', () => showScreen('lobbyMenu'));

    // Oda İşlemleri
    btnCreateConfirm.addEventListener('click', createRoom);
    
    btnJoinConfirm.addEventListener('click', () => {
        const code = roomCodeInput.value.trim();
        if(code.length === 6) joinRoom(code);
        else {
            joinError.textContent = "Lütfen 6 haneli kodu girin.";
            joinError.classList.remove('hidden');
        }
    });

    btnJoinRandom.addEventListener('click', joinRandom);
    btnLeaveRoom.addEventListener('click', () => leaveRoom(false));

    // Auth State Change
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            document.getElementById('welcome-msg').textContent = `Merhaba, ${user.displayName}`;
            showScreen('lobbyMenu');
        } else {
            showScreen('auth');
        }
    });
}

// Başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
