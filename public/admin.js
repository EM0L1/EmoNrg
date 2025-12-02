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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const socket = io();

// UI Elements
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const roomsBody = document.getElementById('rooms-body');
const loginError = document.getElementById('login-error');
const spectatorOverlay = document.getElementById('spectator-overlay');

// Login
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        // Sunucuya admin olduğunu bildir
        socket.emit('adminLogin', cred.user.uid);
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
    
    // Game.js'i spectator modunda başlat
    window.isSpectator = true;

    socket.emit('spectateRoom', roomId);
};

window.endGame = function (roomId) {
    if (confirm(`${roomId} odasını tamamen kapatmak istediğine emin misin? Tüm oyuncular atılacak.`)) {
        socket.emit('destroyRoom', roomId);
    }
};

// Spectator Events (Game.js tarafından da dinlenebilir ama burada loglayalım)
socket.on('spectateStarted', (room) => {
    console.log("İzleme başladı:", room);
    // Haritayı yükle
    if (window.loadMap) {
        window.loadMap(room.currentHole || 0);
    }
});
