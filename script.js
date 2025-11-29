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
	const playerListEl = document.getElementById('player-list');

	// Oyuncu Bilgisi
	let myPlayerId = null;

	function generatePlayerId() {
		return Math.floor(1000 + Math.random() * 9000); // 1000-9999 arası
	}

	function updatePlayerList(name, id) {
		// Şimdilik sadece kendimizi ekliyoruz
		playerListEl.innerHTML = `
			<li>
				<span class="p-name">${name} (Sen)</span>
				<span class="p-id">#${id}</span>
			</li>
		`;
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
		
		updatePlayerList(name, myPlayerId);

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
	
	const FRICTION = 0.975;
	const MAX_POWER = 18; 
	const MAX_DRAG_DIST = 150; 
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
		if (index >= GAME_MAPS.length) {
			statusEl.textContent = "Tüm haritalar tamamlandı! Tebrikler!";
			// Başa dön veya bitir
			index = 0;
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
		
		statusEl.textContent = `Harita ${currentMap.id} / ${GAME_MAPS.length}`;
	}

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
		
		if (!isLevelTransitioning && dist < (hole.radius + ball.radius * 0.5) && Math.abs(ball.vx) < 5 && Math.abs(ball.vy) < 5) {
			isLevelTransitioning = true;
			statusEl.textContent = "Tebrikler! Sonraki haritaya geçiliyor...";
			ball.vx = 0; 
			ball.vy = 0;
			ball.x = hole.x;
			ball.y = hole.y;
			
			loadingScreen.classList.remove('hidden');
			setTimeout(() => {
				loadMap(currentMapIndex + 1);
				loadingScreen.classList.add('hidden');
				isLevelTransitioning = false;
			}, 2000);
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

		// Güç seviyesi (1-5 arası)
		// dist 0..MAX_DRAG_DIST -> level 0..5
		const level = Math.ceil((dist / MAX_DRAG_DIST) * 5);
		
		// Ok uzunluğu (görsel olarak biraz daha uzun görünsün diye scale edebiliriz veya dist kullanabiliriz)
		const arrowLength = dist; 

		// Ok çizimi
		ctx.save();
		ctx.translate(ball.x, ball.y);
		ctx.rotate(angle);

		// Ok gövdesi (Kademeli renk veya parça parça)
		// 5 parça çizelim, aktif olanlar dolu, olmayanlar boş veya silik
		const segmentLen = MAX_DRAG_DIST / 5;
		
		for (let i = 1; i <= 5; i++) {
			ctx.beginPath();
			// Her segment biraz boşluklu olsun
			const startX = (i - 1) * (segmentLen) + 5; 
			const endX = i * segmentLen - 2;
			
			if (startX > arrowLength) break; // Sadece çekilen kadarını çiz

			// Renk: Güç arttıkça yeşilden kırmızıya
			if (i <= 2) ctx.fillStyle = '#4ade80'; // Yeşil
			else if (i <= 4) ctx.fillStyle = '#facc15'; // Sarı
			else ctx.fillStyle = '#ef4444'; // Kırmızı

			// Ok gövdesi dikdörtgen
			ctx.rect(startX, -3, (endX - startX), 6);
			ctx.fill();
			ctx.closePath();
		}

		// Ok ucu (Sadece en sonda çizilsin)
		if (dist > 10) {
			ctx.beginPath();
			ctx.fillStyle = (level >= 5) ? '#ef4444' : (level >= 3 ? '#facc15' : '#4ade80');
			ctx.moveTo(arrowLength, 0);
			ctx.lineTo(arrowLength - 10, -6);
			ctx.lineTo(arrowLength - 10, 6);
			ctx.fill();
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
		}
	}

	function onMouseMove(e) {
		if (!isDragging) return;
		currentMouse = getMousePos(e);
	}

	function onMouseUp(e) {
		if (!isDragging) return;
		isDragging = false;

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
		
		statusEl.textContent = "Atış yapıldı!";
	}

});
