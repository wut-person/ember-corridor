/* =========================================================
   余烬回廊 · 开放世界地形数据层（俯视角沙盒）
   纯数据 + 程序化生成，零外部素材。
   地形分层参考风格：深水 → 浅水 → 沙滩 → 草地 → 草甸 → 森林 → 岩地 → 雪地
   ========================================================= */
(function (G) {
  /* ---------------- 确定性噪声 ---------------- */
  function hash2(x, y, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const v00 = hash2(xi, yi, seed), v10 = hash2(xi + 1, yi, seed);
    const v01 = hash2(xi, yi + 1, seed), v11 = hash2(xi + 1, yi + 1, seed);
    const u = smooth(xf), v = smooth(yf);
    const a = v00 + (v10 - v00) * u;
    const b = v01 + (v11 - v01) * u;
    return a + (b - a) * v;
  }

  function fbm(x, y, seed, oct, lac, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < (oct || 4); i++) {
      sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
      norm += amp;
      amp *= (gain || 0.5);
      freq *= (lac || 2);
    }
    return sum / norm;
  }

  /* ---------------- 地形类型 ---------------- */
  G.TERRAIN = {
    DEEP:    { id: 0, key: 'deep',    name: '深水', walk: false, water: true, color: '#2f6d92', color2: '#2a6386' },
    SHALLOW: { id: 1, key: 'shallow', name: '浅水', walk: true,  water: true, color: '#5b9ab5', color2: '#548fae', slow: 0.6 },
    SAND:    { id: 2, key: 'sand',    name: '沙滩', walk: true,  color: '#dcc78d', color2: '#d3bd80' },
    GRASS:   { id: 3, key: 'grass',   name: '草地', walk: true,  color: '#5f9e4a', color2: '#589445' },
    MEADOW:  { id: 4, key: 'meadow',  name: '草甸', walk: true,  color: '#71b057', color2: '#68a64f' },
    FOREST:  { id: 5, key: 'forest',  name: '森林', walk: true,  color: '#417c3c', color2: '#3b7236', slow: 0.85 },
    ROCK:    { id: 6, key: 'rock',    name: '岩地', walk: true,  color: '#8a8f8c', color2: '#7f8481' },
    SNOW:    { id: 7, key: 'snow',    name: '雪地', walk: true,  color: '#e2e9f0', color2: '#d6dee7' },
  };
  const ORDER = ['DEEP', 'SHALLOW', 'SAND', 'GRASS', 'MEADOW', 'FOREST', 'ROCK', 'SNOW'];

  /* ---------------- 世界参数 ---------------- */
  G.WORLD = { TILE: 16, SIZE: 320, SEED: 20261008 };

  /**
   * 生成世界（一次性；320×320 = 102400 格，毫秒级）
   */
  G.generateWorld = function (size, seed) {
    size = size || G.WORLD.SIZE;
    seed = seed == null ? G.WORLD.SEED : seed;
    const tiles = new Uint8Array(size * size);
    const detail = new Uint8Array(size * size);
    const props = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const nx = x / size, ny = y / size;
        const edge = Math.min(1, Math.min(Math.min(nx, 1 - nx), Math.min(ny, 1 - ny)) * 6.2);
        const base = fbm(x / 44, y / 44, seed, 5, 2.02, 0.52);
        const ridge = fbm(x / 16, y / 16, seed + 77, 3, 2.1, 0.5);
        let h = base * 0.78 + ridge * 0.22;
        h = h * (0.34 + edge * 0.78) - (1 - edge) * 0.24;
        const moist = fbm(x / 58, y / 58, seed + 991, 4, 2.0, 0.5);
        const temp = 1 - Math.abs(ny - 0.5) * 2;

        let t;
        if (h < 0.295) t = 0;
        else if (h < 0.36) t = 1;
        else if (h < 0.412) t = 2;
        else if (h > 0.715) t = temp > 0.58 ? 6 : 7;
        else if (moist > 0.575) t = 5;
        else if (moist > 0.445) t = 4;
        else t = 3;
        tiles[i] = t;
        detail[i] = (hash2(x, y, seed + 555) * 4) | 0;

        const r = hash2(x + 31, y + 17, seed + 4242);
        if (t === 5 && r < 0.44) props.push({ x: x, y: y, kind: r < 0.36 ? 'tree' : 'bush' });
        else if (t === 4 && r < 0.055) props.push({ x: x, y: y, kind: 'bush' });
        else if (t === 3 && r < 0.022) props.push({ x: x, y: y, kind: 'tree' });
        else if (t === 6 && r < 0.05) props.push({ x: x, y: y, kind: 'rock' });
        else if (t === 2 && r < 0.012) props.push({ x: x, y: y, kind: 'rock' });
        else if (t === 7 && r < 0.035) props.push({ x: x, y: y, kind: 'pine' });
      }
    }

    const spawnHint = { x: size >> 1, y: size >> 1 };

    /* ---------- 遗迹：在世界各处撒点，避开深水与边缘 ---------- */
    const ruins = [];
    {
      let tries = 0;
      /* 注意：随机源必须用「尝试次数」当输入，不能用 ruins.length ——
         否则一旦某个坐标不可用，长度不变会导致每轮都试同一个点，直接卡死 */
      const rnd = function () { return hash2(tries * 7 + 13, tries * 31 + 5, seed + 8123); };
      while (ruins.length < 16 && tries < 4000) {
        tries++;
        const rx = 18 + Math.floor(rnd() * (size - 36));
        const ry = 18 + Math.floor(rnd() * (size - 36));
        const dist = Math.hypot(rx - spawnHint.x, ry - spawnHint.y);
        if (dist < 42) continue;                       /* 别贴着出生点 */
        let tooClose = false;
        for (let i = 0; i < ruins.length; i++) {
          if (Math.hypot(ruins[i].x - rx, ruins[i].y - ry) < 34) { tooClose = true; break; }
        }
        if (tooClose) continue;
        /* 遗迹中心必须是陆地，且周围不能有大片深水 */
        const ct = tiles[ry * size + rx];
        if (ct === 0 || ct === 1 || ct === 7) continue;
        /* 档位：离出生点越远越高（0~5） */
        const tier = Math.max(0, Math.min(5, Math.floor(dist / 46)));
        const type = G.pickRuinType(tier, Math.floor(rnd() * 997));
        ruins.push({ x: rx, y: ry, id: type.id, name: type.name, tier: tier,
                     w: type.w, h: type.h, desc: type.desc, cleared: false, spawned: false });
      }
    }

    /* 出生点：世界中心向外找第一块陆地 */
    let spawn = { x: size >> 1, y: size >> 1 };
    const cx = size / 2, cy = size / 2;
    search:
    for (let r = 0; r < size / 2; r++) {
      for (let a = 0; a < 32; a++) {
        const ang = a / 32 * Math.PI * 2;
        const sx = Math.round(cx + Math.cos(ang) * r);
        const sy = Math.round(cy + Math.sin(ang) * r);
        if (sx < 2 || sy < 2 || sx >= size - 2 || sy >= size - 2) continue;
        const tt = tiles[sy * size + sx];
        if (tt >= 2 && tt <= 5) { spawn = { x: sx, y: sy }; break search; }
      }
    }

    return { size: size, seed: seed, tiles: tiles, detail: detail, props: props, spawn: spawn, ruins: ruins };
  };

  G.tileAt = function (w, x, y) {
    if (x < 0 || y < 0 || x >= w.size || y >= w.size) return 0;
    return w.tiles[y * w.size + x];
  };
  G.tInfo = function (id) {
    const t = G.TERRAIN[ORDER[id]];
    return t || G.TERRAIN.DEEP;
  };
  G.isWalkable = function (w, x, y) {
    const t = G.tInfo(G.tileAt(w, x, y));
    return !!t.walk;
  };
  G.tileSpeed = function (w, x, y) {
    const t = G.tInfo(G.tileAt(w, x, y));
    return t.slow || 1;
  };

  /**
   * 一次性把世界画到离屏 canvas（供 M 键大地图复用，避免每帧重画 10 万格）
   */
  G.renderMapThumb = function (w, px) {
    px = px || 3;
    const cv = document.createElement('canvas');
    cv.width = w.size * px;
    cv.height = w.size * px;
    const c = cv.getContext('2d');
    for (let y = 0; y < w.size; y++) {
      const row = y * w.size;
      for (let x = 0; x < w.size; x++) {
        c.fillStyle = G.tInfo(w.tiles[row + x]).color;
        c.fillRect(x * px, y * px, px, px);
      }
    }
    /* 植被加深，森林区域一眼可辨 */
    for (const p of w.props) {
      if (p.kind === 'tree') c.fillStyle = 'rgba(43,92,42,.5)';
      else if (p.kind === 'pine') c.fillStyle = 'rgba(47,111,74,.5)';
      else continue;
      c.fillRect(p.x * px, p.y * px, px, px);
    }
    /* 外海压暗，突出陆地轮廓 */
    c.globalAlpha = 0.12;
    c.fillStyle = '#0b2233';
    for (let y = 0; y < w.size; y++) {
      const row = y * w.size;
      for (let x = 0; x < w.size; x++) {
        if (w.tiles[row + x] === 0) c.fillRect(x * px, y * px, px, px);
      }
    }
    c.globalAlpha = 1;
    return cv;
  };
})(window.G = window.G || {});
