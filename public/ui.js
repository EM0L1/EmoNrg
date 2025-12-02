// UI Elements and Logic
window.UI = {};

// DOM Elements
const uiElements = {
    lobby: document.getElementById('lobby'),
    gameMain: document.getElementById('game'),
    displayName: document.getElementById('display-name'),
    statusEl: document.getElementById('status'),
    scorecardOverlay: document.getElementById('scorecard-overlay'),
    scorecardHead: document.getElementById('scorecard-head'),
    scorecardBody: document.getElementById('scorecard-body'),
    btnCloseScorecard: document.getElementById('btn-close-scorecard'),
    btnRestartGame: document.getElementById('btn-restart-game'),
    roundResultTitle: document.getElementById('round-result-title'),
    roundResultPoints: document.getElementById('round-result-points'),
    roundResultArea: document.getElementById('round-result-area'),
    mapInfoEl: document.getElementById('map-info'),
    parInfoEl: document.getElementById('par-info'),
    strokeInfoEl: document.getElementById('stroke-info'),
    colorErrorEl: document.getElementById('color-error'),
    colorOptionButtons: document.querySelectorAll('.color-option'),
    playerListEl: document.getElementById('player-list'),
    powerContainer: document.getElementById('power-container'),
    powerTouchArea: document.getElementById('power-touch-area'),
    shootBtn: document.getElementById('shoot-btn'),
    readyCountInfo: document.getElementById('ready-count-info'),
    lobbyMenu: document.getElementById('lobby-menu')
};

// Expose elements globally if needed, or just use them in functions
window.uiElements = uiElements;

// Render player list
window.renderPlayerList = function () {
    if (!uiElements.playerListEl) return;
    uiElements.playerListEl.innerHTML = '';
    
    if (!window.players || window.players.length === 0) return;
    
    window.players.forEach(player => {
        const li = document.createElement('li');
        li.style.marginBottom = '8px';
        li.style.padding = '8px';
        li.style.background = player.isMe ? '#e0f2fe' : '#f8fafc';
        li.style.borderRadius = '6px';
        li.style.border = '1px solid #cbd5e1';
        
        li.innerHTML = `
            <strong>${player.name}</strong> ${player.isMe ? '(Sen)' : ''}<br>
            <small>Skor: ${player.totalScore || 0}</small>
        `;
        
        uiElements.playerListEl.appendChild(li);
    });
};

// Update game UI
window.updateGameUI = function () {
    if (window.currentMap) {
        if (uiElements.mapInfoEl) uiElements.mapInfoEl.textContent = `${window.currentMap.id}`;
        if (uiElements.parInfoEl) uiElements.parInfoEl.textContent = `${window.currentMap.par}`;
    }
    if (uiElements.strokeInfoEl) uiElements.strokeInfoEl.textContent = `${window.currentStrokes || 0}`;
};

