// Firebase Config (Aynı config)
const firebaseConfig = {
    apiKey: "AIzaSyCN7_FvUFjWAjIFmdG7yO_nJUL0RJZmD_0",
    authDomain: "mini-golf-arena-493dc.firebaseapp.com",
    projectId: "mini-golf-arena-493dc",
    storageBucket: "mini-golf-arena-493dc.firebasestorage.app",
    messagingSenderId: "1025857887392",
    appId: "1:1025857887392:web:5ad0a2428311f8a679bdc5",
    measurementId: "G-1899GSVYY6"
};

// Admin paneli için ayrı Firebase app oluştur
const adminApp = firebase.initializeApp(firebaseConfig, 'adminApp');
const auth = adminApp.auth();
const db = adminApp.firestore();
const socket = io();

// Session persistence ayarla (hızlı giriş için)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// UI Elements
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const roomsBody = document.getElementById('rooms-body');
const loginError = document.getElementById('login-error');
const spectatorOverlay = document.getElementById('spectator-overlay');

// Auth state listener - otomatik giriş için
let isAuthChecked = false;
auth.onAuthStateChanged((user) => {
    if (user && !isAuthChecked) {
        // Kullanıcı zaten giriş yapmış, admin kontrolü yap
        console.log("Otomatik giriş tespit edildi:", user.email);
        loginScreen.classList.add('hidden');
        socket.emit('adminLogin', user.uid);
        isAuthChecked = true;
    } else if (!user) {
        // Kullanıcı ��ok, login ekranını göster
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
});

// Login
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        // Auth state listener otomatik olarak adminLogin emit edecek
    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut();
    location.reload();
});

document.getElementById('btn-refresh').addEventListener('click', () => {
    socket.emit('getAllRooms');
});

