const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// DÜZELTME: Dosyalar 'public' klasöründe olduğu için yolu oraya veriyoruz
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- OYUN SUNUCUSU BELLEĞİ ---
const rooms = {};

// --- YARDIMCI FONKSİYONLAR ---
function generateRoomId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    do {
        result = "";
        for(let i=0; i<6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    } while (rooms[result]); 
    return result;
}

io.on('connection', (socket) => {
    // Buradaki log sadece teknik bağlantıyı gösterir
    // console.log('Biri bağlandı: ' + socket.id);

    // 1. ODA KURMA
    socket.on('createRoom', ({ uid, name, isPublic }) => {
        const roomId = generateRoomId();
        
        rooms[roomId] = {
            id: roomId,
            host: socket.id, 
            isPublic: isPublic,
            status: 'waiting',
            players: {
                [socket.id]: {
                    uid: uid,
                    name: name,
                    score: 0,
                    ready: true,
                    x: 0, 
                    y: 0
                }
            }
        };

        socket.join(roomId);
        socket.emit('roomCreated', { roomId, room: rooms[roomId] });
        console.log(`[ODA KURULDU] ID: ${roomId} - Kurucu: ${name} (UID: ${uid})`);
    });

    // 2. ODAYA KATILMA
    socket.on('joinRoom', ({ roomId, uid, name }) => {
        const room = rooms[roomId];

        if (!room) {
            socket.emit('error', 'Böyle bir oda bulunamadı.');
            return;
        }
        if (room.status !== 'waiting') {
            socket.emit('error', 'Bu oda şu an oyunda.');
            return;
        }
        if (Object.keys(room.players).length >= 6) {
            socket.emit('error', 'Oda dolu.');
            return;
        }

        room.players[socket.id] = {
            uid: uid,
            name: name,
            score: 0,
            ready: false,
            x: 0,
            y: 0
        };

        socket.join(roomId);
        io.to(roomId).emit('roomUpdated', room);
        console.log(`[KATILIM] ${name} (UID: ${uid}) odaya katıldı: ${roomId}`);
    });

    // 3. RASTGELE KATILMA
    socket.on('joinRandom', ({ uid, name }) => {
        const availableRoomId = Object.keys(rooms).find(id => 
            rooms[id].isPublic && 
            rooms[id].status === 'waiting' && 
            Object.keys(rooms[id].players).length < 6
        );

        if (availableRoomId) {
            const room = rooms[availableRoomId];
            room.players[socket.id] = { uid, name, score: 0, ready: false, x: 0, y: 0 };
            socket.join(availableRoomId);
            io.to(availableRoomId).emit('roomUpdated', room);
            console.log(`[RASTGELE KATILIM] ${name} (UID: ${uid}) odaya katıldı: ${availableRoomId}`);
        } else {
            socket.emit('error', 'Uygun oda bulunamadı. Lütfen yeni oda kurun.');
        }
    });

    // 4. ODADAN AYRILMA
    socket.on('leaveRoom', () => {
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
        // console.log('Biri çıktı: ' + socket.id);
    });

    // 5. OYUNU BAŞLAT
    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if(room && room.host === socket.id) {
            room.status = 'playing';
            io.to(roomId).emit('gameStarted');
            console.log(`[OYUN BAŞLADI] Oda: ${roomId}`);
        }
    });

    // 6. OYUN İÇİ HAREKET
    socket.on('updatePosition', ({ roomId, x, y, vx, vy }) => {
        const room = rooms[roomId];
        if (room && room.players[socket.id]) {
            const p = room.players[socket.id];
            p.x = x;
            p.y = y;
            socket.to(roomId).emit('playerMoved', { socketId: socket.id, x, y, vx, vy });
        }
    });

    function handleDisconnect(socket) {
        const roomId = Object.keys(rooms).find(id => rooms[id].players[socket.id]);
        
        if (roomId) {
            const room = rooms[roomId];
            const player = room.players[socket.id]; // Oyuncu bilgilerini al
            const wasHost = (room.host === socket.id);
            
            delete room.players[socket.id];
            socket.leave(roomId);

            console.log(`[AYRILMA] ${player ? player.name : 'Biri'} (UID: ${player ? player.uid : '?'}) odadan ayrıldı: ${roomId}`);

            if (Object.keys(room.players).length === 0) {
                delete rooms[roomId];
                console.log(`[ODA SİLİNDİ] ${roomId} (Boşaldığı için)`);
            } else {
                if (wasHost) {
                    const nextHostId = Object.keys(room.players)[0];
                    room.host = nextHostId;
                    // Yeni hostun ismini bulalım
                    const newHostName = room.players[nextHostId].name;
                    console.log(`[YENİ HOST] Oda: ${roomId}, Yeni Host: ${newHostName}`);
                }
                io.to(roomId).emit('roomUpdated', room);
            }
        }
    }
});

const PORT = 4513; 
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SUNUCU HAZIR! http://localhost:${PORT} adresinden girebilirsin.`);
});
