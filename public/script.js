// Basit lobi ve isim girme akışı
document.addEventListener('DOMContentLoaded', () => {
	const lobby = document.getElementById('lobby');
	// name-area ve start-area artık auth ekranında, buradaki referanslar null olabilir
	// Hata almamak için kontrol ekliyoruz
	const nameArea = document.getElementById('name-area'); 
	const startArea = document.getElementById('start-area');
	const joinBtn = document.getElementById('join-btn');
	const cancelBtn = document.getElementById('cancel-name');
	const nameInput = document.getElementById('player-name'); // Bu input artık lobi menüsünde yok ama kod kalıntısı olabilir
	const nameError = document.getElementById('name-error');

	// Menü Butonları (Artık index.html'de bu ID'ler yok veya farklı yerde)
	// btnSingle, btnMulti vb. auth.js tarafından yönetiliyor.
	// Sadece oyun içi UI elemanlarını alalım.

	const gameMain = document.getElementById('game');
	const displayName = document.getElementById('display-name');
	const statusEl = document.getElementById('status');
	const canvas = document.getElementById('game-canvas');
	const ctx = canvas.getContext('2d');
	
	// Scorecard Elements
	const scorecardOverlay = document.getElementById('scorecard-overlay');
	const scorecardHead = document.getElementById('scorecard-head');
	const scorecardBody = document.getElementById('scorecard-body');
	const btnCloseScorecard = document.getElementById('btn-close-scorecard');
	const btnRestartGame = document.getElementById('btn-restart-game');
	const roundResultTitle = document.getElementById('round-result-title');
	const roundResultPoints = document.getElementById('round-result-points');
	const roundResultArea = document.getElementById('round-result-area');

	// UI Elements
	const mapInfoEl = document.getElementById('map-info');
	const parInfoEl = document.getElementById('par-info');
	const strokeInfoEl = document.getElementById('stroke-info');
	const colorErrorEl = document.getElementById('color-error');
	const colorOptionButtons = document.querySelectorAll('.color-option');

	// Power Bar Elements
	const powerContainer = document.getElementById('power-container');
	const powerBarFill = document.getElementById('power-bar-fill');
	const powerTouchArea = document.getElementById('power-touch-area');
	const shootBtn = document.getElementById('shoot-btn');
	const playerListEl = document.getElementById('player-list');

	// Oyuncu Bilgisi
	let myPlayerId = null;
	let players = [];  // { id, name, uid?, totalStrokes, totalScore, mapScores: {}, isMe }
	let myBallColor = 'white';
	let takenColors = new Set();
    let isMultiplayer = false;
    let myUid = null;

    // Sunucudan gelen gerçek zamanlı top pozisyonları için
    const remoteBalls = {}; // socketId -> { x, y }

	// Skor Değişkenleri
	let currentStrokes = 0;
	let scoreHistory = [];

	function generatePlayerId() {
		return Math.floor(1000 + Math.random() * 9000);
	}

	// Lobi renk seçimi (şimdilik tek cihaz için)
	colorOptionButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			const color = btn.getAttribute('data-color');
			if (takenColors.has(color) && color !== myBallColor) {
				if (colorErrorEl) {
					colorErrorEl.textContent = 'Bu renk başka bir oyuncu tarafından seçildi.';
					colorErrorEl.classList.remove('hidden');
				}
				return;
			}
			if (colorErrorEl) colorErrorEl.classList.add('hidden');
			myBallColor = color;
			takenColors.add(color);
			colorOptionButtons.forEach(b => b.classList.remove('selected'));
			btn.classList.add('selected');
		});
	});

	function renderPlayerList() {
		if(!playerListEl) return;
		players.sort((a, b) => b.totalScore - a.totalScore);

		playerListEl.innerHTML = '';
		players.forEach(p => {
			const li = document.createElement('li');
			li.innerHTML = `
				<span class="p-name">${p.name} ${p.isMe ? '(Sen)' : ''}</span>
				<div style="display:flex; align-items:center; gap:10px;">
					<span class="p-score" style="font-weight:bold; color:#2563eb;">${p.totalScore} P</span>
					<span class="p-id">#${p.id}</span>
				</div>
			`;
			playerListEl.appendChild(li);
		});
	}

    // Tek oyunculu başlatma (eski mod)
	window.showGame = function(name) {
		// Eğer açık olan diğer overlay'ler varsa kapat
        const overlays = document.querySelectorAll('.overlay');
        overlays.forEach(el => el.classList.add('hidden'));

		gameMain.classList.remove('hidden');
		
		if (!myPlayerId) myPlayerId = generatePlayerId();
		
		displayName.textContent = `${name} #${myPlayerId}`;
		statusEl.textContent = 'Hazır';
		
		players = [{
			id: myPlayerId,
			name: name,
			totalStrokes: 0,
			totalScore: 0,
			mapScores: {},
			isMe: true,
			color: myBallColor
		}];
		renderPlayerList();

		scoreHistory = [];
		currentStrokes = 0;
		updateScorecardUI();

		drawInitialScene();
	}

    // Global başlatıcı (tek oyunculu)
	window.startGameSingle = function(playerName) {
		localStorage.setItem('playerName', playerName);
		window.showGame(playerName);
	};

    // Çok oyunculu başlatıcı: oda bilgisini ve kendi uid'ini alır
    // room.players = { socketId: { uid, name, score, ... }, ... }
    window.startGameMultiplayer = function(room, myUidParam) {
        // Overlay'leri kapat
        const overlays = document.querySelectorAll('.overlay');
        overlays.forEach(el => el.classList.add('hidden'));
        gameMain.classList.remove('hidden');

        isMultiplayer = true;
        myUid = myUidParam;
        window.currentRoomIdForGame = room.id;

        // Oyuncu listesini odadaki tüm oyunculardan oluştur
        const roomPlayers = Object.values(room.players || {});
        players = roomPlayers.map((p, index) => ({
            id: index + 1,                 // basit sıra numarası
            name: p.name,
            uid: p.uid,
            totalStrokes: 0,
            totalScore: p.score || 0,
            mapScores: {},
            isMe: p.uid === myUid
        }));

        // Kendi adını bul ve ekrana yaz
        const me = players.find(p => p.isMe) || players[0];
        if (!myPlayerId) myPlayerId = me ? me.id : generatePlayerId();
        displayName.textContent = me ? `${me.name} #${myPlayerId}` : `Oyuncu #${myPlayerId}`;
        statusEl.textContent = 'Hazır';

        renderPlayerList();

        // Skorları sıfırla
        scoreHistory = [];
        currentStrokes = 0;
        updateScorecardUI();

        // Oyunu başlat
        drawInitialScene();
    };

    // Sunucudan gelen diğer oyuncuların top pozisyonlarını güncelle
    window.updateRemoteBall = function(socketId, x, y) {
        remoteBalls[socketId] = { x, y };
    };

    // Sunucudan gelen yeni delik bilgisiyle tüm oyuncuların skorlarını ve map skorlarını eşitle
    window.advanceHole = function(room) {
        if (!isMultiplayer) return;
        syncPlayersFromRoom(room);
        // Skor kartını kapat ve bir sonraki haritaya geç
        scorecardOverlay.classList.add('hidden');
        loadMap(currentMapIndex + 1);
    };

    // Tüm oyuncular deliği bitirdiğinde skor ekranını aç ve "Hazırım" butonunu aktifleştir
    window.enableNextHoleButton = function(room) {
        if (!isMultiplayer) return;
        syncPlayersFromRoom(room);
        renderPlayerList();
        updateScorecardUI();
        // Eğer skor kartı henüz açılmadıysa şimdi aç
        if (scorecardOverlay && scorecardOverlay.classList.contains('hidden')) {
            showScorecard(false, null);
        }
        if (btnCloseScorecard) {
            btnCloseScorecard.disabled = false;
            btnCloseScorecard.textContent = 'Sonraki deliğe hazırım';
        }
    };

    // Yardımcı: server odasından oyuncu skorlarını ve map skorlarını players dizisine uygula
    function syncPlayersFromRoom(room) {
        const roomPlayers = room.players || {};
        players.forEach(p => {
            const serverPlayer = Object.values(roomPlayers).find(sp => sp.uid === p.uid);
            if (serverPlayer) {
                p.totalScore = serverPlayer.score || 0;
                p.mapScores = serverPlayer.mapScores || {};
            }
        });
    }

	// --- OYUN MANTIĞI ---
	let ball = { x: 100, y: 250, vx: 0, vy: 0, radius: 8 };
	let hole = { x: 700, y: 250, radius: 12 };
	
	let currentMapIndex = 0;
	let currentMap = null;
	let isLevelTransitioning = false;
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };
	let currentMouse = { x: 0, y: 0 };
	let aimAngle = null;
	let powerPercent = 0;
	let isAdjustingPower = false;
	
	const FRICTION = 0.98;
	const MAX_POWER = 28;
	const MAX_DRAG_DIST = 180; 
	const STOP_THRESHOLD = 0.08;

	// Canvas event listener'ları - sadece yön belirlemek için
	canvas.addEventListener('mousedown', onMouseDown);
	window.addEventListener('mousemove', onMouseMove);
	window.addEventListener('mouseup', onMouseUp);

	canvas.addEventListener('touchstart', (e) => {
		if(e.touches.length > 1) return;
		e.preventDefault();
		onMouseDown(e.touches[0]);
	}, { passive: false });

	window.addEventListener('touchmove', (e) => {
		if(!isDragging) return;
		e.preventDefault();
		onMouseMove(e.touches[0]);
	}, { passive: false });

	window.addEventListener('touchend', (e) => {
		onMouseUp(e);
	});

	// Güç dokunma alanı: parmakla sürükleyerek powerPercent ayarla
	function updatePowerFromClientXY(clientX) {
		const rect = powerTouchArea.getBoundingClientRect();
		let ratio = (clientX - rect.left) / rect.width;
		if (ratio < 0) ratio = 0;
		if (ratio > 1) ratio = 1;
		powerPercent = ratio * 100;
		powerTouchArea.style.setProperty('--power-percent', powerPercent + '%');
	}

	if (powerTouchArea) {
		powerTouchArea.addEventListener('mousedown', (e) => {
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
		powerTouchArea.addEventListener('touchstart', (e) => {
			if (e.touches.length > 1) return;
			e.preventDefault();
			isAdjustingPower = true;
			updatePowerFromClientXY(e.touches[0].clientX);
		}, { passive: false });
		powerTouchArea.addEventListener('touchmove', (e) => {
			if (e.touches.length > 1) return;
			e.preventDefault();
			updatePowerFromClientXY(e.touches[0].clientX);
		}, { passive: false });
		powerTouchArea.addEventListener('touchend', () => {
			if (!isAdjustingPower) return;
			isAdjustingPower = false;
			fireShotIfPossible();
		});
	}

	// Güç ayarı bittiğinde ya da butona basıldığında atış fonksiyonu
	function fireShotIfPossible() {
		if (aimAngle === null) return;
		if (Math.abs(ball.vx) > 0.1 || Math.abs(ball.vy) > 0.1) return;
		const power = (powerPercent / 100) * MAX_POWER;
		if (power <= 0.5) return;
		ball.vx = Math.cos(aimAngle) * power;
		ball.vy = Math.sin(aimAngle) * power;
		currentStrokes++;
		const me = players.find(p => p.isMe);
		if(me) {
			me.totalStrokes++;
		}
		updateGameUI();
		statusEl.textContent = "Atış yapıldı!";
	}

	// İstersen butonla da tetikleyebilelim
	if (shootBtn) {
		shootBtn.addEventListener('click', () => {
			fireShotIfPossible();
		});
	}

	function loadMap(index) {
		isLevelTransitioning = false;
		isDragging = false;
		powerContainer.classList.add('hidden');
		
		if (index >= GAME_MAPS.length) {
			currentMap = null;
			showScorecard(true);
			return;
		}
		currentMapIndex = index;
		currentMap = GAME_MAPS[currentMapIndex];
		
		ball.x = currentMap.start.x;
		ball.y = currentMap.start.y;
		ball.vx = 0;
		ball.vy = 0;
		
		hole.x = currentMap.hole.x;
		hole.y = currentMap.hole.y;
		
		currentStrokes = 0;
		updateGameUI();
		
		statusEl.textContent = `Harita ${currentMap.id} / ${GAME_MAPS.length}`;
	}

	function updateGameUI() {
		if(!currentMap) return;
		mapInfoEl.textContent = currentMap.id;
		parInfoEl.textContent = currentMap.par;
		strokeInfoEl.textContent = currentStrokes;
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

	function updateScorecardUI() {
		let headerHtml = '<tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">';
		headerHtml += '<th style="padding: 10px; text-align: left;">Oyuncu</th>';
		
		GAME_MAPS.forEach(map => {
			headerHtml += `<th style="padding: 10px; text-align: center;">H${map.id}</th>`;
		});
		
		headerHtml += '<th style="padding: 10px; text-align: center;">Toplam</th></tr>';
		scorecardHead.innerHTML = headerHtml;

		scorecardBody.innerHTML = '';
		
		const sortedPlayers = [...players].sort((a, b) => b.totalScore - a.totalScore);

		sortedPlayers.forEach(p => {
			let rowHtml = `<tr style="border-bottom: 1px solid #e2e8f0;">`;
			rowHtml += `<td style="padding: 10px; font-weight:600;">${p.name} ${p.isMe ? '(Sen)' : ''}</td>`;
			
			GAME_MAPS.forEach(map => {
				const score = (p.mapScores && p.mapScores[map.id] !== undefined) ? p.mapScores[map.id] : '-';
				rowHtml += `<td style="padding: 10px; text-align: center;">${score}</td>`;
			});
			
			rowHtml += `<td style="padding: 10px; text-align: center; font-weight: bold; color: #2563eb;">${p.totalScore}</td>`;
			rowHtml += `</tr>`;
			scorecardBody.innerHTML += rowHtml;
		});
	}

	function showScorecard(isGameOver = false, roundInfo = null) {
		updateScorecardUI();
		scorecardOverlay.classList.remove('hidden');
		
		if (roundInfo) {
			roundResultArea.classList.remove('hidden');
			roundResultTitle.textContent = roundInfo.term;
			roundResultPoints.textContent = `${roundInfo.points > 0 ? '+' : ''}${roundInfo.points} Puan`;
		} else {
			roundResultArea.classList.add('hidden');
		}

		if (isGameOver) {
			btnRestartGame.classList.remove('hidden');
			btnCloseScorecard.classList.add('hidden');
		} else {
			btnRestartGame.classList.add('hidden');

            // Tek oyunculu: oyuncu "Devam Et" ile sonraki haritaya geçebilir
            if (!isMultiplayer) {
                btnCloseScorecard.disabled = false;
                btnCloseScorecard.textContent = 'Devam Et';
                btnCloseScorecard.classList.remove('hidden');
            } else {
                // Çok oyunculu: her oyuncu kendi deliğini bitirir bitirmez "Hazırım" tuşuna basabilir.
                // Sunucu, herkes finishedCurrentHole + readyForNextHole olmadan sonraki deliğe geçirmez.
                btnCloseScorecard.disabled = false;
                btnCloseScorecard.textContent = 'Sonraki deliğe hazırım (diğer oyuncular bekleniyor...)';
                btnCloseScorecard.classList.remove('hidden');
            }
		}
	}

	btnCloseScorecard.addEventListener('click', () => {
        // Çok oyunculuda: hazır olduğunu sunucuya bildir
        if (isMultiplayer) {
            if (window.gameSocket && window.currentRoomIdForGame) {
                window.gameSocket.emit('readyNextHole', {
                    roomId: window.currentRoomIdForGame
                });
                btnCloseScorecard.disabled = true;
                btnCloseScorecard.textContent = 'Diğer oyuncuların hazır olması bekleniyor...';
            }
            return;
        }
        // Tek oyunculu: doğrudan sonraki haritaya geç
		scorecardOverlay.classList.add('hidden');
		loadMap(currentMapIndex + 1);
	});

	btnRestartGame.addEventListener('click', () => {
        // Oyunu sıfırla ve lobi menüsüne dön
		scorecardOverlay.classList.add('hidden');
		gameMain.classList.add('hidden');
        // Auth.js'deki lobi menüsünü göster (DOM üzerinden)
        document.getElementById('lobby-menu').classList.remove('hidden');
	});

	function drawInitialScene() {
		loadMap(0);
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

		if (currentMap && currentMap.walls) {
			currentMap.walls.forEach(wall => {
				const closestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w));
				const closestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h));

				const dx = ball.x - closestX;
				const dy = ball.y - closestY;
				const distSq = dx*dx + dy*dy;

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

	function checkGameLogic() {
		ball.vx *= FRICTION;
		ball.vy *= FRICTION;

		if (Math.abs(ball.vx) < STOP_THRESHOLD && Math.abs(ball.vy) < STOP_THRESHOLD) {
			ball.vx = 0;
			ball.vy = 0;
		}

		const dx = ball.x - hole.x;
		const dy = ball.y - hole.y;
		const dist = Math.sqrt(dx*dx + dy*dy);
		const speed = Math.hypot(ball.vx, ball.vy);
		
		// Topun büyük kısmı deliğin üstündeyse ve hız çok uçuk değilse içeri girmiş say
		const holeEnterThreshold = hole.radius * 0.9; // %90'a kadar genişlettik
		const MAX_HOLE_SPEED = 16;  // biraz daha hızlı şutları da kabul et
		
		if (
			!isLevelTransitioning &&
			dist < holeEnterThreshold &&
			speed <= MAX_HOLE_SPEED
		) {
			isLevelTransitioning = true;
			
			const BASE_POINTS = 10;
			const maxStrokeForMinPoint = 10;
			let points = BASE_POINTS - (currentStrokes - 1);
			if (points < 1) points = 1;
			if (currentStrokes >= maxStrokeForMinPoint) points = 1;
			
			const par = currentMap.par;
			const term = getScoreTerm(currentStrokes, par);
			
			scoreHistory.push({
				mapId: currentMap.id,
				par: par,
				strokes: currentStrokes,
				score: points
			});

			const me = players.find(p => p.isMe);
			if(me) {
				me.totalScore += points;
				if(!me.mapScores) me.mapScores = {};
				me.mapScores[currentMap.id] = points;
			}
			renderPlayerList();

            // Çok oyunculuda skoru sunucuya bildir
            if (isMultiplayer && window.gameSocket && window.currentRoomIdForGame) {
                window.gameSocket.emit('holeCompleted', {
                    roomId: window.currentRoomIdForGame,
                    points,
                    mapId: currentMap.id
                });
            }

			statusEl.textContent = `${term}!`;
			ball.vx = 0; 
			ball.vy = 0;
			ball.x = hole.x;
			ball.y = hole.y;
			
			// Tek oyunculu: küçük bir gecikmeyle skor kartını göster
			if (!isMultiplayer) {
				setTimeout(() => {
					showScorecard(false, { term: term, points: points }); 
				}, 300);
			}
		}
	}

	function gameLoop() {
		update();
		checkGameLogic();
		draw();

        // Top pozisyonunu sunucuya gönder (çok oyunculuda)
        if (isMultiplayer && window.gameSocket && window.currentRoomIdForGame) {
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

		if (isLevelTransitioning && !isMultiplayer) {
			return;
		}

		ctx.fillStyle = '#9ee6c9';
		ctx.fillRect(0, 0, w, h);
		
		ctx.strokeStyle = '#7bbf9a';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, w-4, h-4);

		if (currentMap && currentMap.walls) {
			ctx.fillStyle = '#5d4037';
			currentMap.walls.forEach(wall => {
				ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
				ctx.fillStyle = 'rgba(0,0,0,0.2)';
				ctx.fillRect(wall.x + wall.w - 4, wall.y, 4, wall.h);
				ctx.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
				ctx.fillStyle = '#5d4037'; 
			});
		}

		ctx.beginPath();
		ctx.fillStyle = '#111';
		ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI*2);
		ctx.fill();
		ctx.closePath();

		if (isDragging) {
			drawArrow();
		}

		if (!isLevelTransitioning) {
			ctx.beginPath();
			const me = players.find(p => p.isMe);
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
			ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
			ctx.fill();
			ctx.shadowColor = 'transparent'; 
			ctx.closePath();
		}

        // Diğer oyuncuların toplarını çiz
        if (isMultiplayer) {
            ctx.fillStyle = '#f97316'; // turuncu
            Object.keys(remoteBalls).forEach(id => {
                const rb = remoteBalls[id];
                if (!rb) return;
                ctx.beginPath();
                ctx.arc(rb.x, rb.y, ball.radius * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.closePath();
            });
        }
	}

	function drawArrow() {
		const dx = ball.x - currentMouse.x;
		const dy = ball.y - currentMouse.y;
		
		let dist = Math.sqrt(dx*dx + dy*dy);
		
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

	function onMouseDown(e) {
		if (Math.abs(ball.vx) > 0.1 || Math.abs(ball.vy) > 0.1) return;

		const pos = getMousePos(e);
		const dx = pos.x - ball.x;
		const dy = pos.y - ball.y;
		
		if (dx*dx + dy*dy < (ball.radius * 3) ** 2) {
			isDragging = true;
			dragStart = { x: ball.x, y: ball.y }; 
			currentMouse = pos;
			powerContainer.classList.remove('hidden');
		}
	}

	function onMouseMove(e) {
		if (!isDragging) return;
		currentMouse = getMousePos(e);
		
		const dx = ball.x - currentMouse.x;
		const dy = ball.y - currentMouse.y;
		let dist = Math.sqrt(dx*dx + dy*dy);
		if (dist > MAX_DRAG_DIST) dist = MAX_DRAG_DIST;
		
		// Drag sadece yön için: açıyı kaydet
		aimAngle = Math.atan2(dy, dx);
	}

	function onMouseUp(e) {
		if (!isDragging) return;
		isDragging = false;
		// Parmağı kaldırınca artık atış yapmıyoruz, sadece yön sabit kalıyor
		powerContainer.classList.remove('hidden');
	}

});
