/* =========================================================
   余烬回廊 · 程序化 SVG 图标（武器 / 物品）
   所有图标内联生成，无外部图片依赖
   ========================================================= */
(function (G) {
  const U = G.U;

  /* 稀有度 -> 色调 */
  const QC = ['#9fb0c4', '#5fe08a', '#54b8ff', '#c07cff', '#ffb340', '#ff6b6b'];

  /* 武器部件配色 */
  const M = {
    blade: '#dfe8f5', bladeDark: '#94a3b8', tip: '#ffffff',
    wood: '#6b4a2a', woodDark: '#432c17',
    gold: '#f6c667', goldDark: '#a9822f',
    gem: '#ff8a3c', gemCyan: '#4fd7ff', gemViolet: '#a06cff',
    leather: '#4a3222', steel: '#8d97a5'
  };

  /* 每把武器的核心图形（坐标基于 64×64 画布） */
  const WEAPON_BODY = {
    /* --- 剑类：刀尖朝右上 --- */
    blade: function (q) {
      return [
        '<rect x="27" y="42" width="8" height="18" rx="3" fill="' + M.leather + '"/>',
        '<rect x="24" y="38" width="14" height="5" rx="2" fill="' + M.gold + '"/>',
        '<path d="M31 8 L39 22 L38 40 L24 40 L23 22 Z" fill="url(#steel)"/>',
        '<path d="M31 10 L36 23 L35.6 38 L31 38 Z" fill="#ffffff" opacity=".55"/>',
        q >= 3 ? '<path d="M26 24 L36 24" stroke="' + (q >= 5 ? M.gemCyan : M.gem) + '" stroke-width="2.4" opacity=".9"/>' : ''
      ].join('');
    },
    /* --- 大剑：宽刃 --- */
    greatsword: function (q) {
      return [
        '<rect x="28" y="44" width="8" height="18" rx="3" fill="' + M.leather + '"/>',
        '<rect x="22" y="39" width="20" height="6" rx="2" fill="' + M.goldDark + '"/>',
        '<path d="M32 4 L44 20 L42 42 L22 42 L20 20 Z" fill="url(#steel)"/>',
        '<path d="M32 6 L40 21 L38.5 40 L32 40 Z" fill="#ffffff" opacity=".42"/>',
        '<path d="M26 26 L38 26 M25 33 L39 33" stroke="' + M.gem + '" stroke-width="2" opacity=".75"/>',
        q >= 4 ? '<circle cx="32" cy="18" r="4.2" fill="' + M.gem + '" opacity=".95"/>' : ''
      ].join('');
    },
    /* --- 长柄：枪 --- */
    spear: function (q) {
      return [
        '<rect x="30" y="18" width="4" height="44" rx="2" fill="' + M.wood + '"/>',
        '<rect x="30" y="18" width="1.6" height="44" fill="#ffffff" opacity=".18"/>',
        '<path d="M32 2 L40 18 L32 26 L24 18 Z" fill="url(#steel)"/>',
        '<path d="M32 5 L37 18 L32 23 Z" fill="#ffffff" opacity=".5"/>',
        '<rect x="26" y="16" width="12" height="4" rx="2" fill="' + M.gold + '"/>',
        q >= 3 ? '<circle cx="32" cy="19" r="3" fill="' + M.gemCyan + '"/>' : ''
      ].join('');
    },
    /* --- 双斧：一把大斧 --- */
    axe: function (q) {
      return [
        '<rect x="30" y="16" width="5" height="46" rx="2" fill="' + M.wood + '"/>',
        '<path d="M30 12 C18 14 12 24 16 34 C22 32 28 26 30 20 Z" fill="url(#steel)"/>',
        '<path d="M33 14 C45 16 50 26 46 36 C40 33 34 27 33 21 Z" fill="url(#steel)" opacity=".9"/>',
        '<path d="M30 14 C22 16 18 23 19 30" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".5"/>',
        '<rect x="27" y="14" width="11" height="4" rx="2" fill="' + M.goldDark + '"/>',
        q >= 3 ? '<path d="M22 22 C26 20 28 18 30 15" stroke="' + M.gem + '" stroke-width="2" fill="none"/>' : ''
      ].join('');
    },
    /* --- 战锤 --- */
    hammer: function (q) {
      return [
        '<rect x="30" y="26" width="5" height="36" rx="2" fill="' + M.wood + '"/>',
        '<rect x="14" y="8" width="36" height="22" rx="4" fill="url(#steel)"/>',
        '<rect x="18" y="12" width="28" height="4" rx="2" fill="#ffffff" opacity=".35"/>',
        '<rect x="26" y="6" width="12" height="6" rx="2" fill="' + M.steel + '"/>',
        q >= 3 ? '<circle cx="32" cy="20" r="5" fill="' + M.gem + '" opacity=".9"/><circle cx="32" cy="20" r="9" fill="' + M.gem + '" opacity=".22"/>' : ''
      ].join('');
    },
    /* --- 弓 --- */
    bow: function (q) {
      return [
        '<path d="M22 6 C40 16 40 48 22 58" stroke="' + M.wood + '" stroke-width="5" fill="none" stroke-linecap="round"/>',
        '<path d="M22 6 C36 16 36 48 22 58" stroke="' + M.gold + '" stroke-width="1.6" fill="none" opacity=".8"/>',
        '<path d="M22 7 L22 57" stroke="#e8eef8" stroke-width="1.4" opacity=".8"/>',
        '<path d="M22 32 L48 32" stroke="' + M.steel + '" stroke-width="2.6"/>',
        '<path d="M48 32 L43 28 L43 36 Z" fill="' + M.blade + '"/>',
        q >= 3 ? '<circle cx="22" cy="32" r="3.4" fill="' + M.gemCyan + '"/>' : ''
      ].join('');
    },
    /* --- 弩 --- */
    crossbow: function (q) {
      return [
        '<rect x="14" y="28" width="38" height="7" rx="3" fill="' + M.woodDark + '"/>',
        '<path d="M26 4 C40 14 40 26 26 32" stroke="' + M.steel + '" stroke-width="5" fill="none"/>',
        '<path d="M26 8 L26 32" stroke="#e8eef8" stroke-width="1.6" opacity=".85"/>',
        '<rect x="8" y="26" width="12" height="10" rx="3" fill="' + M.steel + '"/>',
        '<path d="M44 31 L56 31" stroke="' + M.blade + '" stroke-width="3"/>',
        q >= 3 ? '<circle cx="20" cy="31" r="3.2" fill="' + M.gem + '"/>' : ''
      ].join('');
    },
    /* --- 法杖 --- */
    staff: function (q) {
      return [
        '<rect x="30" y="22" width="4.6" height="40" rx="2" fill="' + M.wood + '"/>',
        '<circle cx="32" cy="16" r="12" fill="' + M.gemViolet + '" opacity=".2"/>',
        '<circle cx="32" cy="16" r="7.5" fill="' + M.gemViolet + '"/>',
        '<circle cx="32" cy="16" r="3.4" fill="#f0e6ff"/>',
        '<path d="M18 30 C24 22 40 22 46 30" stroke="' + M.gold + '" stroke-width="2.6" fill="none"/>',
        '<circle cx="18" cy="30" r="2.6" fill="' + M.gold + '"/><circle cx="46" cy="30" r="2.6" fill="' + M.gold + '"/>'
      ].join('');
    },
    /* --- 拳套 --- */
    gauntlet: function (q) {
      return [
        '<path d="M16 22 L42 22 L46 34 L42 48 L18 48 L14 34 Z" fill="url(#steel)"/>',
        '<rect x="18" y="26" width="24" height="4" rx="2" fill="#ffffff" opacity=".3"/>',
        '<rect x="30" y="10" width="18" height="11" rx="4" fill="' + M.steel + '"/>',
        '<rect x="32" y="12" width="14" height="3" rx="1.5" fill="#ffffff" opacity=".35"/>',
        '<circle cx="24" cy="36" r="4.4" fill="' + M.gem + '"/><circle cx="36" cy="36" r="4.4" fill="' + M.gem + '"/>',
        q >= 4 ? '<circle cx="30" cy="42" r="3.2" fill="' + M.gemCyan + '"/>' : ''
      ].join('');
    },
    /* --- 镰 --- */
    scythe: function (q) {
      return [
        '<rect x="20" y="14" width="5" height="48" rx="2" fill="' + M.woodDark + '"/>',
        '<path d="M22 14 C40 6 56 16 58 34 C48 24 34 20 22 22 Z" fill="url(#steel)"/>',
        '<path d="M24 16 C38 12 50 18 55 31" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".5"/>',
        '<circle cx="24" cy="16" r="3.4" fill="' + M.gold + '"/>',
        q >= 4 ? '<path d="M30 40 C38 44 44 40 46 32" stroke="' + M.gemCyan + '" stroke-width="2" fill="none" opacity=".8"/>' : ''
      ].join('');
    },
    /* --- 长鞭 --- */
    whip: function (q) {
      return [
        '<rect x="12" y="34" width="14" height="8" rx="4" fill="' + M.leather + '"/>',
        '<path d="M24 36 C34 46 46 46 54 30" stroke="' + M.gem + '" stroke-width="4" fill="none" stroke-linecap="round"/>',
        '<path d="M24 36 C34 46 46 46 54 30" stroke="#ffe0b0" stroke-width="1.4" fill="none" opacity=".7"/>',
        '<path d="M50 34 L58 24" stroke="' + M.gem + '" stroke-width="3" stroke-linecap="round"/>',
        '<circle cx="20" cy="38" r="4" fill="' + M.gold + '"/>',
        q >= 3 ? '<path d="M28 30 C34 24 42 24 46 28" stroke="' + M.gemCyan + '" stroke-width="1.8" fill="none" opacity=".8"/>' : ''
      ].join('');
    }
  };

  /* ---------------- 物品图标 ---------------- */
  const ITEM_BODY = {
    coin: '<circle cx="32" cy="32" r="18" fill="' + M.gold + '"/><circle cx="32" cy="32" r="18" fill="none" stroke="' + M.goldDark + '" stroke-width="2.5"/><text x="32" y="41" font-size="22" font-family="sans-serif" font-weight="bold" fill="#6b4a10" text-anchor="middle">E</text>',
    relic: '<path d="M32 6 L52 20 L44 52 L20 52 L12 20 Z" fill="' + M.gemViolet + '" opacity=".85"/><path d="M32 14 L44 22 L38 46 L26 46 L20 22 Z" fill="#e2d3ff" opacity=".65"/><circle cx="32" cy="30" r="6" fill="#ffffff" opacity=".8"/>',
    potion_red: '<path d="M26 8 H38 V18 L46 34 A12 12 0 0 1 34 52 H30 A12 12 0 0 1 18 34 L26 18 Z" fill="#ff6b6b"/><path d="M22 36 A12 12 0 0 0 42 36 L42 40 A14 14 0 0 1 22 40 Z" fill="#ffb0b0" opacity=".7"/><rect x="24" y="4" width="16" height="6" rx="3" fill="' + M.wood + '"/>',
    potion_red_big: '<path d="M24 6 H40 V16 L50 34 A14 14 0 0 1 36 56 H28 A14 14 0 0 1 14 34 L24 16 Z" fill="#ff4d4d"/><path d="M20 36 A14 14 0 0 0 44 36 L44 42 A16 16 0 0 1 20 42 Z" fill="#ffc0c0" opacity=".65"/><rect x="22" y="2" width="20" height="6" rx="3" fill="' + M.gold + '"/>',
    potion_blue: '<path d="M26 8 H38 V18 L46 34 A12 12 0 0 1 34 52 H30 A12 12 0 0 1 18 34 L26 18 Z" fill="#54b8ff"/><path d="M22 36 A12 12 0 0 0 42 36 L42 40 A14 14 0 0 1 22 40 Z" fill="#bfe4ff" opacity=".7"/><rect x="24" y="4" width="16" height="6" rx="3" fill="' + M.wood + '"/>',
    potion_orange: '<path d="M26 8 H38 V18 L46 34 A12 12 0 0 1 34 52 H30 A12 12 0 0 1 18 34 L26 18 Z" fill="#ff8a3c"/><path d="M22 36 A12 12 0 0 0 42 36 L42 40 A14 14 0 0 1 22 40 Z" fill="#ffd8a8" opacity=".7"/><rect x="24" y="4" width="16" height="6" rx="3" fill="' + M.gold + '"/>',
    potion_green: '<path d="M26 8 H38 V18 L46 34 A12 12 0 0 1 34 52 H30 A12 12 0 0 1 18 34 L26 18 Z" fill="#5fe08a"/><path d="M22 36 A12 12 0 0 0 42 36 L42 40 A14 14 0 0 1 22 40 Z" fill="#c8ffd8" opacity=".7"/><rect x="24" y="4" width="16" height="6" rx="3" fill="' + M.steel + '"/>',
    bomb: '<circle cx="32" cy="38" r="16" fill="#3a4150"/><circle cx="32" cy="38" r="16" fill="none" stroke="#1d222b" stroke-width="2"/><path d="M32 20 L32 12" stroke="' + M.wood + '" stroke-width="3.4"/><circle cx="34" cy="9" r="4" fill="#ff8a3c"/><circle cx="34" cy="9" r="7" fill="#ff8a3c" opacity=".3"/>',
    smoke: '<circle cx="32" cy="40" r="14" fill="#5b636f"/><circle cx="22" cy="30" r="9" fill="#79828f" opacity=".9"/><circle cx="42" cy="28" r="10" fill="#8d97a5" opacity=".85"/><circle cx="32" cy="20" r="7" fill="#aab4c0" opacity=".8"/>',
    ash: '<path d="M32 4 C40 18 52 26 46 42 A14 14 0 0 1 18 42 C12 26 24 18 32 4 Z" fill="' + M.gem + '"/><path d="M32 18 C36 26 42 30 40 38 A8 8 0 0 1 24 38 C22 30 28 26 32 18 Z" fill="#ffe6c0" opacity=".8"/>',
    key: '<circle cx="20" cy="20" r="10" fill="none" stroke="' + M.gold + '" stroke-width="5"/><path d="M27 27 L50 50" stroke="' + M.gold + '" stroke-width="5" stroke-linecap="round"/><path d="M42 42 L48 36 M46 46 L52 40" stroke="' + M.gold + '" stroke-width="4" stroke-linecap="round"/>',
    scrap: '<path d="M14 40 L22 16 L36 22 L46 34 L40 50 L20 50 Z" fill="' + M.steel + '"/><path d="M22 16 L36 22 L34 32 L20 30 Z" fill="#b6c0cc" opacity=".7"/><circle cx="30" cy="38" r="3" fill="#5b636f"/>',
    dust: '<circle cx="24" cy="40" r="9" fill="' + M.gem + '" opacity=".9"/><circle cx="38" cy="34" r="7" fill="#ffb066" opacity=".9"/><circle cx="34" cy="46" r="6" fill="#ff8a3c" opacity=".85"/><circle cx="44" cy="44" r="4" fill="#ffd0a0" opacity=".8"/>',
    core: '<circle cx="32" cy="32" r="17" fill="#8a3a12"/><circle cx="32" cy="32" r="17" fill="none" stroke="#ff8a3c" stroke-width="3"/><circle cx="32" cy="32" r="9" fill="#ff8a3c"/><circle cx="32" cy="32" r="4" fill="#fff0d0"/>',
    shard: '<path d="M32 4 L46 26 L38 58 L26 58 L18 26 Z" fill="' + M.gemViolet + '"/><path d="M32 4 L38 26 L32 58 L26 26 Z" fill="#e0d0ff" opacity=".7"/>',
    scroll: '<rect x="14" y="12" width="36" height="40" rx="3" fill="#e8dcc0"/><rect x="14" y="12" width="36" height="6" rx="3" fill="' + M.gold + '"/><path d="M22 26 H42 M22 34 H42 M22 42 H34" stroke="#8a7452" stroke-width="3" stroke-linecap="round"/>',
    /* 生物产物 / 采集物 */
    meat: '<path d="M18 40 C14 30 20 18 32 16 C44 14 52 22 50 34 C48 46 36 52 26 50 Z" fill="#c05a5a"/><path d="M24 38 C22 32 26 24 34 23 C42 22 46 27 45 34 C44 41 36 45 30 43 Z" fill="#e08080" opacity=".85"/><ellipse cx="40" cy="42" rx="7" ry="5" fill="#f0ece0"/><circle cx="40" cy="42" r="2.4" fill="#c8b8a0"/>',
    fish: '<path d="M12 32 C22 20 40 20 50 32 C40 44 22 44 12 32 Z" fill="#5fa8d8"/><path d="M50 32 L60 22 L56 32 L60 42 Z" fill="#3f88b8"/><path d="M18 30 C24 24 34 24 40 30" fill="none" stroke="#bfe4ff" stroke-width="2" opacity=".8"/><circle cx="22" cy="30" r="2.6" fill="#0d1014"/><path d="M30 22 L34 14 L38 22 Z" fill="#7fc8e8"/>',
    cloth: '<rect x="12" y="20" width="40" height="26" rx="4" fill="#c8b898"/><path d="M12 26 H52 M12 34 H52 M12 42 H52" stroke="#a89478" stroke-width="2"/><path d="M20 20 L28 46 M36 20 L44 46" stroke="#e0d4b8" stroke-width="2" opacity=".7"/>',
    feather: '<path d="M20 52 C20 34 30 16 48 12 C50 30 40 48 24 52 Z" fill="#e8eef8"/><path d="M24 48 C26 34 34 22 46 16" fill="none" stroke="#9aa8bc" stroke-width="2.4"/><path d="M22 50 L18 56" stroke="#8a94a2" stroke-width="3" stroke-linecap="round"/>',
    wood: '<rect x="12" y="18" width="40" height="14" rx="4" fill="#8a5a30"/><rect x="14" y="34" width="36" height="13" rx="4" fill="#6b4a2a"/><ellipse cx="50" cy="25" rx="5" ry="7" fill="#c8a06a"/><ellipse cx="50" cy="25" rx="2.4" ry="3.4" fill="#8a6a42"/><path d="M18 24 H40 M18 40 H38" stroke="#54381f" stroke-width="1.6" opacity=".7"/>',
    sand: '<path d="M10 46 L26 22 L40 30 L54 46 Z" fill="#e8d49a"/><path d="M26 22 L40 30 L54 46 L10 46 Z" fill="#d8c078"/><circle cx="24" cy="40" r="1.8" fill="#b8a058"/><circle cx="36" cy="36" r="1.6" fill="#b8a058"/><circle cx="44" cy="42" r="2" fill="#b8a058"/>',
    water: '<path d="M32 8 C42 22 50 30 50 40 A18 18 0 0 1 14 40 C14 30 22 22 32 8 Z" fill="#54b8ff"/><path d="M32 20 C38 30 42 34 42 40 A10 10 0 0 1 22 40 C22 34 26 30 32 20 Z" fill="#bfe4ff" opacity=".75"/>',
    horn: '<path d="M20 52 C22 34 30 20 46 12 C44 26 40 38 32 46 Z" fill="#d8c49a"/><path d="M24 48 C26 34 32 24 44 16 C42 28 38 38 32 44 Z" fill="#eadcc0"/><path d="M28 34 L24 30 M34 26 L30 22" stroke="#a8926a" stroke-width="2" stroke-linecap="round"/>',
    tusk: '<path d="M46 12 C40 26 30 38 16 50 C26 50 38 42 46 28 Z" fill="#f2ead6"/><path d="M42 18 C38 28 30 37 22 44 C30 42 38 34 42 24 Z" fill="#ffffff"/><path d="M22 46 C30 40 38 32 42 22" stroke="#c8bca0" stroke-width="1.6" fill="none"/>',
    gel: '<ellipse cx="32" cy="38" rx="20" ry="17" fill="#5fb8e8" opacity=".85"/><ellipse cx="32" cy="36" rx="16" ry="13" fill="#8fd8f8"/><ellipse cx="25" cy="31" rx="5" ry="3.4" fill="#ffffff" opacity=".8"/><circle cx="41" cy="42" r="3" fill="#bfe8ff" opacity=".9"/>',
    sprout: '<path d="M32 52 L32 30" stroke="#4a7a2a" stroke-width="3.4" stroke-linecap="round"/><path d="M32 32 C22 30 16 22 16 14 C26 14 32 22 32 32 Z" fill="#6ec03a"/><path d="M32 34 C42 32 48 24 48 16 C38 16 32 24 32 34 Z" fill="#8ed84f"/><path d="M20 18 C25 21 29 26 31 31" stroke="#3f7a22" stroke-width="1.4" fill="none"/>',
    stone: '<path d="M12 44 L20 22 L36 16 L52 28 L48 46 L24 50 Z" fill="#8d97a5"/><path d="M20 22 L36 16 L52 28 L34 32 Z" fill="#b6c0cc"/><path d="M34 32 L48 46 L24 50 Z" fill="#6b7480"/><circle cx="26" cy="38" r="2.2" fill="#5b636f"/>',
    /* 衣物通用图标 */
    cloth_head: '<path d="M14 40 A18 20 0 0 1 50 40 L50 48 L14 48 Z" fill="' + M.steel + '"/><path d="M18 40 A14 16 0 0 1 46 40 L46 44 L18 44 Z" fill="#2b3342"/><rect x="12" y="44" width="40" height="6" rx="3" fill="#5b636f"/>',
    cloth_body: '<path d="M18 16 L46 16 L52 26 L48 32 L48 52 L16 52 L16 32 L12 26 Z" fill="' + M.steel + '"/><path d="M26 16 L32 24 L38 16" fill="none" stroke="#5b636f" stroke-width="3"/><path d="M24 34 H40" stroke="#ffffff" stroke-width="2.4" opacity=".35"/>',
    cloth_legs: '<path d="M18 12 L46 12 L44 54 L34 54 L32 34 L30 54 L20 54 Z" fill="' + M.steel + '"/><rect x="16" y="12" width="32" height="6" rx="3" fill="#5b636f"/>',
    cloth_cloak: '<path d="M32 8 C44 8 52 18 52 34 L52 56 L12 56 L12 34 C12 18 20 8 32 8 Z" fill="#8d4a24"/><path d="M32 12 C40 12 46 20 46 34 L46 52 L18 52 L18 34 C18 20 24 12 32 12 Z" fill="#b8451c" opacity=".85"/><circle cx="32" cy="14" r="4" fill="' + M.gold + '"/>'
  };

  /* 稀有度光环 */
  function glow(q) {
    const col = QC[U.clamp(q || 0, 0, 5)];
    if ((q || 0) < 2) return '';
    return '<circle cx="32" cy="32" r="26" fill="' + col + '" opacity="' + (0.06 + q * 0.02) + '"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="' + col + '" stroke-width="1.2" opacity=".35"/>';
  }

  function wrap(body, q, extraDefs) {
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '<linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f2f7ff"/><stop offset=".45" stop-color="#c3ccda"/><stop offset="1" stop-color="#7d8899"/>' +
      '</linearGradient>' +
      (extraDefs || '') +
      '</defs>' +
      glow(q) + body + '</svg>';
  }

  /* 武器 id -> 图形类型 */
  const WMAP = {
    w_ember_blade: 'blade', w_iron_falchion: 'blade', w_dawn_edge: 'blade',
    w_ash_greatsword: 'greatsword', w_obsidian_cleaver: 'greatsword',
    w_rift_spear: 'spear', w_storm_halberd: 'spear',
    w_ember_axe: 'axe', w_gravity_maul: 'hammer',
    w_ember_bow: 'bow', w_ember_longbow: 'bow', w_storm_crossbow: 'crossbow',
    w_void_staff: 'staff', w_flame_gauntlet: 'gauntlet',
    w_soul_scythe: 'scythe', w_ember_whip: 'whip'
  };

  const cache = {};
  const Icons = {
    QC: QC,
    /** 武器图标 */
    weapon: function (w) {
      if (!w) return Icons.blank();
      const key = 'w:' + (w.id || 'x') + ':' + (w.rarity || 0);
      if (cache[key]) return cache[key];
      const kind = WMAP[w.id] || 'blade';
      const body = (WEAPON_BODY[kind] || WEAPON_BODY.blade)(w.rarity || 0);
      const svg = wrap(
        '<g transform="rotate(-8 32 32)">' + body + '</g>',
        w.rarity || 0,
        kind === 'whip' || kind === 'staff'
          ? '<radialGradient id="gl" cx=".5" cy=".5"><stop offset="0" stop-color="' + (kind === 'staff' ? M.gemViolet : M.gem) + '" stop-opacity=".9"/><stop offset="1" stop-color="' + (kind === 'staff' ? M.gemViolet : M.gem) + '" stop-opacity="0"/></radialGradient>'
          : ''
      );
      cache[key] = svg;
      return svg;
    },
    /** 物品图标 */
    item: function (it) {
      if (!it) return Icons.blank();
      const key = 'i:' + (it.id || it.icon || 'x') + ':' + (it.rarity || 0);
      if (cache[key]) return cache[key];
      let body = ITEM_BODY[it.icon];
      if (!body) {
        if (it.slot) body = ITEM_BODY['cloth_' + it.slot];
        else body = ITEM_BODY.scrap;
      }
      /* 衣物按外观色调重新着色 */
      if (it.slot && it.look && it.look.tone) {
        const tone = it.look.tone;
        body = '<g>' +
          '<path d="M34 8 C46 8 54 18 54 34 L54 56 L14 56 L14 34 C14 18 22 8 34 8 Z" fill="' + tone + '" opacity="0"/>' +
          '</g>' + body.replace(/#8d4a24|#b8451c|#98a3b0|#8d97a5/g, tone);
      }
      const svg = wrap(body, it.rarity || 0);
      cache[key] = svg;
      return svg;
    },
    /** 衣物图标（按槽位回退） */
    cloth: function (c) {
      if (!c) return Icons.blank();
      const it = { id: c.id, rarity: c.rarity, icon: 'cloth_' + c.slot, slot: c.slot, look: c.look };
      return Icons.item(it);
    },
    /** 技能图标 */
    skill: function (id) {
      const map = {
        sk_dash_cut: '<path d="M12 44 L40 16" stroke="#dfe8f5" stroke-width="4" stroke-linecap="round"/><path d="M30 12 L46 12 L46 28" fill="none" stroke="' + M.gem + '" stroke-width="4"/><path d="M14 50 C22 46 30 40 36 32" stroke="#ffffff" stroke-width="2" fill="none" opacity=".6"/>',
        sk_whirl: '<path d="M32 10 A22 22 0 1 1 12 32" stroke="' + M.gemCyan + '" stroke-width="4" fill="none"/><path d="M32 10 L26 18 L38 18 Z" fill="' + M.gemCyan + '"/><circle cx="32" cy="34" r="6" fill="#dfe8f5"/>',
        sk_quake: '<path d="M8 46 L56 46" stroke="' + M.steel + '" stroke-width="4"/><path d="M18 44 L26 28 L34 40 L44 22" stroke="' + M.gem + '" stroke-width="4" fill="none"/><circle cx="32" cy="14" r="5" fill="' + M.gem + '"/>',
        sk_execute: '<path d="M32 8 L40 30 L32 56 L24 30 Z" fill="#ff6b6b"/><path d="M10 24 L22 32 M54 24 L42 32" stroke="#ff6b6b" stroke-width="3"/>',
        sk_thrust: '<path d="M8 52 L48 12" stroke="#dfe8f5" stroke-width="4" stroke-linecap="round"/><path d="M40 6 L54 10 L50 22" fill="none" stroke="' + M.gemCyan + '" stroke-width="3"/><path d="M16 44 L26 54" stroke="' + M.gold + '" stroke-width="4"/>',
        sk_chain: '<path d="M20 44 L26 24 L34 40 L40 18" stroke="' + M.gemCyan + '" stroke-width="4" fill="none"/><circle cx="40" cy="16" r="5" fill="#ffffff"/>',
        sk_frenzy: '<path d="M20 12 L44 12 L38 30 L44 52 L20 52 L26 30 Z" fill="#ff8a3c"/><path d="M26 20 H38 M27 44 H37" stroke="#3a1c08" stroke-width="3"/>',
        sk_gravity_well: '<circle cx="32" cy="32" r="12" fill="#3b2a5a"/><circle cx="32" cy="32" r="22" fill="none" stroke="' + M.gemViolet + '" stroke-width="3"/><path d="M32 4 L32 12 M32 52 L32 60 M4 32 L12 32 M52 32 L60 32" stroke="' + M.gemViolet + '" stroke-width="3"/>',
        sk_rain: '<path d="M12 12 C24 24 40 24 52 12" stroke="' + M.wood + '" stroke-width="4" fill="none"/><path d="M22 20 L18 44 M32 22 L32 48 M42 20 L46 44" stroke="#dfe8f5" stroke-width="3"/>',
        sk_pierce_shot: '<path d="M6 32 H46" stroke="#dfe8f5" stroke-width="5"/><path d="M46 24 L60 32 L46 40 Z" fill="' + M.gemCyan + '"/><path d="M6 24 L6 40" stroke="' + M.wood + '" stroke-width="4"/>',
        sk_barrage: '<path d="M14 18 L26 26 M14 32 L26 32 M14 46 L26 38" stroke="' + M.gemCyan + '" stroke-width="3"/><rect x="26" y="20" width="22" height="24" rx="4" fill="' + M.steel + '"/><circle cx="52" cy="32" r="6" fill="' + M.gem + '"/>',
        sk_void_nova: '<circle cx="32" cy="32" r="8" fill="' + M.gemViolet + '"/><circle cx="32" cy="32" r="18" fill="none" stroke="' + M.gemViolet + '" stroke-width="3"/><circle cx="32" cy="32" r="26" fill="none" stroke="' + M.gemViolet + '" stroke-width="1.6" opacity=".6"/>',
        sk_flame_rush: '<path d="M32 6 C40 20 48 26 44 40 A12 12 0 0 1 20 40 C16 26 24 20 32 6 Z" fill="' + M.gem + '"/><path d="M32 20 C36 28 40 32 38 38 A7 7 0 0 1 26 38 C24 32 28 28 32 20 Z" fill="#ffe8c0"/>',
        sk_reap: '<path d="M18 8 C40 12 54 30 52 52" stroke="#dfe8f5" stroke-width="5" fill="none"/><path d="M52 52 L44 48 L50 42 Z" fill="#dfe8f5"/><rect x="14" y="10" width="6" height="44" rx="3" fill="' + M.woodDark + '"/>',
        sk_flame_domain: '<ellipse cx="32" cy="46" rx="26" ry="9" fill="' + M.gem + '" opacity=".35"/><path d="M32 8 C40 22 44 28 40 38 A10 10 0 0 1 24 38 C20 28 24 22 32 8 Z" fill="' + M.gem + '"/>',
        sk_dawn_burst: '<path d="M32 6 L38 26 L58 32 L38 38 L32 58 L26 38 L6 32 L26 26 Z" fill="#ffd88a"/><circle cx="32" cy="32" r="7" fill="#ffffff"/>'
      };
      const key = 's:' + id;
      if (cache[key]) return cache[key];
      const svg = wrap(map[id] || '<circle cx="32" cy="32" r="14" fill="' + M.gem + '"/>', 3);
      cache[key] = svg;
      return svg;
    },
    blank: function () {
      return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="24" height="24" rx="4" fill="none" stroke="#4b5566" stroke-width="2" stroke-dasharray="4 4"/></svg>';
    },
    /** 简易货币图标 */
    coin: function () { return Icons.item({ id: 'i_ember', icon: 'coin', rarity: 2 }); },
    relic: function () { return Icons.item({ id: 'i_relic', icon: 'relic', rarity: 4 }); }
  };

  G.Icons = Icons;
})(window.G = window.G || {});
