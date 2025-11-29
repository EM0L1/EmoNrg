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

// Aynı Firebase kullanıcısının (uid) aynı anda sadece tek socket ile bağlı kalması için
// uid -> socket.id ve socket.id -> uid map'leri tutuyoruz
const uidToSocket = {};
const socketToUid = {};

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

function registerPlayerSocket(uid, socket) {
    const existingSocketId = uidToSocket[uid];
    if (existingSocketId && existingSocketId !== socket.id) {
        // Eski socket'i düşür (başka sekme/cihaz)
        const oldSocket = io.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
            oldSocket.emit('forceLogout', 'Bu hesap başka bir cihazdan açıldı. Oturum sonlandırıldı.');
            // Eski socket'i temizle
            handleDisconnect(oldSocket);
            oldSocket.disconnect(true);
        }
    }
    uidToSocket[uid] = socket.id;
    socketToUid[socket.id] = uid;
}

io.on('connection', (socket) => {
    // Buradaki log sadece teknik bağlantıyı gösterir
    // console.log('Biri bağlandı: ' + socket.id);

    // 1. ODA KURMA
    socket.on('createRoom', ({ uid, name, isPublic }) => {
        const roomId = generateRoomId();

        // Bu uid için aktif socket'i kaydet (eski bağlantı varsa düşürülür)
        registerPlayerSocket(uid, socket);
        
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

        // Bu uid için aktif socket'i kaydet (eski bağlantı varsa düşürülür)
        registerPlayerSocket(uid, socket);

        room.players[socket.id] = {
            uid: uid,
            name: name,
            score: 0,
            ready: false,
            x: 0,
            y: 0
        };

        socket.join(roomId);
        io.to(roomId).emit('roomUpdated', room);   // Odayı herkese güncelle
        socket.emit('joinedRoom', { roomId, room }); // Sadece bu istemciye "sen artık bu odadasın" de
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

            // Bu uid için aktif socket'i kaydet (eski bağlantı varsa düşürülür)
            registerPlayerSocket(uid, socket);

            room.players[socket.id] = { uid, name, score: 0, ready: false, x: 0, y: 0 };
            socket.join(availableRoomId);
            io.to(availableRoomId).emit('roomUpdated', room);         // herkese güncelle
            socket.emit('joinedRoom', { roomId: availableRoomId, room }); // sadece bu istemciye özel bilgi
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
            io.to(roomId).emit('gameStarted', room); // tüm oyunculara oda bilgisiyle birlikte gönder
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

    // 7. BİR OYUNCU DELİĞİ TAMAMLADIĞINDA (SKOR GÜNCELLEME)
    socket.on('holeCompleted', ({ roomId, points }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        // Skoru güncelle
        player.score = (player.score || 0) + (points || 0);
        player.finishedCurrentHole = true;

        // Tüm oyuncular bu deliği bitirdiyse bir sonraki deliğe geç
        const allFinished = Object.values(room.players).every(p => p.finishedCurrentHole);
        if (allFinished) {
            // Deliği ilerlet
            room.currentHole = (room.currentHole || 0) + 1;
            // Her oyuncu için finished bayrağını sıfırla
            Object.values(room.players).forEach(p => { p.finishedCurrentHole = false; });

            // Skorlar güncellenmiş oda durumunu gönder ve yeni deliğe geç sinyali ver
            io.to(roomId).emit('advanceHole', room);
            console.log(`[DELIK TAMAMLANDI] Oda: ${roomId}, Tüm oyuncular deliği bitirdi. Yeni delik index: ${room.currentHole}`);
        } else {
            // Sadece skor tablosunu tazelemek için güncel odayı yayınla
            io.to(roomId).emit('roomUpdated', room);
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

        // Socket-UID eşleşmelerini temizle
        const uid = socketToUid[socket.id];
        if (uid) {
            delete socketToUid[socket.id];
            if (uidToSocket[uid] === socket.id) {
                delete uidToSocket[uid];
            }
        }
    }
});

const PORT = 4513; 
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SUNUCU HAZIR! http://localhost:${PORT} adresinden girebilirsin.`);
});
