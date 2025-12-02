// Game Logic (Physics, Loop, Input)

// Global Game State
window.players = [];
window.myPlayerId = null;
window.currentStrokes = 0;
window.scoreHistory = [];
window.remoteBalls = {};

// Physics Constants
const FRICTION = 0.98;
const MAX_POWER = 28;
const MAX_DRAG_DIST = 180;
const STOP_THRESHOLD = 0.08;

// Game Variables
let ball = { x: 100, y: 250, vx: 0, vy: 0, radius: 8 };
let hole = { x: 700, y: 250, radius: 12 };

window.currentMapIndex = 0;
window.currentMap = null;

let isLevelTransitioning = false;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let currentMouse = { x: 0, y: 0 };
let aimAngle = null;
let powerPercent = 0;
let isAdjustingPower = false;

// Canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- GAME FUNCTIONS ---

window.generatePlayerId = function () {
    return Math.floor(1000 + Math.random() * 9000);
}

// Tek oyunculu başlatma
window.startGameSingle = function (playerName) {
    localStorage.setItem('playerName', playerName);
    window.showGame(playerName);
};

window.showGame = function (name) {
    // Overlay'leri kapat
    const overlays = document.querySelectorAll('.overlay');
    overlays.forEach(el => el.classList.add('hidden'));

    if (window.uiElements && window.uiElements.gameMain) {
        window.uiElements.gameMain.classList.remove('hidden');
    }

    if (!window.myPlayerId) window.myPlayerId = window.generatePlayerId();

    if (window.uiElements && window.uiElements.displayName) {
        window.uiElements.displayName.textContent = `${name} #${window.myPlayerId}`;
    }
    if (window.uiElements && window.uiElements.statusEl) {
        window.uiElements.statusEl.textContent = 'Hazır';
    }

    window.players = [{
        id: window.myPlayerId,
        name: name,
        totalStrokes: 0,
        totalScore: 0,
        mapScores: {},
        isMe: true,
        color: window.myBallColor || 'white'
    }];

    if (window.renderPlayerList) window.renderPlayerList();

    window.scoreHistory = [];
    window.currentStrokes = 0;
    if (window.updateScorecardUI) window.updateScorecardUI();

    window.drawInitialScene();
}

window.loadMap = function (index) {
    isLevelTransitioning = false;
    isDragging = false;
    if (window.uiElements && window.uiElements.powerContainer) {
        window.uiElements.powerContainer.classList.add('hidden');
    }

    if (!window.GAME_MAPS || index >= window.GAME_MAPS.length) {
        window.currentMap = null;

        // İstatistik kaydı artık sunucuda yapılıyor (gameFinished event'i ile)

        if (window.showScorecard) window.showScorecard(true);
        return;
    }
    window.currentMapIndex = index;
    window.currentMap = window.GAME_MAPS[window.currentMapIndex];

    ball.x = window.currentMap.start.x;
    ball.y = window.currentMap.start.y;
    ball.vx = 0;
    ball.vy = 0;

    hole.x = window.currentMap.hole.x;
    hole.y = window.currentMap.hole.y;

    window.currentStrokes = 0;
    if (window.updateGameUI) window.updateGameUI();

    if (window.uiElements && window.uiElements.statusEl) {
        window.uiElements.statusEl.textContent = `Harita ${window.currentMap.id} / ${window.GAME_MAPS.length}`;
    }
}

window.drawInitialScene = function () {
    window.loadMap(0);
    requestAnimationFrame(gameLoop);
}

function update() {
    const steps = 4;
    for (let i = 0; i < steps; i++) {
        physicsStep(1 / steps);
    }
}

function physicsStep(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx *= -1; }
    if (ball.x + ball.radius > canvas.width) { ball.x = canvas.width - ball.radius; ball.vx *= -1; }
    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy *= -1; }
    if (ball.y + ball.radius > canvas.height) { ball.y = canvas.height - ball.radius; ball.vy *= -1; }

    if (window.currentMap && window.currentMap.walls) {
        window.currentMap.walls.forEach(wall => {
            const closestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w));
            const closestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h));

            const dx = ball.x - closestX;
            const dy = ball.y - closestY;
            const distSq = dx * dx + dy * dy;

            if (distSq < (ball.radius * ball.radius) && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const overlap = ball.radius - dist;

                let nx = dx / dist;
                let ny = dy / dist;

                if (dist === 0) { nx = 0; ny = -1; }

                ball.x += nx * overlap;
                ball.y += ny * overlap;

                const dot = ball.vx * nx + ball.vy * ny;

                if (dot < 0) {
                    ball.vx = ball.vx - 2 * dot * nx;
                    ball.vy = ball.vy - 2 * dot * ny;

                    ball.vx *= 0.8;
                    ball.vy *= 0.8;
                }
            }
        });
    }
}

function getScoreTerm(strokes, par) {
    const diff = strokes - par;
    if (strokes === 1) return "Hole-in-One!";
    if (diff <= -3) return "Albatross!";
    if (diff === -2) return "Eagle!";
    if (diff === -1) return "Birdie!";
    if (diff === 0) return "Par";
    if (diff === 1) return "Bogey";
    if (diff === 2) return "Double Bogey";
    if (diff === 3) return "Triple Bogey";
    return `+${diff}`;
}

