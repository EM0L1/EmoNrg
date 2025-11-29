const GAME_MAPS = [
  // Level 1: "S" Virajı - Isınma ama dikkatli ol
  {
    id: 1,
    par: 3,
    start: { x: 50, y: 50 },
    hole: { x: 750, y: 50 },
    walls: [
      { x: 250, y: 0, w: 20, h: 350 },
      { x: 530, y: 150, w: 20, h: 350 }
    ]
  },
  // Level 2: Mayın Tarlası - Aralardan geç
  {
    id: 2,
    par: 4,
    start: { x: 50, y: 250 },
    hole: { x: 750, y: 250 },
    walls: [
      { x: 200, y: 100, w: 30, h: 30 },
      { x: 200, y: 370, w: 30, h: 30 },
      { x: 350, y: 50, w: 30, h: 120 },
      { x: 350, y: 330, w: 30, h: 120 },
      { x: 500, y: 100, w: 30, h: 30 },
      { x: 500, y: 370, w: 30, h: 30 },
      { x: 350, y: 235, w: 30, h: 30 } // Merkez engel
    ]
  },
  // Level 3: Dar Köprü - Hassas vuruş gerekir
  {
    id: 3,
    par: 3,
    start: { x: 80, y: 250 },
    hole: { x: 720, y: 250 },
    walls: [
      { x: 200, y: 0, w: 400, h: 200 }, // Üst blok
      { x: 200, y: 300, w: 400, h: 200 }, // Alt blok
      { x: 380, y: 220, w: 40, h: 60 } // Köprünün ortasında engel
    ]
  },
  // Level 4: Labirent - Uzun yol
  {
    id: 4,
    par: 5,
    start: { x: 50, y: 50 },
    hole: { x: 750, y: 450 },
    walls: [
      { x: 150, y: 0, w: 20, h: 400 },
      { x: 300, y: 100, w: 20, h: 400 },
      { x: 450, y: 0, w: 20, h: 400 },
      { x: 600, y: 100, w: 20, h: 400 }
    ]
  },
  // Level 5: Kale - İçeri girmek zor
  {
    id: 5,
    par: 4,
    start: { x: 400, y: 450 },
    hole: { x: 400, y: 250 },
    walls: [
      // Dış duvarlar (Kutu)
      { x: 250, y: 100, w: 300, h: 20 }, // Üst
      { x: 250, y: 380, w: 300, h: 20 }, // Alt
      { x: 250, y: 100, w: 20, h: 300 }, // Sol
      { x: 530, y: 100, w: 20, h: 100 }, // Sağ Üst
      { x: 530, y: 260, w: 20, h: 140 }, // Sağ Alt (Giriş 200-260 arası)
      
      // Girişi koruyan engel
      { x: 600, y: 180, w: 20, h: 140 }
    ]
  }
];
