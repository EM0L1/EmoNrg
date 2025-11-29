// Basit lobi ve isim girme akışı
document.addEventListener('DOMContentLoaded', () => {
	const lobby = document.getElementById('lobby');
	const nameArea = document.getElementById('name-area');
	const startArea = document.getElementById('start-area');
	const joinBtn = document.getElementById('join-btn');
	const cancelBtn = document.getElementById('cancel-name');
	const nameInput = document.getElementById('player-name');
	const nameError = document.getElementById('name-error');

	// Menü Butonları
	const btnSingle = document.getElementById('btn-single');
	const btnMulti = document.getElementById('btn-multi');
	const btnSettings = document.getElementById('btn-settings');
	
	const multiplayerArea = document.getElementById('multiplayer-area');
	const settingsArea = document.getElementById('settings-area');
	
	const btnBackMulti = document.getElementById('btn-back-multi');
	const btnBackSettings = document.getElementById('btn-back-settings');

	const gameMain = document.getElementById('game');
	const displayName = document.getElementById('display-name');
	const statusEl = document.getElementById('status');
	const canvas = document.getElementById('game-canvas');
	const ctx = canvas.getContext('2d');
	const loadingScreen = document.getElementById('loading-screen');
	const loadingTitle = document.getElementById('loading-title');
	const loadingText = document.getElementById('loading-text');
	const holeScoreInfo = document.getElementById('hole-score-info');
	const playerListEl = document.getElementById('player-list');

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

	// Power Bar Elements
	const powerContainer = document.getElementById('power-container');
	const powerBarFill = document.getElementById('power-bar-fill');

	// Oyuncu Bilgisi
	let myPlayerId = null;
	let players = []; // { id, name, totalStrokes, totalScore, mapScores: {}, isMe }

	// Skor Değişkenleri
	let currentStrokes = 0;
	let scoreHistory = []; // { mapId, par, strokes, score }

	function generatePlayerId() {
		return Math.floor(1000 + Math.random() * 9000); // 1000-9999 arası
	}

	function renderPlayerList() {
		// Puana göre sırala (Çok puan yapan önde)
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

	function showNameArea() {
		startArea.classList.add('hidden');
		nameArea.classList.remove('hidden');
		nameInput.focus();
	}

	function hideLobby() {
		lobby.classList.add('hidden');
	}

	function showGame(name) {
		hideLobby();
		gameMain.classList.remove('hidden');
		
		// ID oluştur veya yükle
		if (!myPlayerId) myPlayerId = generatePlayerId();
		
		displayName.textContent = `${name} #${myPlayerId}`;
		statusEl.textContent = 'Hazır';
		
		// Oyuncuyu başlat
		players = [{
			id: myPlayerId,
			name: name,
			totalStrokes: 0,
			totalScore: 0,
			mapScores: {},
			isMe: true
		}];
		renderPlayerList();

		// Skorları sıfırla
		scoreHistory = [];
		currentStrokes = 0;
		updateScorecardUI();

		// Basit başlangıç çizimi
		drawInitialScene();
	}

	function validateName(n) {
		if (!n) return false;
		const trimmed = n.trim();
		return trimmed.length >= 2 && trimmed.length <= 20;
	}

	btnSingle.addEventListener('click', () => {
		showNameArea();
	});

	btnMulti.addEventListener('click', () => {
		startArea.classList.add('hidden');
		multiplayerArea.classList.remove('hidden');
	});

	btnSettings.addEventListener('click', () => {
		startArea.classList.add('hidden');
		settingsArea.classList.remove('hidden');
	});

	btnBackMulti.addEventListener('click', () => {
		multiplayerArea.classList.add('hidden');
		startArea.classList.remove('hidden');
	});

	btnBackSettings.addEventListener('click', () => {
		settingsArea.classList.add('hidden');
		startArea.classList.remove('hidden');
	});

	cancelBtn.addEventListener('click', () => {
		nameArea.classList.add('hidden');
		startArea.classList.remove('hidden');
		nameInput.value = '';
		nameError.classList.add('hidden');
	});

	joinBtn.addEventListener('click', () => {
		const v = nameInput.value;
		if (!validateName(v)) {
			nameError.classList.remove('hidden');
			return;
		}
		nameError.classList.add('hidden');
		localStorage.setItem('playerName', v.trim());
		showGame(v.trim());
	});

	nameInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			joinBtn.click();
		}
		if (e.key === 'Escape') {
			cancelBtn.click();
		}
	});

	// Eğer daha önce isim kaydedilmişse onu göster
	const saved = localStorage.getItem('playerName');
	if (saved && validateName(saved)) {
		// Doğrudan lobby yerine bir 'Devam et' akışı olabilir, ancak burada kullanıcıya seçim bırakalım
		nameInput.value = saved;
	}

	// --- OYUN MANTIĞI ---
	let ball = { x: 100, y: 250, vx: 0, vy: 0, radius: 8 };
	let hole = { x: 700, y: 250, radius: 12 };
	
	// Harita Yönetimi
	let currentMapIndex = 0;
	let currentMap = null;
	let isLevelTransitioning = false;

	// Fizik ve Kontrol Değişkenleri
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };
	let currentMouse = { x: 0, y: 0 };
	
	const FRICTION = 0.98; // 1 - 0.02 = 0.98, biraz daha hızlı yavaşlasın
	const MAX_POWER = 28;  // Daha güçlü vuruşlar
	const MAX_DRAG_DIST = 180; 
	const STOP_THRESHOLD = 0.08;

	// Canvas event listener'ları
	canvas.addEventListener('mousedown', onMouseDown);
	window.addEventListener('mousemove', onMouseMove);
	window.addEventListener('mouseup', onMouseUp);

	// Dokunmatik ekran desteği
	canvas.addEventListener('touchstart', (e) => {
		if(e.touches.length > 1) return;
		e.preventDefault(); // Sayfa kaydırmayı önle
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

	function loadMap(index) {
		isLevelTransitioning = false; // Yeni harita yüklendiğinde geçiş modundan çık
		isDragging = false; // Sürüklemeyi iptal et
		powerContainer.classList.add('hidden'); // Güç barını gizle
		
		if (index >= GAME_MAPS.length) {
			// Oyun bitti, scorecard göster
			currentMap = null; // Haritayı temizle
			showScorecard(true);
			return;
		}
		currentMapIndex = index;
		currentMap = GAME_MAPS[currentMapIndex];
		
		// Topu ve deliği yerleştir
		ball.x = currentMap.start.x;
		ball.y = currentMap.start.y;
		ball.vx = 0;
		ball.vy = 0;
		
		hole.x = currentMap.hole.x;
		hole.y = currentMap.hole.y;
		
		// Skor sıfırla
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
		// Header Oluştur
		let headerHtml = '<tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">';
		headerHtml += '<th style="padding: 10px; text-align: left;">Oyuncu</th>';
		
		GAME_MAPS.forEach(map => {
			headerHtml += `<th style="padding: 10px; text-align: center;">H${map.id}</th>`;
		});
		
		headerHtml += '<th style="padding: 10px; text-align: center;">Toplam</th></tr>';
		scorecardHead.innerHTML = headerHtml;

		// Body Oluştur
		scorecardBody.innerHTML = '';
		
		// Oyuncuları puana göre sırala
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
			btnCloseScorecard.classList.remove('hidden');
		}
	}

	btnCloseScorecard.addEventListener('click', () => {
		scorecardOverlay.classList.add('hidden');
		loadMap(currentMapIndex + 1);
	});

	btnRestartGame.addEventListener('click', () => {
		scorecardOverlay.classList.add('hidden');
		gameMain.classList.add('hidden');
		startArea.classList.remove('hidden');
		lobby.classList.remove('hidden');
	});

	// Oyun döngüsünü başlat
	function drawInitialScene() {
		loadMap(0);
		requestAnimationFrame(gameLoop);
	}

	function update() {
		// Sub-stepping (Fizik adımları)
		// Hızlı hareket eden topun duvarların içinden geçmesini (tunneling) önlemek için
		// hareketi küçük parçalara bölüyoruz.
		const steps = 4;
		for (let i = 0; i < steps; i++) {
			physicsStep(1 / steps);
		}
	}

	function physicsStep(dt) {
		// Hız güncelleme (dt oranında)
		ball.x += ball.vx * dt;
		ball.y += ball.vy * dt;

		// Sürtünme (Her adımda değil, her frame'de bir kez uygulanmalı ama basitlik için burada çok az uygulayabiliriz
		// veya ana update'de yapabiliriz. Ana update'de yapmak daha doğru.)
		
		// Duvar çarpışmaları (Canvas Sınırları)
		if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx *= -1; }
		if (ball.x + ball.radius > canvas.width) { ball.x = canvas.width - ball.radius; ball.vx *= -1; }
		if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy *= -1; }
		if (ball.y + ball.radius > canvas.height) { ball.y = canvas.height - ball.radius; ball.vy *= -1; }

		// Engel Çarpışmaları
		if (currentMap && currentMap.walls) {
			currentMap.walls.forEach(wall => {
				// AABB vs Circle
				// En yakın noktayı bul
				const closestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w));
				const closestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h));

				const dx = ball.x - closestX;
				const dy = ball.y - closestY;
				const distSq = dx*dx + dy*dy;

				if (distSq < (ball.radius * ball.radius) && distSq > 0) {
					// Çarpışma var
					const dist = Math.sqrt(distSq);
					const overlap = ball.radius - dist;
					
					// Normal vektörü (Çarpışma noktasından topun merkezine)
					let nx = dx / dist;
					let ny = dy / dist;
					
					// Eğer tam içindeyse (dist=0), yukarı it
					if (dist === 0) { nx = 0; ny = -1; }

					// Topu dışarı it
					ball.x += nx * overlap;
					ball.y += ny * overlap;

					// Hızı yansıt (Reflect velocity)
					// v' = v - 2 * (v . n) * n
					const dot = ball.vx * nx + ball.vy * ny;
					
					// Sadece duvara doğru gidiyorsa yansıt (arkadan çıkarken değil)
					if (dot < 0) {
						ball.vx = ball.vx - 2 * dot * nx;
						ball.vy = ball.vy - 2 * dot * ny;
						
						// Enerji kaybı (bounciness)
						ball.vx *= 0.8;
						ball.vy *= 0.8;
					}
				}
			});
		}
	}

	function checkGameLogic() {
		// Sürtünme (Ana döngüde tek sefer)
		ball.vx *= FRICTION;
		ball.vy *= FRICTION;

		// Durma kontrolü
		if (Math.abs(ball.vx) < STOP_THRESHOLD && Math.abs(ball.vy) < STOP_THRESHOLD) {
			ball.vx = 0;
			ball.vy = 0;
		}

		// Delik kontrolü
		const dx = ball.x - hole.x;
		const dy = ball.y - hole.y;
		const dist = Math.sqrt(dx*dx + dy*dy);
		
		// Top deliğin merkezine yeterince yakın ve hızı makul seviyedeyse içeri girmiş say
		if (
			!isLevelTransitioning &&
			dist < hole.radius * 0.8 &&
			Math.hypot(ball.vx, ball.vy) < 10
		) {
			isLevelTransitioning = true;
			
			// Puan Hesaplama – vuruş sayısına göre azalan sabit puan
			// Örnek skala: 1 vuruş:10, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3, 9:2, 10+:1
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

			// Oyuncu puanını güncelle
			const me = players.find(p => p.isMe);
			if(me) {
				me.totalScore += points;
				if(!me.mapScores) me.mapScores = {};
				me.mapScores[currentMap.id] = points;
			}
			renderPlayerList();

			statusEl.textContent = `${term}! Sonraki haritaya geçiliyor...`;
			ball.vx = 0; 
			ball.vy = 0;
			ball.x = hole.x;
			ball.y = hole.y;
			
			// Loading ekranını güncelle (Artık Scorecard kullanacağız ama loading screen'i kısa bir efekt için tutabiliriz veya direkt scorecard açabiliriz)
			// Kullanıcı deneyimi: Top deliğe girer -> "Birdie!" yazar -> 1 sn sonra Skor Tablosu açılır -> "Devam Et" ile sonraki harita.
			
			statusEl.textContent = `${term}!`;
			
			setTimeout(() => {
				showScorecard(false, { term: term, points: points }); // false = oyun bitmedi, devam et butonu göster
			}, 300); // bekleme süresini kısalt
		}
	}

	function gameLoop() {
		update();
		checkGameLogic();
		draw();
		requestAnimationFrame(gameLoop);
	}

	function draw() {
		const w = canvas.width;
		const h = canvas.height;
		ctx.clearRect(0, 0, w, h);

		// Eğer seviye geçişi başladıysa haritayı çizmeyi durdur
		// Böylece oyuncu sadece skor ekranına odaklanır.
		if (isLevelTransitioning) {
			return;
		}

		// Zemin
		ctx.fillStyle = '#9ee6c9';
		ctx.fillRect(0, 0, w, h);
		
		// Sınırlar (dekoratif)
		ctx.strokeStyle = '#7bbf9a';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, w-4, h-4);

		// Engelleri Çiz
		if (currentMap && currentMap.walls) {
			ctx.fillStyle = '#5d4037'; // Kahverengi duvarlar
			currentMap.walls.forEach(wall => {
				ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
				// Hafif 3D efekti
				ctx.fillStyle = 'rgba(0,0,0,0.2)';
				ctx.fillRect(wall.x + wall.w - 4, wall.y, 4, wall.h);
				ctx.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
				ctx.fillStyle = '#5d4037'; // Reset
			});
		}

		// Delik
		ctx.beginPath();
		ctx.fillStyle = '#111';
		ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI*2);
		ctx.fill();
		ctx.closePath();

		// Ok Çizimi (Eğer sürükleniyorsa)
		if (isDragging) {
			drawArrow();
		}

		// Top
		if (!isLevelTransitioning) {
			ctx.beginPath();
			ctx.fillStyle = '#ffffff';
			ctx.shadowColor = 'rgba(0,0,0,0.2)';
			ctx.shadowBlur = 4;
			ctx.shadowOffsetY = 2;
			ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2);
			ctx.fill();
			ctx.shadowColor = 'transparent'; // reset shadow
			ctx.closePath();
		}
	}

	function drawArrow() {
		// Vektör: Top -> Mouse (Çekme yönü)
		// Atış yönü: Mouse -> Top (Tersi)
		const dx = ball.x - currentMouse.x;
		const dy = ball.y - currentMouse.y;
		
		let dist = Math.sqrt(dx*dx + dy*dy);
		
		// Maksimum çekme mesafesiyle sınırla
		if (dist > MAX_DRAG_DIST) dist = MAX_DRAG_DIST;
		
		// Açıyı hesapla
		const angle = Math.atan2(dy, dx);

		// Görsel uzunluk kısıtlaması (daha kısa ok)
		const MAX_VISUAL_LENGTH = 55;
		const arrowLength = Math.min(dist, MAX_VISUAL_LENGTH);
		
		// Ok başlangıç ofseti (top merkezinden hemen sonra başlasın)
		const startOffset = ball.radius; // tam top kenarından

		// Ok çizimi
		ctx.save();
		ctx.translate(ball.x, ball.y);
		ctx.rotate(angle);

		// Tek parça ok gövdesi
		ctx.beginPath();
		ctx.fillStyle = '#ffffff'; // Beyaz ok
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 1;
		
		// Gövde (startOffset'ten başla)
		ctx.rect(startOffset, -3, arrowLength, 6);
		ctx.fill();
		ctx.stroke();
		ctx.closePath();

		// Ok ucu
		if (arrowLength > 12) {
			ctx.beginPath();
			ctx.fillStyle = '#ffffff';
			// Uç kısmı gövdenin bittiği noktaya tam otursun
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
		// Sadece top duruyorsa atış yapılabilir
		if (Math.abs(ball.vx) > 0.1 || Math.abs(ball.vy) > 0.1) return;

		const pos = getMousePos(e);
		const dx = pos.x - ball.x;
		const dy = pos.y - ball.y;
		
		// Topun üzerine tıklandı mı? (Biraz toleranslı, radius * 2)
		if (dx*dx + dy*dy < (ball.radius * 3) ** 2) {
			isDragging = true;
			dragStart = { x: ball.x, y: ball.y }; // Topun merkezi referans
			currentMouse = pos;
			powerContainer.classList.remove('hidden');
		}
	}

	function onMouseMove(e) {
		if (!isDragging) return;
		currentMouse = getMousePos(e);
		
		// Power Bar Güncelleme
		const dx = ball.x - currentMouse.x;
		const dy = ball.y - currentMouse.y;
		let dist = Math.sqrt(dx*dx + dy*dy);
		if (dist > MAX_DRAG_DIST) dist = MAX_DRAG_DIST;
		
		const percent = (dist / MAX_DRAG_DIST) * 100;
		powerBarFill.style.width = `${percent}%`;
	}

	function onMouseUp(e) {
		if (!isDragging) return;
		isDragging = false;
		powerContainer.classList.add('hidden');
		powerBarFill.style.width = '0%';

		// Fırlatma vektörü hesapla
		const dx = ball.x - currentMouse.x;
		const dy = ball.y - currentMouse.y;
		let dist = Math.sqrt(dx*dx + dy*dy);

		// Maksimum güç sınırlaması
		if (dist > MAX_DRAG_DIST) dist = MAX_DRAG_DIST;

		// Hız faktörü (Power)
		const power = (dist / MAX_DRAG_DIST) * MAX_POWER;
		
		const angle = Math.atan2(dy, dx);
		
		ball.vx = Math.cos(angle) * power;
		ball.vy = Math.sin(angle) * power;
		
		currentStrokes++;
		
		// Toplam vuruşu güncelle (İstatistik için)
		const me = players.find(p => p.isMe);
		if(me) {
			me.totalStrokes++;
		}
		// Puanı burada güncellemiyoruz, delik tamamlanınca güncellenecek.
		
		updateGameUI();
		
		statusEl.textContent = "Atış yapıldı!";
	}

});