function checkGameLogic() {
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    if (Math.abs(ball.vx) < STOP_THRESHOLD && Math.abs(ball.vy) < STOP_THRESHOLD) {
        ball.vx = 0;
        ball.vy = 0;
    }

    const dx = ball.x - hole.x;
    const dy = ball.y - hole.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.hypot(ball.vx, ball.vy);

    const holeEnterThreshold = hole.radius * 0.9;
    const MAX_HOLE_SPEED = 16;

    if (
        !isLevelTransitioning &&
        dist < holeEnterThreshold &&
        speed <= MAX_HOLE_SPEED
    ) {
        isLevelTransitioning = true;

        const BASE_POINTS = 10;
        const maxStrokeForMinPoint = 10;
        let points = BASE_POINTS - (window.currentStrokes - 1);
        if (points < 1) points = 1;
        if (window.currentStrokes >= maxStrokeForMinPoint) points = 1;

        const par = window.currentMap.par;
        const term = getScoreTerm(window.currentStrokes, par);

        window.scoreHistory.push({
            mapId: window.currentMap.id,
            par: par,
            strokes: window.currentStrokes,
            score: points
        });

        const me = window.players.find(p => p.isMe);
        if (me) {
            me.totalScore += points;
            if (!me.mapScores) me.mapScores = {};
            me.mapScores[window.currentMap.id] = points;
        }
        if (window.renderPlayerList) window.renderPlayerList();

        // Çok oyunculuda skoru sunucuya bildir
        if (window.isMultiplayer && window.gameSocket && window.currentRoomIdForGame) {
            window.gameSocket.emit('holeCompleted', {
                roomId: window.currentRoomIdForGame,
                points,
                mapId: window.currentMap.id
            });
            // Skor kartını gösterme, sadece durumu güncelle
            if (window.uiElements && window.uiElements.statusEl) {
                window.uiElements.statusEl.textContent = `${term}! (Diğer oyuncular izleniyor...)`;
            }
        } else {
            if (window.uiElements && window.uiElements.statusEl) {
                window.uiElements.statusEl.textContent = `${term}!`;
            }
            // Tek oyunculu: küçük bir gecikmeyle skor kartını göster
            setTimeout(() => {
                if (window.showScorecard) window.showScorecard(false, { term: term, points: points });
            }, 300);
        }

        ball.vx = 0;
        ball.vy = 0;
        ball.x = hole.x;
        ball.y = hole.y;
    }
}

function gameLoop() {
    update();
    checkGameLogic();
    draw();

    // Top pozisyonunu sunucuya gönder (çok oyunculuda)
    if (window.isMultiplayer && window.gameSocket && window.currentRoomIdForGame) {
        window.gameSocket.emit('updatePosition', {
            roomId: window.currentRoomIdForGame,
            x: ball.x,
            y: ball.y,
            vx: ball.vx,
            vy: ball.vy
        });
    }

    requestAnimationFrame(gameLoop);
}

function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (isLevelTransitioning && !window.isMultiplayer) {
        return;
    }

    ctx.fillStyle = '#9ee6c9';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#7bbf9a';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    if (window.currentMap && window.currentMap.walls) {
        ctx.fillStyle = '#5d4037';
        window.currentMap.walls.forEach(wall => {
            ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(wall.x + wall.w - 4, wall.y, 4, wall.h);
            ctx.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
            ctx.fillStyle = '#5d4037';
        });
    }

    ctx.beginPath();
    ctx.fillStyle = '#111';
    ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    if (isDragging) {
        drawArrow();
    }

    if (!isLevelTransitioning) {
        ctx.beginPath();
        const me = window.players.find(p => p.isMe);
        let fill = '#ffffff';
        if (me && me.color) {
            switch (me.color) {
                case 'red': fill = '#ef4444'; break;
                case 'blue': fill = '#3b82f6'; break;
                case 'purple': fill = '#a855f7'; break;
                case 'green': fill = '#22c55e'; break;
                case 'yellow': fill = '#facc15'; break;
                case 'white': fill = '#ffffff'; break;
                case 'pink': fill = '#ec4899'; break;
                case 'turquoise': fill = '#14b8a6'; break;
            }
        }
        ctx.fillStyle = fill;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.closePath();

        // Kendi ismimi çiz
        if (me) {
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(me.name + " (Sen)", ball.x, ball.y - 15);
        }
    }

    // Diğer oyuncuların toplarını çiz
    if (window.isMultiplayer && window.remoteBalls) {
        Object.keys(window.remoteBalls).forEach(id => {
            const rb = window.remoteBalls[id];
            if (!rb) return;

            // Bu socketId'ye sahip oyuncuyu bul
            const remotePlayer = window.players.find(p => p.socketId === id);
            let pColor = '#f97316'; // Varsayılan turuncu
            if (remotePlayer && remotePlayer.color) {
                // Renk kodunu hex'e çevir (basit mapping)
                switch (remotePlayer.color) {
                    case 'red': pColor = '#ef4444'; break;
                    case 'blue': pColor = '#3b82f6'; break;
                    case 'purple': pColor = '#a855f7'; break;
                    case 'green': pColor = '#22c55e'; break;
                    case 'yellow': pColor = '#facc15'; break;
                    case 'white': pColor = '#ffffff'; break;
                    case 'pink': pColor = '#ec4899'; break;
                    case 'turquoise': pColor = '#14b8a6'; break;
                }
            }

            ctx.beginPath();
            ctx.fillStyle = pColor;
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
            ctx.arc(rb.x, rb.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.closePath();

            // İsim çizimi
            if (remotePlayer) {
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(remotePlayer.name, rb.x, rb.y - 15);
            }
        });
    }
}