// Update scorecard UI
window.updateScorecardUI = function () {
    if (!uiElements.scorecardBody || !window.scoreHistory) return;
    
    uiElements.scorecardBody.innerHTML = '';
    
    // Eğer multiplayer ise tüm oyuncuları göster
    if (window.isMultiplayer && window.players && window.players.length > 1) {
        // Skor tablosunu oyuncular için oluştur
        uiElements.scorecardHead.innerHTML = `
            <tr>
                <th>Oyuncu</th>
                <th>Toplam Vuruş</th>
                <th>Toplam Puan</th>
            </tr>
        `;
        
        // Oyuncuları puana göre sırala (en yüksek puan en üstte)
        const sortedPlayers = [...window.players].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
        
        sortedPlayers.forEach((player, index) => {
            const tr = document.createElement('tr');
            const rank = index === 0 ? '🏆 ' : `${index + 1}. `;
            tr.innerHTML = `
                <td>${rank}${player.name}${player.isMe ? ' (Sen)' : ''}</td>
                <td>${player.totalStrokes || 0}</td>
                <td>${player.totalScore || 0}</td>
            `;
            uiElements.scorecardBody.appendChild(tr);
        });
    } else {
        // Tek oyunculu - eski skorcard
        uiElements.scorecardHead.innerHTML = `
            <tr>
                <th>Harita</th>
                <th>Par</th>
                <th>Vuruş</th>
                <th>Puan</th>
            </tr>
        `;
        
        window.scoreHistory.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.mapId}</td>
                <td>${entry.par}</td>
                <td>${entry.strokes}</td>
                <td>${entry.score}</td>
            `;
            uiElements.scorecardBody.appendChild(tr);
        });
        
        // Toplam satırı ekle
        const totalScore = window.scoreHistory.reduce((sum, e) => sum + e.score, 0);
        const totalStrokes = window.scoreHistory.reduce((sum, e) => sum + e.strokes, 0);
        
        const totalTr = document.createElement('tr');
        totalTr.style.fontWeight = 'bold';
        totalTr.style.borderTop = '2px solid #333';
        totalTr.innerHTML = `
            <td>TOPLAM</td>
            <td>-</td>
            <td>${totalStrokes}</td>
            <td>${totalScore}</td>
        `;
        uiElements.scorecardBody.appendChild(totalTr);
    }
};

window.updateReadyCountUI = function (room) {
    if (!uiElements.readyCountInfo) return;
    if (!room || !room.players) return;

    const players = Object.values(room.players);
    const total = players.length;
    const ready = players.filter(p => p.readyForNextHole).length;

    uiElements.readyCountInfo.textContent = `${ready} / ${total} oyuncu hazır`;
    uiElements.readyCountInfo.classList.remove('hidden');
}

window.showScorecard = function (isGameOver = false, roundInfo = null) {
    window.isGameFinished = isGameOver; // Durumu kaydet
    window.updateScorecardUI();
    uiElements.scorecardOverlay.classList.remove('hidden');

    if (roundInfo) {
        uiElements.roundResultArea.classList.remove('hidden');
        uiElements.roundResultTitle.textContent = roundInfo.term;
        uiElements.roundResultPoints.textContent = `${roundInfo.points > 0 ? '+' : ''}${roundInfo.points} Puan`;
    } else if (isGameOver) {
        // Oyun bitti mesajı
        uiElements.roundResultArea.classList.remove('hidden');
        uiElements.roundResultTitle.textContent = '🎉 Oyun Bitti! 🎉';
        uiElements.roundResultPoints.textContent = 'Tebrikler, tüm haritaları tamamladınız!';
        uiElements.roundResultTitle.style.color = '#059669';
    } else {
        uiElements.roundResultArea.classList.add('hidden');
    }
    
    // Buton metnini oyun durumuna göre ayarla
    if (uiElements.btnCloseScorecard) {
        // Butonu her zaman aktif et
        uiElements.btnCloseScorecard.disabled = false;
        uiElements.btnCloseScorecard.style.cursor = 'pointer';
        
        if (isGameOver) {
            uiElements.btnCloseScorecard.textContent = window.isMultiplayer ? 'Lobiye Dön' : 'Ana Menüye Dön';
            uiElements.btnCloseScorecard.style.background = '#059669';
        } else {
            uiElements.btnCloseScorecard.textContent = window.isMultiplayer ? 'Sonraki deliğe hazırım' : 'Sonraki Harita';
            uiElements.btnCloseScorecard.style.background = '#2563eb';
        }
    }
}

// Event Listeners
uiElements.btnCloseScorecard.addEventListener('click', async () => {
    // Çok oyunculuda: hazır olduğunu sunucuya bildir
    if (window.isMultiplayer) {
        if (window.gameSocket && window.currentRoomIdForGame) {
            // Oyun bitti ise Firebase'e kaydet
            if (window.isGameFinished) {
                await saveGameStatsToFirebase();
            }
            
            window.gameSocket.emit('readyNextHole', {
                roomId: window.currentRoomIdForGame,
                isGameOver: window.isGameFinished
            });
            uiElements.btnCloseScorecard.disabled = true;
            uiElements.btnCloseScorecard.textContent = 'Hazır, bekleniyor...';
        }
        return;
    }
    
    // Tek oyunculu: doğrudan sonraki haritaya geç
    uiElements.scorecardOverlay.classList.add('hidden');
    
    // Oyun bitti mi kontrol et
    if (window.isGameFinished) {
        // Firebase'e kaydet
        await saveGameStatsToFirebase();
        
        // Oyun bitti, lobiye dön
        if (uiElements.gameMain) uiElements.gameMain.classList.add('hidden');
        
        // showScreen fonksiyonu window üzerinde global
        if (typeof window.showScreen === 'function') {
            window.showScreen('lobbyMenu');
        } else if (uiElements.lobbyMenu) {
            uiElements.lobbyMenu.classList.remove('hidden');
        }
    } else {
        // Sonraki haritaya geç
        if (window.loadMap && typeof window.currentMapIndex !== 'undefined') {
            console.log("Sonraki haritaya geçiliyor:", window.currentMapIndex + 1);
            window.loadMap(window.currentMapIndex + 1);
        }
    }
});

// Firebase'e oyun istatistiklerini kaydet
async function saveGameStatsToFirebase() {
    console.log('saveGameStatsToFirebase çağrıldı');
    
    if (!window.db) {
        console.error('window.db tanımlı değil!');
        return;
    }
    
    if (!firebase.auth().currentUser) {
        console.error('Firebase kullanıcısı giriş yapmamış!');
        return;
    }
    
    const user = firebase.auth().currentUser;
    const me = window.players?.find(p => p.isMe);
    
    if (!me) {
        console.error('Oyuncu bilgisi bulunamadı. window.players:', window.players);
        return;
    }
    
    const totalScore = me.totalScore || 0;
    const totalStrokes = me.totalStrokes || 0;
    
    console.log(`Kaydedilecek: Score=${totalScore}, Strokes=${totalStrokes}`);
    
    try {
        const userRef = window.db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const currentData = userDoc.data();
            const newGamesPlayed = (currentData.gamesPlayed || 0) + 1;
            const newTotalScore = (currentData.totalScore || 0) + totalScore;
            
            await userRef.update({
                gamesPlayed: newGamesPlayed,
                totalScore: newTotalScore,
                lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`✅ Firebase'e kaydedildi: gamesPlayed=${newGamesPlayed}, totalScore=${newTotalScore}`);
        } else {
            console.error('Kullanıcı dokümanı bulunamadı!');
        }
    } catch (error) {
        console.error('❌ Firebase kayıt hatası:', error);
    }
}

