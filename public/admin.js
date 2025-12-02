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
auth.onAuthStateChanged((user) => {
    if (user) {
        // Kullanıcı zaten giriş yapmış, admin kontrolü yap
        socket.emit('adminLogin', user.uid);
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
    
    // Arka plan
    spectatorCtx.fillStyle = '#9ee6c9';
    spectatorCtx.fillRect(0, 0, w, h);
    
    // Çerçeve
    spectatorCtx.strokeStyle = '#7bbf9a';
    spectatorCtx.lineWidth = 4;
    spectatorCtx.strokeRect(2, 2, w - 4, h - 4);
    
    // Bilgi metni
    spectatorCtx.fillStyle = '#1e293b';
    spectatorCtx.font = 'bold 16px sans-serif';
    spectatorCtx.fillText(`Harita: ${spectatorData.currentHole + 1} | Durum: ${spectatorData.status}`, 20, 30);
    
    // Oyuncuları çiz
    Object.entries(spectatorData.players).forEach(([socketId, player]) => {
        const x = player.x || 400;
        const y = player.y || 300;
        
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
        spectatorCtx.arc(x, y, 8, 0, Math.PI * 2);
        spectatorCtx.fill();
        
        // İsim
        spectatorCtx.fillStyle = '#1e293b';
        spectatorCtx.font = 'bold 12px sans-serif';
        spectatorCtx.textAlign = 'center';
        spectatorCtx.fillText(player.name, x, y - 15);
        
        // Skor
        spectatorCtx.fillText(`Skor: ${player.score || 0}`, x, y + 25);
    });
    
    // Animasyon devam et
    if (window.currentSpectatingRoomId) {
        requestAnimationFrame(renderSpectatorView);
    }
}