function drawArrow() {
    const dx = ball.x - currentMouse.x;
    const dy = ball.y - currentMouse.y;

    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MAX_DRAG_DIST) dist = MAX_DRAG_DIST;

    const angle = Math.atan2(dy, dx);
    const MAX_VISUAL_LENGTH = 55;
    const arrowLength = Math.min(dist, MAX_VISUAL_LENGTH);

    const startOffset = ball.radius;

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    ctx.rect(startOffset, -3, arrowLength, 6);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();

    if (arrowLength > 12) {
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        const tipX = startOffset + arrowLength;
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tipX - 10, -5);
        ctx.lineTo(tipX - 10, 5);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }

    ctx.restore();
}

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

// Input Handling
function onMouseDown(e) {
    if (Math.abs(ball.vx) > 0.1 || Math.abs(ball.vy) > 0.1) return;

    const pos = getMousePos(e);
    const dx = pos.x - ball.x;
    const dy = pos.y - ball.y;

    if (dx * dx + dy * dy < (ball.radius * 3) ** 2) {
        isDragging = true;
        dragStart = { x: ball.x, y: ball.y };
        currentMouse = pos;
        if (window.uiElements && window.uiElements.powerContainer) {
            window.uiElements.powerContainer.classList.remove('hidden');
        }
    }
}

function onMouseMove(e) {
    if (!isDragging) return;
    currentMouse = getMousePos(e);

    const dx = ball.x - currentMouse.x;
    const dy = ball.y - currentMouse.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_DRAG_DIST) dist = MAX_DRAG_DIST;

    aimAngle = Math.atan2(dy, dx);
}

function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    if (window.uiElements && window.uiElements.powerContainer) {
        window.uiElements.powerContainer.classList.remove('hidden');
    }
}

canvas.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return;
    e.preventDefault();
    onMouseDown(e.touches[0]);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    onMouseMove(e.touches[0]);
}, { passive: false });

window.addEventListener('touchend', (e) => {
    onMouseUp(e);
});

// Power Bar Logic
function updatePowerFromClientXY(clientX) {
    if (!window.uiElements || !window.uiElements.powerTouchArea) return;
    const rect = window.uiElements.powerTouchArea.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    powerPercent = ratio * 100;
    if (window.updatePowerBarUI) window.updatePowerBarUI(powerPercent);
}

if (window.uiElements && window.uiElements.powerTouchArea) {
    window.uiElements.powerTouchArea.addEventListener('mousedown', (e) => {
        isAdjustingPower = true;
        updatePowerFromClientXY(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
        if (!isAdjustingPower) return;
        if (e.buttons !== 1) { isAdjustingPower = false; return; }
        updatePowerFromClientXY(e.clientX);
    });
    window.addEventListener('mouseup', () => {
        if (!isAdjustingPower) return;
        isAdjustingPower = false;
        fireShotIfPossible();
    });
    window.uiElements.powerTouchArea.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return;
        e.preventDefault();
        isAdjustingPower = true;
        updatePowerFromClientXY(e.touches[0].clientX);
    }, { passive: false });
    window.uiElements.powerTouchArea.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) return;
        e.preventDefault();
        updatePowerFromClientXY(e.touches[0].clientX);
    }, { passive: false });
    window.uiElements.powerTouchArea.addEventListener('touchend', () => {
        if (!isAdjustingPower) return;
        isAdjustingPower = false;
        fireShotIfPossible();
    });
}

function fireShotIfPossible() {
    if (aimAngle === null) return;
    if (Math.abs(ball.vx) > 0.1 || Math.abs(ball.vy) > 0.1) return;
    const power = (powerPercent / 100) * MAX_POWER;
    if (power <= 0.5) return;
    ball.vx = Math.cos(aimAngle) * power;
    ball.vy = Math.sin(aimAngle) * power;
    window.currentStrokes++;
    const me = window.players.find(p => p.isMe);
    if (me) {
        me.totalStrokes++;
    }
    if (window.updateGameUI) window.updateGameUI();
    if (window.uiElements && window.uiElements.statusEl) {
        window.uiElements.statusEl.textContent = "Atış yapıldı!";
    }
}

if (window.uiElements && window.uiElements.shootBtn) {
    window.uiElements.shootBtn.addEventListener('click', () => {
        fireShotIfPossible();
    });
}