uiElements.btnRestartGame.addEventListener('click', () => {
    // Oyunu sıfırla ve lobi menüsüne dön
    uiElements.scorecardOverlay.classList.add('hidden');
    uiElements.gameMain.classList.add('hidden');
    // Auth.js'deki lobi menüsünü göster (DOM üzerinden)
    if (uiElements.lobbyMenu) uiElements.lobbyMenu.classList.remove('hidden');
});

// Power Bar UI update helper
window.updatePowerBarUI = function (percent) {
    if (uiElements.powerTouchArea) {
        uiElements.powerTouchArea.style.setProperty('--power-percent', percent + '%');
    }
}

// Hazır oyuncu sayısını göster
window.updateReadyCountDisplay = function (ready, total) {
    if (!uiElements.btnCloseScorecard) return;
    
    if (window.isGameFinished && window.isMultiplayer) {
        uiElements.btnCloseScorecard.textContent = `Lobiye Dön (${ready}/${total})`;
        // Butonu tekrar aktif et (kullanıcı henüz tıklamadıysa)
        uiElements.btnCloseScorecard.disabled = false;
        uiElements.btnCloseScorecard.style.background = '#059669';
    }
};

// Sayaç göster
window.showCountdown = function (seconds) {
    if (!uiElements.btnCloseScorecard) return;
    
    uiElements.btnCloseScorecard.disabled = true;
    uiElements.btnCloseScorecard.textContent = `Lobiye dönülüyor... ${seconds}`;
    uiElements.btnCloseScorecard.style.background = '#f59e0b';
    uiElements.btnCloseScorecard.style.cursor = 'not-allowed';
};
