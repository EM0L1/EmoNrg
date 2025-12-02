const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const admin = require('firebase-admin');

// Firebase Admin SDK Başlatma
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(express.static('public'));

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
        for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
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
            status: 'waiting', // EKLENDİ: joinRandom için gerekli
            players: {
                [socket.id]: {
                    uid: uid,
                    name: name,
                    score: 0,
                    ready: true,
                    x: 0,
                    y: 0,
                    color: 'white'
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
        // Mevcut renkleri bul
        const takenColors = new Set(Object.values(room.players).map(p => p.color));
        const allColors = ['red', 'blue', 'purple', 'green', 'yellow', 'white', 'pink', 'turquoise'];
        const assignedColor = allColors.find(c => !takenColors.has(c)) || 'white';

        room.players[socket.id] = {
            uid: uid,
            name: name,
            score: 0,
            ready: false,
            x: 0,
            y: 0,
            color: assignedColor
        };

        socket.join(roomId);
        io.to(roomId).emit('roomUpdated', room);   // Odayı herkese güncelle
        socket.emit('joinedRoom', { roomId, room }); // Sadece bu istemciye "sen artık bu odadasın" de
        console.log(`[KATILIM] ${name} (UID: ${uid}) odaya katıldı: ${roomId} (Renk: ${assignedColor})`);
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

            // Mevcut renkleri bul
            const takenColors = new Set(Object.values(room.players).map(p => p.color));
            const allColors = ['red', 'blue', 'purple', 'green', 'yellow', 'white', 'pink', 'turquoise'];
            const assignedColor = allColors.find(c => !takenColors.has(c)) || 'white';

            room.players[socket.id] = { uid, name, score: 0, ready: false, x: 0, y: 0, color: assignedColor };
            socket.join(availableRoomId);
            io.to(availableRoomId).emit('roomUpdated', room);         // herkese güncelle
            socket.emit('joinedRoom', { roomId: availableRoomId, room }); // sadece bu istemciye özel bilgi
            console.log(`[RASTGELE KATILIM] ${name} (UID: ${uid}) odaya katıldı: ${availableRoomId} (Renk: ${assignedColor})`);
        } else {
            socket.emit('error', 'Uygun oda bulunamadı. Lütfen yeni oda kurun.');
        }
    });

    // RENK SEÇİMİ
    socket.on('selectColor', ({ roomId, color }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        // Renk başkası tarafından alınmış mı?
        const isTaken = Object.values(room.players).some(p => p.color === color && p.uid !== player.uid);

        if (isTaken) {
            socket.emit('error', 'Bu renk zaten alınmış.');
            return;
        }

        player.color = color;
        io.to(roomId).emit('roomUpdated', room);
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
        if (room && room.host === socket.id) {
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

    // 7. BİR OYUNCU DELİĞİ TAMAMLADIĞINDA (SKOR & MAP SKORU GÜNCELLEME)
    socket.on('holeCompleted', ({ roomId, points, mapId }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        // Skoru güncelle
        player.score = (player.score || 0) + (points || 0);
        // Harita bazlı skorları tut
        if (mapId !== undefined) {
            if (!player.mapScores) player.mapScores = {};
            player.mapScores[mapId] = points;
        }
        player.finishedCurrentHole = true;

        // Tüm oyuncular deliği bitirdi mi?
        const allFinished = Object.values(room.players).every(p => p.finishedCurrentHole);
        if (allFinished) {
            // Herkese "artık tüm oyuncular deliği bitirdi" bilgisini gönder
            io.to(roomId).emit('holeAllFinished', room);
            console.log(`[DELIK TAMAMLANDI] Oda: ${roomId}, tüm oyuncular deliği bitirdi. Hazır bekleniyor.`);
        }

        // Skor tablosunu güncel tutmak için her durumda oda durumunu yayınla
        io.to(roomId).emit('roomUpdated', room);
    });

    // 8. OYUNCULAR BİR SONRAKİ DELİĞE HAZIR OLDUĞUNU BİLDİRDİĞİNDE
    // 8. OYUNCULAR BİR SONRAKİ DELİĞE HAZIR OLDUĞUNU BİLDİRDİĞİNDE
    socket.on('readyNextHole', ({ roomId, isGameOver }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players[socket.id];
        if (!player) return;

        player.readyForNextHole = true;
        // Eğer bir oyuncu oyun bitti diyorsa, oda için de bitmiş sayabiliriz (basitlik için)
        if (isGameOver) room.isGameOver = true;

        const allReady = Object.values(room.players).every(
            p => p.finishedCurrentHole && p.readyForNextHole
        );

        if (allReady) {
            if (room.isGameOver) {
                // OYUN BİTTİ
                console.log(`[OYUN BİTTİ] Oda: ${roomId}. İstatistikler kaydediliyor...`);
                saveRoomStats(room);

                // Oyuncuları lobiye döndür veya bitiş ekranı göster (şimdilik lobiye dönüyorlar)
                io.to(roomId).emit('gameFinished', room);

                // Odayı temizle veya resetle
                room.status = 'waiting';
                room.currentHole = 0;
                room.isGameOver = false;
                Object.values(room.players).forEach(p => {
                    p.score = 0;
                    p.mapScores = {};
                    p.ready = false;
                    p.finishedCurrentHole = false;
                    p.readyForNextHole = false;
                });
                io.to(roomId).emit('roomUpdated', room);

            } else {
                // YENİ DELİĞE GEÇ
                room.currentHole = (room.currentHole || 0) + 1;
                Object.values(room.players).forEach(p => {
                    p.finishedCurrentHole = false;
                    p.readyForNextHole = false;
                });

                io.to(roomId).emit('advanceHole', room);
                console.log(`[SONRAKİ DELİK] Oda: ${roomId}, tüm oyuncular hazır. Yeni delik index: ${room.currentHole}`);
            }
        } else {
            // Sadece bilgi amaçlı lobi güncellemesi
            io.to(roomId).emit('roomUpdated', room);
        }
    });

    // --- ADMIN PANEL EVENTS ---
    socket.on('adminLogin', async (uid) => {
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists && userDoc.data().role === 'manager') {
                socket.isAdmin = true;
                socket.emit('adminLoginSuccess');
                console.log(`[ADMIN GİRİŞİ] UID: ${uid}`);
            } else {
                socket.emit('error', 'Yetkisiz giriş denemesi.');
            }
        } catch (error) {
            console.error("Admin login hatası:", error);
            socket.emit('error', 'Giriş hatası.');
        }
    });

    socket.on('getAllRooms', () => {
        if (!socket.isAdmin) return;

        // Odaları diziye çevirip gönder
        const roomList = Object.values(rooms).map(r => ({
            id: r.id,
            host: r.host,
            playerCount: Object.keys(r.players).length,
            status: r.status,
            currentHole: r.currentHole,
            players: Object.values(r.players).map(p => ({ name: p.name, score: p.score }))
        }));
        socket.emit('roomList', roomList);
    });

    socket.on('spectateRoom', (roomId) => {
        if (!socket.isAdmin) return;
        const room = rooms[roomId];
        if (room) {
            socket.join(roomId); // Odayı dinlemeye başla
            socket.emit('spectateStarted', room);
            console.log(`[ADMIN İZLİYOR] Admin ${socket.id} -> Oda ${roomId}`);
        } else {
            socket.emit('error', 'Oda bulunamadı.');
        }
    });

    socket.on('forceEndGame', (roomId) => {
        if (!socket.isAdmin) return;
        const room = rooms[roomId];
        if (room) {
            console.log(`[ADMIN OYUNU BİTİRDİ] Oda: ${roomId}`);
            io.to(roomId).emit('gameFinished', room); // Normal bitiş gibi davran

            // Odayı resetle
            room.status = 'waiting';
            room.currentHole = 0;
            room.isGameOver = false;
            Object.values(room.players).forEach(p => {
                p.score = 0;
                p.mapScores = {};
                p.ready = false;
                p.finishedCurrentHole = false;
                p.readyForNextHole = false;
            });
            io.to(roomId).emit('roomUpdated', room);

            // Adminlere güncel listeyi at
            // (Gerçek uygulamada broadcast yapmak daha iyi olurdu)
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