document.getElementById('close-spectator').addEventListener('click', () => {
    spectatorOverlay.classList.add('hidden');
    // İzlemeyi durdur - odadan ayrıl
    if (window.currentSpectatingRoomId) {
        socket.emit('stopSpectate', window.currentSpectatingRoomId);
        window.currentSpectatingRoomId = null;
    }
    // Canvas'ı temizle
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Socket Events
socket.on('adminLoginSuccess', () => {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    socket.emit('getAllRooms');

    // Periyodik yenileme
    setInterval(() => {
        socket.emit('getAllRooms');
    }, 5000);
});

socket.on('error', (msg) => {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
});

socket.on('roomList', (rooms) => {
    roomsBody.innerHTML = '';
    rooms.forEach(room => {
        const tr = document.createElement('tr');

        const playerNames = room.players.map(p => `${p.name} (${p.score})`).join(', ');

        tr.innerHTML = `
            <td>${room.id}</td>
            <td><span style="padding:4px 8px; border-radius:4px; background:${room.status === 'playing' ? '#10b981' : '#f59e0b'}">${room.status}</span></td>
            <td>${room.playerCount}/6 <br> <small style="color:#94a3b8">${playerNames}</small></td>
            <td>${room.currentHole || 0}. Harita</td>
            <td>
                <button class="action-btn btn-watch" onclick="watchRoom('${room.id}')">Canlı İzle</button>
                <button class="action-btn btn-end" onclick="endGame('${room.id}')">Lobiyi Boz</button>
            </td>
        `;
        roomsBody.appendChild(tr);
    });

    if (rooms.length === 0) {
        roomsBody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aktif oda yok.</td></tr>';
    }
});

// Global Functions for Buttons
window.watchRoom = function (roomId) {
    spectatorOverlay.classList.remove('hidden');
    window.currentSpectatingRoomId = roomId;
    
    socket.emit('spectateRoom', roomId);
};

window.endGame = function (roomId) {
    if (confirm(`${roomId} odasını tamamen kapatmak istediğine emin misin? Tüm oyuncular atılacak.`)) {
        socket.emit('destroyRoom', roomId);
    }
};

// Spectator Rendering System
let spectatorCanvas = null;
let spectatorCtx = null;
let spectatorData = { players: {}, currentHole: 0 };

// Harita verileri (maps.js'den kopyalandı)
const ADMIN_MAPS = [
  { id: 1, par: 3, start: { x: 50, y: 50 }, hole: { x: 750, y: 50 }, walls: [
      { x: 250, y: 0, w: 20, h: 350 }, { x: 530, y: 150, w: 20, h: 350 }
  ]},
  { id: 2, par: 4, start: { x: 50, y: 250 }, hole: { x: 750, y: 250 }, walls: [
      { x: 200, y: 100, w: 30, h: 30 }, { x: 200, y: 370, w: 30, h: 30 },
      { x: 350, y: 50, w: 30, h: 120 }, { x: 350, y: 330, w: 30, h: 120 },
      { x: 500, y: 100, w: 30, h: 30 }, { x: 500, y: 370, w: 30, h: 30 },
      { x: 350, y: 235, w: 30, h: 30 }
  ]},
  { id: 3, par: 3, start: { x: 80, y: 250 }, hole: { x: 720, y: 250 }, walls: [
      { x: 200, y: 0, w: 400, h: 200 }, { x: 200, y: 300, w: 400, h: 200 },
      { x: 380, y: 220, w: 40, h: 60 }
  ]},
  { id: 4, par: 5, start: { x: 50, y: 50 }, hole: { x: 750, y: 450 }, walls: [
      { x: 150, y: 0, w: 20, h: 400 }, { x: 300, y: 100, w: 20, h: 400 },
      { x: 450, y: 0, w: 20, h: 400 }, { x: 600, y: 100, w: 20, h: 400 }
  ]},
  { id: 5, par: 4, start: { x: 400, y: 450 }, hole: { x: 400, y: 250 }, walls: [
      { x: 250, y: 100, w: 300, h: 20 }, { x: 250, y: 380, w: 300, h: 20 },
      { x: 250, y: 100, w: 20, h: 300 }, { x: 530, y: 100, w: 20, h: 100 },
      { x: 530, y: 260, w: 20, h: 140 }, { x: 600, y: 180, w: 20, h: 140 }
  ]}
];

socket.on('spectateStarted', (room) => {
    console.log("İzleme başladı:", room);
    spectatorData = { 
        players: room.players || {},
        currentHole: room.currentHole || 0,
        status: room.status
    };
    
    spectatorCanvas = document.getElementById('gameCanvas');
    spectatorCtx = spectatorCanvas.getContext('2d');
    
    // Basit render başlat
    renderSpectatorView();
});

// Oyuncu hareketlerini dinle
socket.on('playerMoved', ({ socketId, x, y }) => {
    if (spectatorData.players[socketId]) {
        spectatorData.players[socketId].x = x;
        spectatorData.players[socketId].y = y;
    }
});

// Oda güncellemelerini dinle (spectator için)
socket.on('roomUpdated', (room) => {
    if (window.currentSpectatingRoomId === room.id) {
        spectatorData.players = room.players || {};
        spectatorData.currentHole = room.currentHole || 0;
        spectatorData.status = room.status;
    }
});

function renderSpectatorView() {
    if (!spectatorCanvas || !spectatorCtx || !window.currentSpectatingRoomId) return;
    
    const w = spectatorCanvas.width;
    const h = spectatorCanvas.height;
    
    // Arka plan (yeşil çim)
    spectatorCtx.fillStyle = '#9ee6c9';
    spectatorCtx.fillRect(0, 0, w, h);
    
    // Çerçeve
    spectatorCtx.strokeStyle = '#7bbf9a';
    spectatorCtx.lineWidth = 4;
    spectatorCtx.strokeRect(2, 2, w - 4, h - 4);
    
    // Mevcut haritayı al
    const currentMap = ADMIN_MAPS[spectatorData.currentHole] || null;
    
    // Duvarları çiz
    if (currentMap && currentMap.walls) {
        spectatorCtx.fillStyle = '#5d4037';
        currentMap.walls.forEach(wall => {
            spectatorCtx.fillRect(wall.x, wall.y, wall.w, wall.h);
            // Gölge efekti
            spectatorCtx.fillStyle = 'rgba(0,0,0,0.2)';
            spectatorCtx.fillRect(wall.x + wall.w - 4, wall.y, 4, wall.h);
            spectatorCtx.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
            spectatorCtx.fillStyle = '#5d4037';
        });
    }
    
    // Deliği çiz
    if (currentMap && currentMap.hole) {
        spectatorCtx.beginPath();
        spectatorCtx.fillStyle = '#111';
        spectatorCtx.arc(currentMap.hole.x, currentMap.hole.y, 12, 0, Math.PI * 2);
        spectatorCtx.fill();
        spectatorCtx.closePath();
    }
    
    // Bilgi metni
    spectatorCtx.fillStyle = '#1e293b';
    spectatorCtx.font = 'bold 16px sans-serif';
    spectatorCtx.fillText(`Harita: ${spectatorData.currentHole + 1}/${ADMIN_MAPS.length} | Durum: ${spectatorData.status}`, 20, 30);
    
    // Oyuncuları çiz
    Object.entries(spectatorData.players).forEach(([socketId, player]) => {
        const x = player.x || (currentMap ? currentMap.start.x : 400);
        const y = player.y || (currentMap ? currentMap.start.y : 300);
        
        // Top rengi
        let color = '#ffffff';
        switch (player.color) {
            case 'red': color = '#ef4444'; break;
            case 'blue': color = '#3b82f6'; break;
            case 'purple': color = '#a855f7'; break;
            case 'green': color = '#22c55e'; break;
            case 'yellow': color = '#facc15'; break;
            case 'pink': color = '#ec4899'; break;
            case 'turquoise': color = '#14b8a6'; break;
        }
        
        // Top
        spectatorCtx.beginPath();
        spectatorCtx.fillStyle = color;
        spectatorCtx.shadowColor = 'rgba(0,0,0,0.2)';
        spectatorCtx.shadowBlur = 4;
        spectatorCtx.shadowOffsetY = 2;
        spectatorCtx.arc(x, y, 8, 0, Math.PI * 2);
        spectatorCtx.fill();
        spectatorCtx.shadowColor = 'transparent';
        spectatorCtx.closePath();
        
        // İsim
        spectatorCtx.fillStyle = '#1e293b';
        spectatorCtx.font = 'bold 12px sans-serif';
        spectatorCtx.textAlign = 'center';
        spectatorCtx.fillText(player.name, x, y - 15);
        
        // Skor (altında)
        spectatorCtx.font = '10px sans-serif';
        spectatorCtx.fillStyle = '#475569';
        spectatorCtx.fillText(`${player.score || 0} puan`, x, y + 25);
    });
    
    // Animasyon devam et
    if (window.currentSpectatingRoomId) {
        requestAnimationFrame(renderSpectatorView);
    }
}
