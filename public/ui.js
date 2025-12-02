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

// ... (Color Selection Logic remains same) ...

// ... (renderPlayerList remains same) ...

// ... (updateGameUI remains same) ...

// ... (updateScorecardUI remains same) ...

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
    } else {
        uiElements.roundResultArea.classList.add('hidden');
    }
}

// Event Listeners
uiElements.btnCloseScorecard.addEventListener('click', () => {
    // Çok oyunculuda: hazır olduğunu sunucuya bildir
    if (window.isMultiplayer) {
        if (window.gameSocket && window.currentRoomIdForGame) {
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
    if (window.loadMap) {
        window.loadMap(window.currentMapIndex + 1);
    }
});

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
