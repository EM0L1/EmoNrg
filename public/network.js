// Network Logic (Socket.io)

window.gameSocket = null; // Will be assigned when connected
window.isMultiplayer = false;
window.myUid = null;
window.currentRoomIdForGame = null;

// Çok oyunculu başlatıcı: oda bilgisini ve kendi uid'ini alır
window.startGameMultiplayer = function (room, myUidParam) {
    console.log("Çok oyunculu oyun başlatılıyor...", room);
    
    // Overlay'leri kapat
    const overlays = document.querySelectorAll('.overlay');
    overlays.forEach(el => el.classList.add('hidden'));

    if (window.uiElements && window.uiElements.gameMain) {
        window.uiElements.gameMain.classList.remove('hidden');
    }

    window.isMultiplayer = true;
    window.myUid = myUidParam;
    window.currentRoomIdForGame = room.id;

    // Oyuncu listesini odadaki tüm oyunculardan oluştur
    // room.players objesi socketId -> player verisi şeklindedir
    window.players = Object.entries(room.players || {}).map(([sid, p], index) => ({
        id: index + 1,                 // basit sıra numarası
        socketId: sid,                 // Socket ID'yi sakla (remoteBalls ile eşleştirmek için)
        name: p.name,
        uid: p.uid,
        totalStrokes: 0,
        totalScore: p.score || 0,
        mapScores: {},
        isMe: p.uid === window.myUid,
        color: p.color || 'white'
    }));

    // Kendi adını bul ve ekrana yaz
    const me = window.players.find(p => p.isMe) || window.players[0];
    if (!window.myPlayerId) window.myPlayerId = me ? me.id : Math.floor(1000 + Math.random() * 9000);

    if (window.uiElements && window.uiElements.displayName) {
        window.uiElements.displayName.textContent = me ? `${me.name} #${window.myPlayerId}` : `Oyuncu #${window.myPlayerId}`;
    }
    if (window.uiElements && window.uiElements.statusEl) {
        window.uiElements.statusEl.textContent = 'Oyun başlatılıyor...';
    }

    if (window.renderPlayerList) window.renderPlayerList();

    // Skorları sıfırla
    window.scoreHistory = [];
    window.currentStrokes = 0;
    if (window.updateScorecardUI) window.updateScorecardUI();

    // Haritayı yükle ve oyunu başlat
    window.currentMapIndex = room.currentHole || 0;
    if (window.loadMap) {
        window.loadMap(window.currentMapIndex);
    }
    
    // Game loop'u başlat (eğer çalışmıyorsa)
    if (!window.gameLoopRunning && window.gameLoop) {
        window.gameLoopRunning = true;
        requestAnimationFrame(window.gameLoop);
    }
};

// Sunucudan gelen diğer oyuncuların top pozisyonlarını güncelle
window.updateRemoteBall = function (socketId, x, y) {
    if (!window.remoteBalls) window.remoteBalls = {};
    window.remoteBalls[socketId] = { x, y };
};

// Sunucudan gelen yeni delik bilgisiyle tüm oyuncuların skorlarını ve map skorlarını eşitle
window.advanceHole = function (room) {
    if (!window.isMultiplayer) return;
    console.log("advanceHole çağrıldı, yeni harita yüklenecek:", room.currentHole);
    syncPlayersFromRoom(room);
    
    // Skor kartını kapat ve butonu resetle
    if (window.uiElements && window.uiElements.scorecardOverlay) {
        window.uiElements.scorecardOverlay.classList.add('hidden');
    }
    if (window.uiElements && window.uiElements.btnCloseScorecard) {
        window.uiElements.btnCloseScorecard.disabled = false;
        window.uiElements.btnCloseScorecard.textContent = 'Sonraki deliğe hazırım';
    }
    
    // Bir sonraki haritaya geç
    if (window.loadMap) {
        window.loadMap(room.currentHole || 0);
    }
};

// Tüm oyuncular deliği bitirdiğinde skor ekranını aç ve "Hazırım" butonunu aktifleştir
window.enableNextHoleButton = function (room) {
    if (!window.isMultiplayer) return;
    console.log("enableNextHoleButton çağrıldı - tüm oyuncular deliği bitirdi");
    syncPlayersFromRoom(room);
    if (window.renderPlayerList) window.renderPlayerList();
    if (window.updateScorecardUI) window.updateScorecardUI();

    // Eğer skor kartı henüz açılmadıysa şimdi aç
    if (window.uiElements && window.uiElements.scorecardOverlay && window.uiElements.scorecardOverlay.classList.contains('hidden')) {
        if (window.showScorecard) {
            window.showScorecard(false, null); // Oyun bitmedi, sadece delik tamamlandı
        }
    }
    if (window.uiElements && window.uiElements.btnCloseScorecard) {
        window.uiElements.btnCloseScorecard.disabled = false;
        window.uiElements.btnCloseScorecard.textContent = 'Sonraki deliğe hazırım';
    }
};

// Yardımcı: server odasından oyuncu skorlarını ve map skorlarını players dizisine uygula
function syncPlayersFromRoom(room) {
    const roomPlayers = room.players || {};
    if (!window.players) return;

    window.players.forEach(p => {
        const serverPlayer = Object.values(roomPlayers).find(sp => sp.uid === p.uid);
        if (serverPlayer) {
            p.totalScore = serverPlayer.score || 0;
            p.mapScores = serverPlayer.mapScores || {};
        }
    });
}
