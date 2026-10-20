/* =========================================================
   余烬回廊 · 程序化像素精灵（无外部图片资源）
   坐标系：像素格，原点在角色脚底中心，向上为负
   ========================================================= */
(function (G) {
  const U = G.U;

  /* ---------------- 基础绘制原语 ---------------- */
  /* 垂直比例映射（Minecraft 风格：头大、躯干短、腿短）
     只在绘制主角时打开（hero 内部开关），敌人 / 场景道具不受影响。
     做法：把 y 做「分段线性压缩」，各段压缩率不同 —— 头部压缩最少（头相对变大），
           腿部压缩最多（腿变短）。这样所有服饰 / 细节 / 动作的像素坐标都不用改。
     旧分段：头 -75..-54 / 颈 -54..-51 / 躯干 -51..-29 / 腿 -29..0（总高 75）
     新分段：头 -65..-47 / 颈 -47..-45 / 躯干 -45..-19 / 腿 -19..0（总高 65） */
  let VPROP = false;
  const VP_SEG = [
    { o0: -75, o1: -51, n0: -70, n1: -52 },   /* 头颈 24 -> 18（压缩率 0.75，头变方） */
    { o0: -51, o1: -29, n0: -52, n1: -21 },   /* 躯干 22 -> 31（明显放大，blocky） */
    { o0: -29, o1: 0, n0: -21, n1: 0 }        /* 腿 29 -> 21（缩短，脚底对齐 0） */
  ];
  function vmap(y) {
    for (let i = 0; i < VP_SEG.length; i++) {
      const s = VP_SEG[i];
      if (y >= s.o0 && y <= s.o1) {
        const t = s.o1 === s.o0 ? 0 : (y - s.o0) / (s.o1 - s.o0);
        return s.n0 + t * (s.n1 - s.n0);
      }
    }
    if (y < VP_SEG[0].o0) {                 /* 头顶以上：按头段斜率延长 */
      const k = (VP_SEG[0].n1 - VP_SEG[0].n0) / (VP_SEG[0].o1 - VP_SEG[0].o0);
      return VP_SEG[0].n0 + (y - VP_SEG[0].o0) * k;
    }
    return y;                               /* 脚底以下不动 */
  }

  function px(c, x, y, w, h, col) {
    c.fillStyle = col;
    if (VPROP) {
      const t0 = vmap(y), t1 = vmap(y + (h || 1));
      c.fillRect(x | 0, Math.round(t0), Math.max(1, w | 0), Math.max(1, Math.round(t1 - t0)));
      return;
    }
    c.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
  }

  function alpha(c, a, fn) {
    const old = c.globalAlpha;
    c.globalAlpha = a;
    fn();
    c.globalAlpha = old;
  }

  /* 半透明绘制（alpha 的别名，语义更直白） */
  function alphaFn(c, a, fn) {
    const old = c.globalAlpha;
    c.globalAlpha = a;
    fn();
    c.globalAlpha = old;
  }

  function ell(c, x, y, rx, ry, col) {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), 0, 0, Math.PI * 2);
    c.fill();
  }

  /* 默认身体配色（会被外观 look 覆盖） */
  const DEF = {
    skin: '#e0a882', hair: '#2b2320', hairStyle: 'short', eye: '#ff9a3c',
    base: '#2b3446', cloth: '#7a5230', accent: '#ff8a3c'
  };
  /* 武器主色 */
  const WBASE = '#c9d3e0', WDARK = '#6d7684', WACC = '#ff8a3c', WGRIP = '#4a3222';

  const DARK = '#0b0d12';

  /* 全局角色缩放系数：想整体放大 / 缩小角色模型只改这里。
     战斗、大世界、营地、立绘、纸娃娃、头像都乘以它，保证各处比例一致。 */
  const HERO_SCALE = 0.86;

  /* 造型开关默认值：0 / false = 关；外观可用 detail.feat 覆盖 */
  const FEAT = {
    halo: 0,          /* 头顶光环（法师） */
    wideHat: 0,       /* 宽檐帽（游侠） */
    fullHelm: 0,      /* 全罩头盔（骑士） */
    shield: 0,        /* 塔盾（骑士，左手） */
    staff: 0,         /* 法杖（法师，右手） */
    angry: 0,         /* 怒眉（剑士 / 骑士） */
    glowingEyes: 0,   /* 发光眼（法师） */
    pauldron: 1,      /* 肩甲 */
    chestSeam: 1      /* 胸甲分割线 */
  };

  /* 由外观 look 生成完整外观参数（保持向后兼容：老存档只有基础字段时也能画） */
  function resolveLook(o) {
    const src = o || {};
    const L = Object.assign({}, DEF, src);
    const d = src.detail || {};
    const D = Object.assign({
      beard: 0, cape: 0, capeTone: '#5a3a22', capeTrim: '#7a5230',
      strap: '#6b4a2a', strapLight: '#8a6238', hood: false,
      chestTop: '#4a5568', chestTopLight: '#5f6c80', chestPlate: '#4a5568',
      bracers: '#3a4150', bracersLight: '#4b5464',
      belt: '#5a3a22', beltBuckle: '#f6c667', sash: null,
      bottom: '#3a4152', boots: '#3a2420', bootsTrim: '#4d3226',
      thighArmor: '#4a5568', hipWeapon: false, bow: false,
      feat: null
    }, d);
    /* 造型开关合并默认值 */
    const f = Object.assign({}, FEAT, d.feat || {});
    if (!src.detail) { f.pauldron = 0; f.chestSeam = 0; }
    D.feat = f;
    /* 兼容旧字段：老 look 只有 skin/hair/eye/base/cloth/accent */
    if (!src.detail) {
      D.cape = 1;
      D.capeTone = L.accent;
      D.chestTop = L.base;
      D.chestTopLight = L.cloth;
      D.chestPlate = L.base;
      D.bottom = '#3a4152';
      D.belt = '#3a2a1c';
    }
    L.detail = D;
    L.build = L.build === 'broad' ? 'broad' : 'slim';
    return L;
  }

  /* 披风 / 斗篷（在身后） */
  function drawCape(c, L, bob, ph, moving) {
    const D = L.detail;
    if (!D.cape) return;
    const wave = Math.sin(ph * 0.16) * (moving ? 2.4 : 1.1);
    const ct = D.capeTone, ct2 = shade(ct, -.10), ct3 = shade(ct, -.2);
    if (D.cape === 2) {
      /* 宽斗篷：连帽 + 前襟包肩（男角色参考图） */
      px(c, -8, -48 + bob, 16, 10, ct);                      // 兜帽/肩披
      px(c, -9 + wave * .3, -44, 4, 20, ct);                 // 左前襟
      px(c, 5 + wave * .3, -44, 4, 20, ct);                  // 右前襟
      px(c, -9, -28 + bob, 18, 12, ct2);                     // 下摆
      px(c, -8 + wave * .4, -16, 7, 8, ct3);
      px(c, 1 + wave * .4, -16, 7, 8, ct3);
      px(c, -8, -48 + bob, 16, 1, 'rgba(255,255,255,.14)');
      px(c, -8, -38 + bob, 16, 1, 'rgba(0,0,0,.18)');
      px(c, -4, -47 + bob, 8, 2, ct2);                       // 兜帽领口
      px(c, -8, -48 + bob, 3, 9, shade(ct, -.12));           // 肩部褶皱
      px(c, 5, -48 + bob, 3, 9, shade(ct, -.12));
    } else {
      /* 短披风 + 厚领（女角色参考图） */
      px(c, -8, -45 + bob, 16, 8, ct);                       // 肩部厚领
      px(c, -8, -45 + bob, 16, 2, shade(ct, .14));
      px(c, -7, -38 + bob, 3, 13, ct2);                      // 前襟
      px(c, 4, -38 + bob, 3, 13, ct2);
      px(c, -9 + wave * .3, -36, 4, 18, ct2);                // 身后披风
      px(c, 5 + wave * .3, -36, 4, 18, ct2);
      px(c, -8, -22 + bob, 16, 9, ct3);
      px(c, -6 + wave * .4, -13, 6, 6, ct3);
      px(c, 0 + wave * .4, -13, 6, 6, ct3);
      px(c, -1, -43 + bob, 3, 3, D.beltBuckle);              // 领口搭扣
      px(c, -8, -37 + bob, 16, 1, 'rgba(0,0,0,.16)');
    }
  }

  /* 上衣（皮甲 / 胸甲 / 布衣），over 为 true 时表示来自用户装备 */
  /* 上衣（皮甲 / 胸甲 / 布衣），over 为 true 时表示来自用户装备
     躯干：y -45 ~ -31（14 格高），肩宽 slim 10 / broad 12，腰部收窄 */
  function drawChest(c, L, bob, over) {
    const D = L.detail;
    const broad = L.build === 'broad';
    const w = broad ? 12 : 10;
    const y0 = -45 + bob;
    const main = over ? L.base : D.chestTop;
    const hi = over ? shade(L.base, .18) : D.chestTopLight;
    /* 主体 */
    px(c, -w / 2, y0, w, 12, main);
    px(c, -w / 2, y0 + 11, w - 2, 3, main);                // 收腰
    px(c, -5, y0, w, 1, shade(main, .3));
    px(c, -w / 2, y0, 2, 12, shade(main, -.16));           // 左侧轮廓
    px(c, w / 2 - 2, y0, 2, 12, shade(main, -.08));        // 右侧轮廓
    /* 领口 + 胸甲上沿 */
    px(c, -2, y0, 4, 3, shade(main, -.34));
    px(c, -w / 2 + 1, y0 + 3, w - 2, 1, shade(hi, .1));
    /* 胸口浅色甲片 / 内衬 */
    px(c, -w / 2 + 1, y0 + 5, w - 2, 6, shade(main, -.2));
    px(c, -3, y0 + 5, 6, 1, shade(main, .12));
    /* 交叉皮带 */
    c.save();
    c.strokeStyle = over ? shade(L.base, -.4) : D.strap;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-w / 2 + 1, y0 + 2); c.lineTo(w / 2 - 1, y0 + 11);
    c.moveTo(w / 2 - 1, y0 + 2); c.lineTo(-w / 2 + 1, y0 + 11);
    c.stroke();
    c.restore();
    /* 钢质反光点 */
    for (let i = 0; i < 5; i++) {
      const px1 = -w / 2 + 2 + ((i * 5) % (w - 3));
      const py1 = y0 + 2 + (i % 4) * 3;
      px(c, px1, py1, 1, 1, shade(main, .5));
    }
    /* 下摆 */
    px(c, -w / 2 + 1, y0 + 14, w - 2, 3, over ? shade(main, -.2) : D.bottom);
  }

  /* 腰带 + 挂件：y -32 ~ -29 */
  function drawWaist(c, L, bob) {
    const D = L.detail;
    const broad = L.build === 'broad';
    const w = broad ? 12 : 10;
    const y = -32 + bob;
    px(c, -w / 2, y, w, 3, D.belt);
    px(c, -w / 2, y, w, 1, shade(D.belt, .22));
    px(c, -2, y, 5, 3, shade(D.belt, .1));                 // 扣带
    px(c, -1, y, 3, 3, D.beltBuckle);
    px(c, 0, y + 1, 1, 1, shade(D.beltBuckle, .35));
    /* 下摆垂布 */
    px(c, -w / 2 + 1, y + 3, w - 2, 2, shade(D.bottom, -.05));
    if (D.sash) px(c, 2, y + 3, 3, 9, D.sash);
    if (D.hipWeapon) {
      /* 腰间短剑：剑柄在腰带上方，剑刃沿大腿垂下 */
      px(c, -6, y - 3, 4, 3, '#8a949f');                   // 剑柄
      px(c, -6, y - 4, 4, 1, D.beltBuckle);                // 柄头
      px(c, -5, y, 2, 9, '#c9d3e0');                       // 剑刃
      px(c, -5, y + 9, 2, 2, '#e8eef8');
    }
  }

  /* 腿 + 靴子：髋 -29 → 脚底 0（大腿 9 / 小腿 7 / 靴 6） */
  function drawLower(c, L, ph, moving, overTone) {
    const D = L.detail;
    const broad = L.build === 'broad';
    const lw = broad ? 4 : 3;
    const swing = moving ? Math.sin(ph * 0.34) * 2.0 : 0;
    const hip = -29;
    const bottom = overTone || D.bottom;
    const l1 = Math.round(-2 - swing), l2 = Math.round(1 - swing * -1);
    function leg(x, thighTone, shinTone) {
      px(c, x - lw / 2, hip, lw, 9, thighTone);                  // 大腿
      if (D.thighArmor) {                                        // 大腿甲片
        px(c, x - lw / 2, hip + 5, lw, 4, D.thighArmor);
        px(c, x - lw / 2, hip + 6, lw, 1, shade(D.thighArmor, .24));
      }
      px(c, x - lw / 2, hip + 9, lw + 1, 5, shinTone);            // 小腿
      px(c, x - lw / 2, hip + 14, lw + 1, 2, D.bootsTrim);        // 靴筒口
      px(c, x - lw / 2 - 1, hip + 16, lw + 2, 5, D.boots);        // 靴子
      px(c, x - lw / 2 - 1, hip + 21, lw + 3, 1, '#171b24');      // 鞋底
    }
    leg(l1, bottom, shade(bottom, -.1));
    leg(l2, shade(bottom, -.12), shade(bottom, -.22));
  }

  /* 背部弓（男角色参考图里背着的弓） */
  function drawBackBow(c, L, bob) {
    if (!L.detail.bow) return;
    c.save();
    c.strokeStyle = '#6b4526';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(-6, -32 + bob);
    c.quadraticCurveTo(-12, -46 + bob, -5, -61 + bob);
    c.stroke();
    c.strokeStyle = 'rgba(232,238,248,.7)';
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(-6, -32 + bob);
    c.lineTo(-5, -61 + bob);
    c.stroke();
    c.restore();
  }

  /* 头发：头在 y -58 ~ -45 */
  function drawHair(c, L, hb) {
    const st = L.hairStyle;
    const hair = L.hair;
    const dk = shade(hair, -.12), lt = shade(hair, .18);
    if (st === 'bun') {
      /* 发髻：紧贴头顶（颅顶 -67，髻自 -66.6 向上） */
      px(c, -5, -67.6 + hb, 10, 4, hair);               // 发髻主体
      px(c, -6, -66.6 + hb, 12, 2, hair);               // 发髻底缘（略宽，坐实头顶）
      px(c, -4, -71.0 + hb, 8, 4, hair);                // 发髻上半
      px(c, -3, -72.4 + hb, 6, 2, hair);                // 髻顶
      px(c, -3, -72.2 + hb, 5, 1, lt);                  // 髻顶高光
      px(c, -4, -70.4 + hb, 6, 1, lt);                  // 发髻中段高光
      px(c, -6, -66.8 + hb, 12, 1, lt);                 // 底缘高光
      px(c, -6.4, -67.4 + hb, 1, 4, dk);                // 左右暗边
      px(c, 5.4, -67.4 + hb, 1, 4, dk);
      px(c, -4.4, -71.2 + hb, 1, 4, dk);
      px(c, 3.4, -71.2 + hb, 1, 4, dk);
      px(c, -1, -69.6 + hb, 2, 1, dk);                  // 束发处
      /* 头盖 + 削短的两侧 */
      px(c, -5, -67.2 + hb, 10, 4, hair);
      px(c, -5, -66.0 + hb, 10, 1, lt);
      px(c, -4.6, -64.0 + hb, 1, 7, dk);
      px(c, 3.6, -64.0 + hb, 1, 7, dk);
      px(c, -1, -68.6 + hb, 2, 2, dk);
      /* 短鬓角（只到眼侧，不遮脸） */
      px(c, -4.4, -62.5 + hb, 1.4, 4, hair);
      px(c, 3.0, -62.5 + hb, 1.4, 4, hair);
    } else if (st === 'bob') {
      /* 波波头：颅顶 -68，两侧发帘落在脸外侧（脸占 -4~4，发在 -5.6~-4 / 4~5.6） */
      px(c, -5.2, -68.0 + hb, 10.4, 4, hair);           // 颅顶
      px(c, -5.6, -64.6 + hb, 1.8, 18, hair);           // 左侧发帘
      px(c, 3.8, -64.6 + hb, 1.8, 18, hair);            // 右侧发帘
      px(c, -5.4, -48 + hb, 1.8, 2.4, dk);              // 发尾分叉
      px(c, 3.6, -48 + hb, 1.8, 2.4, dk);
      px(c, -5.2, -68.0 + hb, 10.4, 1, lt);             // 颅顶高光
      px(c, -3.4, -67 + hb, 6.4, 2.2, lt);              // 侧分刘海
      px(c, -1.0, -66.6 + hb, 1.2, 3.4, dk);            // 刘海分缝
      px(c, 4.4, -63 + hb, 0.8, 6, lt);                 // 右鬓角浅色
      px(c, -5.6, -56 + hb, 0.8, 6, shade(hair, .16));  // 左侧发高光
    } else if (st === 'long') {
      /* 长发：颅顶 + 两侧发帘（发帘落在脸外侧），发梢垂到胸侧并外扩 */
      px(c, -5.2, -68.0 + hb, 10.4, 4, hair);
      px(c, -6.0, -64.6 + hb, 2.0, 22, hair);            // 左侧发（垂到胸侧）
      px(c, 4.0, -64.6 + hb, 2.0, 22, hair);             // 右侧发
      px(c, -6.6, -45 + hb, 3.0, 4.0, shade(hair, -.1)); // 发梢外扩
      px(c, 3.6, -45 + hb, 3.0, 4.0, shade(hair, -.1));
      px(c, -5.2, -68.0 + hb, 10.4, 1, lt);              // 顶部高光
      px(c, -4.2, -67 + hb, 6.4, 2.2, lt);               // 刘海分缝
      px(c, 4.2, -62 + hb, 0.8, 10, shade(hair, .12));   // 右侧发高光
      px(c, -6.0, -58 + hb, 0.8, 10, shade(hair, .16));
    } else {
      /* 短发：颅顶 + 短鬓角，露出整张脸 */
      px(c, -5.2, -68.0 + hb, 10.4, 4, hair);
      px(c, -5.2, -64.6 + hb, 1.4, 3.4, hair);
      px(c, 3.8, -64.6 + hb, 1.4, 3.4, hair);
      px(c, -5.2, -68.0 + hb, 10.4, 1, lt);
      px(c, -3.0, -67 + hb, 6.0, 1.6, lt);
    }
  }

  /* 脸（清晰五官版）：脸区约 9 宽 × 14 高（y -66 ~ -52）
     眉 -63.5 / 眼 -62.5~-58.5 / 鼻 -57.5~-54.5 / 嘴 -53.5 / 下巴 -52 */
  function drawFace(c, L, hb) {
    const D = L.detail;
    const skin = L.skin;
    const skinHi = shade(skin, .12);
    const skinSh = shade(skin, -.16);
    const brow = shade(L.hair, -.3);

    /* —— 眉毛：外端略挑，位于眼上方 2 单位 —— */
    const browY = -63.2 + hb;
    px(c, -3.8, browY, 3.8, 1.3, brow);
    px(c, 0.0, browY, 3.8, 1.3, brow);
    px(c, -3.8, browY, 1.3, 0.6, shade(brow, .2));         // 眉峰高光
    px(c, 0.0, browY, 1.3, 0.6, shade(brow, .2));
    px(c, -4.0, browY + 1.4, 4.0, 0.5, 'rgba(0,0,0,.10)'); // 眉下阴影

    /* —— 眼睛：杏仁形（眼线 3.0×2.6 + 眼白 2.4×2.0 + 瞳孔 1.4×1.6 + 高光）—— */
    const eyeY = -61.8 + hb;
    const lid = shade(L.hair, -.55);
    px(c, -3.6, eyeY, 3.0, 2.6, lid);                      // 左眼眶 / 眼线
    px(c, 0.6, eyeY, 3.0, 2.6, lid);                       // 右眼眶
    px(c, -3.3, eyeY + 0.4, 2.4, 1.9, '#d6ccbe');          // 左眼白
    px(c, 0.9, eyeY + 0.4, 2.4, 1.9, '#d6ccbe');           // 右眼白
    px(c, -2.9, eyeY + 0.5, 1.4, 1.6, '#1a120e');          // 左瞳孔底色
    px(c, 1.5, eyeY + 0.5, 1.4, 1.6, '#1a120e');           // 右瞳孔底色
    px(c, -2.8, eyeY + 0.6, 1.0, 1.1, L.eye);              // 左瞳色
    px(c, 1.6, eyeY + 0.6, 1.0, 1.1, L.eye);               // 右瞳色
    px(c, -2.8, eyeY + 0.6, 0.6, 0.6, '#ffffff');          // 左瞳高光
    px(c, 1.6, eyeY + 0.6, 0.6, 0.6, '#ffffff');           // 右瞳高光
    px(c, -3.6, eyeY + 2.5, 3.0, 0.6, skinSh);             // 眼下阴影
    px(c, 0.6, eyeY + 2.5, 3.0, 0.6, skinSh);

    /* —— 鼻：只留鼻梁高光 + 鼻头影子，避免一堆色块 —— */
    px(c, -0.5, -58.6 + hb, 1.0, 3.0, shade(skin, .14));   // 鼻梁
    px(c, -1.0, -55.8 + hb, 2.0, 1.4, shade(skin, .2));    // 鼻头
    px(c, -1.0, -54.5 + hb, 2.0, 0.6, skinSh);             // 鼻底阴影

    /* —— 嘴：唇缝 + 下唇，位置下移让下巴有空间 —— */
    px(c, -1.7, -53.0 + hb, 3.4, 0.7, shade(skin, -.36));  // 唇缝
    px(c, -1.3, -52.3 + hb, 2.6, 0.9, '#bd6a58');          // 下唇
    px(c, -1.0, -52.9 + hb, 2.0, 0.35, shade(skin, .12));  // 上唇

    /* —— 面颊：腮红 + 下巴高光 —— */
    if (!D.beard) {
      px(c, -3.9, -56.6 + hb, 1.6, 1.4, 'rgba(210,116,100,.26)');
      px(c, 2.3, -56.6 + hb, 1.6, 1.4, 'rgba(210,116,100,.22)');
      px(c, -1.2, -51.4 + hb, 2.4, 0.8, shade(skin, .18)); // 下巴高光
    }

    /* —— 胡须（男性）：络腮沿脸侧下垂到下巴，中间完整留出鼻与嘴 —— */
    if (D.beard) {
      const bd = D.beardTone || L.hair;
      const bdHi = shade(bd, .16), bdDk = shade(bd, -.2);
      /* 左侧络腮：贴着脸左缘，从眼下一直包到下巴 */
      px(c, -4.4, -60.0 + hb, 1.6, 9.0, bd);
      px(c, -4.4, -60.0 + hb, 0.7, 9.0, bdHi);             // 外侧微亮
      px(c, -2.8, -56.0 + hb, 1.0, 5.0, bd);               // 向内收拢
      /* 右侧络腮 */
      px(c, 2.8, -60.0 + hb, 1.6, 9.0, bd);
      px(c, 3.7, -60.0 + hb, 0.7, 9.0, bdHi);
      px(c, 1.8, -56.0 + hb, 1.0, 5.0, bd);
      /* 下巴胡：横跨下颌，上缘留出唇部空间 */
      px(c, -3.4, -52.0 + hb, 6.8, 2.0, bd);
      px(c, -2.6, -50.4 + hb, 5.2, 1.0, bdDk);
      /* 八字须：唇上两侧，中间断开 */
      px(c, -3.0, -55.0 + hb, 1.8, 0.9, bdHi);
      px(c, 1.2, -55.0 + hb, 1.8, 0.9, bdHi);
      /* 山羊胡：下巴正中向下 */
      px(c, -1.3, -50.6 + hb, 2.6, 3.0, bd);
      px(c, -0.9, -48.0 + hb, 1.8, 1.2, bdDk);
    }
  }

  /* =========================================================
     细节层：在不改变轮廓与配色的前提下，叠加边光 / 甲片分割 / 铆钉 /
     缝线 / 靴扣 / 布料褶皱 / 发丝高光等，让模型更精美。
     在武器之后绘制，保证装饰一定可见。
     ========================================================= */
  function drawDetails(c, L, o, bob, moving, ph) {
    const D = L.detail;
    const broad = L.build === 'broad';
    const w = broad ? 12 : 10;
    const lw = broad ? 4 : 3;

    /* 光照方向：未翻转时光从左上打来 */
    const flip = !!o.flip;
    const lightSide = flip ? w / 2 - 1 : -w / 2;          /* 迎光侧 x */
    const darkSide = flip ? -w / 2 : w / 2 - 1;           /* 背光侧 x */
    const EDGE_L = 'rgba(255,255,255,.20)';               /* 边光 */
    const EDGE_D = 'rgba(0,0,0,.22)';                     /* 轮廓暗边 */
    const SEAM = 'rgba(0,0,0,.16)';                       /* 缝线 */

    /* ---------- 披风 / 斗篷 ---------- */
    if (D.cape === 1) {
      /* 短披风的领口细节：双排缝线 + 搭扣高光 + 内衬暗边 */
      px(c, -8, -44.4 + bob, 16, 1, SEAM);
      px(c, -7, -43.2 + bob, 14, 1, SEAM);
      px(c, -2.0, -44.2 + bob, 4, 1, shade(D.beltBuckle, .3));
      px(c, -1.0, -43.0 + bob, 2, 1, shade(D.beltBuckle, .45));
      px(c, -8, -38.0 + bob, 1, 6, EDGE_D);
      px(c, 7, -38.0 + bob, 1, 6, EDGE_D);
      px(c, -8 + (flip ? 0 : 0), -22 + bob, 16, 1, EDGE_D);
    } else if (D.cape === 2) {
      /* 宽斗篷：帽檐加厚 + 拉绳 + 下摆双道褶皱 */
      px(c, -9, -49.2 + bob, 18, 1, shade(D.capeTone, .22));
      px(c, -8, -47.6 + bob, 16, 1, SEAM);
      px(c, -2.0, -45.0 + bob, 1, 5, shade(D.capeTone, .3));
      px(c, 1.0, -45.0 + bob, 1, 5, shade(D.capeTone, .3));
      px(c, -8, -32 + bob, 16, 1, SEAM);
      px(c, -8, -24 + bob, 16, 1, SEAM);
      px(c, -9, -44, 1, 16, EDGE_D);
      px(c, 8, -44, 1, 16, EDGE_D);
    } else if (D.cloakTone) {
      /* 装备披风时的布料褶皱与内衬暗边 */
      px(c, -8, -39 + bob, 16, 1, SEAM);
      px(c, -8, -30 + bob, 16, 1, SEAM);
    }

    /* ---------- 躯干：甲片分割 / 边光 / 铆钉 ---------- */
    const y0 = -45 + bob;
    if (!o.equip || !o.equip.body) {
      /* 胸甲上沿金线 */
      px(c, -w / 2 + 1, y0 + 3, w - 2, 1, 'rgba(246,198,103,.32)');
      /* 左侧边光 + 右侧暗边（体积感） */
      px(c, lightSide, y0 + 1, 1, 10, EDGE_L);
      px(c, darkSide, y0 + 1, 1, 10, EDGE_D);
      /* 甲片竖向分割线 */
      px(c, -1, y0 + 4, 1, 6, SEAM);
      /* 胸口铆钉 3 颗 */
      px(c, -w / 2 + 2, y0 + 4, 1, 1, shade(D.chestTopLight, .45));
      px(c, -w / 2 + 2, y0 + 9, 1, 1, shade(D.chestTopLight, .45));
      px(c, w / 2 - 3, y0 + 4, 1, 1, shade(D.chestTopLight, .3));
      /* 收腰处的束带 */
      px(c, -w / 2 + 2, y0 + 11, w - 4, 1, shade(D.strap, .1));
    }

    /* ---------- 肩甲：外缘高光 + 双层甲片线 ---------- */
    const shoulder = broad ? 3.4 : 3.2;
    px(c, -shoulder, y0 + 1, 1, 4, EDGE_L);
    px(c, shoulder - 1, y0 + 1, 1, 4, EDGE_D);
    px(c, -shoulder, y0 + 4, shoulder * 2, 1, SEAM);

    /* ---------- 手臂护腕：束带 + 边光 ---------- */
    const axB = broad ? -7 : -6;
    const ayB = -43 + bob;
    px(c, axB, ayB + 7, 3, 1, SEAM);
    px(c, axB + 2, ayB + 1, 1, 8, EDGE_L);
    const ax = broad ? 4 : 4;
    const ay = -44 + bob;
    px(c, ax, ay + 5, 4, 1, SEAM);
    px(c, ax + 3, ay + 1, 1, 9, EDGE_L);
    px(c, ax, ay + 12, 4, 1, shade(L.skin, -.18));        /* 手腕阴影 */

    /* ---------- 腰带：铆钉 + 侧挂袋 + 束带 ---------- */
    const by = -32 + bob;
    px(c, -w / 2 + 1, by + 1, 1, 1, shade(D.beltBuckle, .1));
    px(c, w / 2 - 2, by + 1, 1, 1, shade(D.beltBuckle, .1));
    px(c, -w / 2, by + 2, w, 1, EDGE_D);
    /* 右侧皮袋（两条吊带 + 袋盖） */
    px(c, w / 2 - 4, by + 3, 4, 5, shade(D.belt, -.12));
    px(c, w / 2 - 4, by + 3, 4, 1, shade(D.belt, .18));
    px(c, w / 2 - 3, by + 2, 2, 1, shade(D.beltBuckle, -.05));
    px(c, w / 2 - 4, by + 5, 4, 1, 'rgba(0,0,0,.22)');
    /* 左侧挂环 */
    px(c, -w / 2 + 1, by + 3, 2, 3, shade(D.belt, -.18));
    px(c, -w / 2 + 1, by + 3, 2, 1, shade(D.beltBuckle, -.1));

    /* ---------- 腿：腿甲分割 / 膝盖高光 / 靴扣 ---------- */
    const hip = -29;
    [Math.round(-2 - (moving ? Math.sin(ph * 0.34) * 2 : 0)),
     Math.round(-1 + (moving ? Math.sin(ph * 0.34) * 2 : 0))].forEach(function (lx, i) {
      const x = lx - lw / 2;
      /* 大腿外侧边光 */
      px(c, x + (i ? lw - 1 : 0), hip + 1, 1, 8, i ? EDGE_D : EDGE_L);
      if (D.thighArmor) {
        px(c, x, hip + 4, lw, 1, shade(D.thighArmor, .3));       /* 甲片顶边 */
        px(c, x, hip + 8, lw, 1, 'rgba(0,0,0,.2)');              /* 甲片底边 */
        px(c, x + lw - 1, hip + 5, 1, 3, EDGE_L);                /* 甲片高光 */
      }
      /* 小腿束带 */
      px(c, x, hip + 11, lw, 1, 'rgba(0,0,0,.18)');
      /* 靴子：筒口双线 + 扣带 + 鞋底高光 */
      px(c, x - 0.5, hip + 13, lw + 1, 1, shade(D.bootsTrim, .25));
      px(c, x - 0.5, hip + 15, lw + 1, 1, 'rgba(0,0,0,.25)');
      px(c, x + lw - 0.5, hip + 16, 1, 4, EDGE_L);
      px(c, x - 0.5, hip + 16, lw + 1, 1, shade(D.beltBuckle, -.05));  /* 靴扣 */
      px(c, x - 1, hip + 20, lw + 2, 1, 'rgba(255,255,255,.08)');
    });

    /* ---------- 头发：高光带 + 发丝 + 发梢分叉 ---------- */
    const hair = L.hair;
    if (L.hairStyle === 'bob') {
      px(c, -4.6, -67.4 + bob, 9, 1, shade(hair, .34));        /* 颅顶高光带 */
      px(c, -5.2, -66 + bob, 3, 1, shade(hair, .28));
      px(c, -5.4, -62 + bob, 0.9, 12, shade(hair, .26));       /* 左发帘高光 */
      px(c, 4.6, -62 + bob, 0.9, 12, shade(hair, -.12));       /* 右发帘暗边 */
      px(c, -3.4, -65.6 + bob, 2.4, 1, shade(hair, .3));       /* 刘海高光 */
      px(c, -5.4, -49 + bob, 1.6, 1.6, shade(hair, -.22));     /* 发梢分叉 */
      px(c, 3.8, -49 + bob, 1.6, 1.6, shade(hair, -.22));
    } else if (L.hairStyle === 'bun') {
      /* 发髻高光（坐标必须与 drawHair 的 bun 分支一致：髻顶 -64.4，髻底 -58.6） */
      px(c, -3, -72.3 + bob, 5, 1, shade(hair, .34));          /* 髻顶高光 */
      px(c, -4, -70.5 + bob, 6, 1, shade(hair, .24));          /* 髻中高光 */
      px(c, -5, -67.0 + bob, 10, 1, shade(hair, .28));         /* 髻底高光 */
      px(c, -1, -69.6 + bob, 2, 1, shade(hair, -.22));         /* 束发处 */
      px(c, -4, -66.1 + bob, 8, 1, shade(hair, .26));          /* 发顶高光 */
      px(c, -4.6, -64 + bob, 0.9, 7, shade(hair, .14));        /* 侧发高光 */
      px(c, 4.4, -64 + bob, 0.9, 7, shade(hair, -.16));
    } else if (L.hairStyle === 'long') {
      /* 长发高光（坐标与 drawHair 的 long 分支一致） */
      px(c, -4.2, -67.4 + bob, 8, 1, shade(hair, .3));
      px(c, -5.8, -62 + bob, 0.9, 12, shade(hair, .24));
      px(c, 4.8, -62 + bob, 0.9, 12, shade(hair, -.12));
      px(c, -4.2, -65.6 + bob, 2.4, 1, shade(hair, .3));
    } else {
      px(c, -4, -59 + bob, 7, 1, shade(hair, .3));
      px(c, -2, -56 + bob, 1, 8, shade(hair, .12));
      px(c, 1, -55 + bob, 1, 7, shade(hair, -.08));
    }

    /* ---------- 面部：颊部提亮 + 下颌收边 ---------- */
    px(c, -3.6, -51.0 + bob, 1, 3, shade(L.skin, .12));
    px(c, 2.6, -51.0 + bob, 1, 3, shade(L.skin, -.06));
    px(c, -4, -46.4 + bob, 8, 1, shade(L.skin, -.14));

    /* ---------- 女性版服饰：露腰 / 束胸 / 短裙 / 大腿靴 ---------- */
    drawFemaleFit(c, L, bob, moving, ph);

    /* ---------- 武器：剑身中线 + 剑尖亮点（跟随武器真实变换） ---------- */
    if (o.weapon) {
      const wq = o.weapon;
      c.save();
      c.translate(wq.hx, wq.hy);
      c.rotate(wq.rot);
      px(c, 0, 3, 1, 22, 'rgba(255,255,255,.35)');
      px(c, -0.5, 26, 1, 2, 'rgba(255,255,255,.6)');
      c.restore();
    }
  }

  /* =========================================================
     Godot 体素 3D 精灵图（assets/hero）
     - 每个角色 8 个朝向（每 45°）× 12 个动作姿态
     - 动作由游戏状态自动选择（待机 / 走路 / 奔跑 / 三段普攻 / 技能 / 受击 / 下蹲）
     - 图片按需懒加载；未加载完成时返回 false，走程序化回退
     - 朝向由 o.aim（世界弧度）决定，背视由 o.backView 强制
     ========================================================= */
  /* 精灵图目录：默认用 assets/hero/（旧版）。
     精细版在 assets/hero-fine/，把 URL 加上 ?style=fine 即可切换对比。 */
  let SHEET_DIR = 'assets/hero/';
  const SHEET_IDS = ['lk_a', 'lk_b', 'lk_c', 'lk_d', 'lk_a_f', 'lk_b_f', 'lk_c_f', 'lk_d_f'];
  /* 精细版的图内角色占比不同（144/192 而不是 100/128），缩放系数要跟着改 */
  let SHEET_FIT = 1.28;
  let SHEET_STYLE = 'old';
  try {
    if (typeof location !== 'undefined' && /[?&]style=fine/.test(location.search)) {
      SHEET_DIR = 'assets/hero-fine/';
      SHEET_FIT = 1.34;                 /* 192/144 ≈ 1.33 */
      SHEET_STYLE = 'fine';
    }
  } catch (e) { /* 无 location 时用默认 */ }
  /* 动画片段：帧数由 Godot 渲染脚本的 ANIM_ORDER 决定
     （idle 2 / walk 8 / run 8 / atk1-3 各 3 / skill 4 / hurt 1 / crouch 1 = 33 帧） */
  const SHEET_CLIPS = {
    idle: 2, walk: 8, run: 8, atk1: 3, atk2: 3, atk3: 3, skill: 4, hurt: 1, crouch: 1
  };
  /* 各动画的播放帧率（帧/秒）。60 FPS 渲染下按时间循环取帧 */
  const SHEET_FPS = {
    idle: 1.6, walk: 10, run: 14, atk1: 26, atk2: 26, atk3: 26, skill: 12, hurt: 8, crouch: 4
  };
  const SHEET_CACHE = {};              /* id -> 已加载的 Image[]（按需 push） */
  let SHEET_ENABLED = true;            /* 资源缺失时自动关闭，避免反复尝试 */
  let SHEET_CLOCK = 0;                 /* 动画时钟（秒），由绘制调用推进 */

  function sheetDirFromAim(aim, backView) {
    /* 屏幕坐标：+x 向右，+y 向下。精灵图 d0 = 面向镜头（+z 靠近），
       d2 = 面朝右，d4 = 背对镜头，d6 = 面朝左。 */
    if (backView) return 4;
    let a = aim;
    if (a == null || !isFinite(a)) a = 0;
    /* 每 45° 一档：0 → d2（朝右），π → d6（朝左），-π/2 → d4（背），π/2 → d0（正） */
    const step = Math.round((a + Math.PI / 2) / (Math.PI / 4));
    const map = [2, 1, 0, 7, 4, 5, 6, 3];
    return map[((step % 8) + 8) % 8];
  }

  /**
   * 由游戏状态挑选动画片段
   * @returns {string} 片段名（idle / walk / run / atk1..3 / skill / hurt / crouch）
   */
  function sheetPickClip(o) {
    const act = o.action || 'idle';
    if (act === 'hurt') return 'hurt';
    if (act === 'crouch') return 'crouch';
    if (act === 'attack') {
      const step = o.comboStep || 1;
      if (step >= 3) return 'atk3';
      if (step === 2) return 'atk2';
      return 'atk1';
    }
    if (act === 'cast' || act === 'skill') return 'skill';
    if (act === 'run') return 'run';
    if (o.moving) return 'walk';
    return 'idle';
  }

  /**
   * 计算当前应显示的帧号
   * - run / walk：由 ph 直接映射（与移动速度同步，脚不会打滑）
   * - 其它：按时间 × 片段帧率循环
   */
  function sheetFrameOf(clip, o) {
    const n = SHEET_CLIPS[clip] || 1;
    if (n <= 1) return 0;
    if (clip === 'walk') return ((Math.floor((o.ph || 0) / 3) % n) + n) % n;
    if (clip === 'run') return ((Math.floor((o.ph || 0) / 2) % n) + n) % n;
    if (clip === 'idle') return Math.floor(SHEET_CLOCK * SHEET_FPS.idle) % n;
    /* 攻击 / 技能：按 atkT 或 castT 的进度取帧，动作不会拖尾 */
    if (clip.charAt(0) === 'a' && clip.charAt(1) === 't') {
      const p = U.clamp(o.atkT == null ? 0.4 : o.atkT, 0, 1);
      return Math.min(n - 1, Math.floor(p * n));
    }
    if (clip === 'skill') {
      const p = U.clamp(o.castT == null ? 0.4 : o.castT, 0, 1);
      return Math.min(n - 1, Math.floor(p * n));
    }
    return Math.floor(SHEET_CLOCK * (SHEET_FPS[clip] || 8)) % n;
  }

  function sheetKey(id, clip, dir, frame) {
    return id + '|' + clip + '|' + (dir % 8) + '|' + frame;
  }

  function sheetImg(id, clip, dir, frame) {
    const c = SHEET_CACHE[id];
    if (!c) return null;
    return c[sheetKey(id, clip, dir, frame)] || null;
  }

  /* 按需加载单张帧（首次请求时发起，之后命中缓存） */
  function sheetNeed(id, clip, dir, frame) {
    const c = SHEET_CACHE[id];
    if (!c || !SHEET_ENABLED) return;
    const k = sheetKey(id, clip, dir, frame);
    if (c[k] === undefined) {
      c[k] = null;
      const img = new Image();
      img.onload = function () { c[k] = img; };
      img.onerror = function () {
        c[k] = null;
        if (clip === 'idle' && frame === 0) SHEET_ENABLED = false;
      };
      img.src = SHEET_DIR + id + '_d' + (dir % 8) + '_' + clip + '_' + (frame < 10 ? '0' + frame : frame) + '.png';
    }
  }

  /* 预取：待机 + 走路（最常用的两组，进入界面就加载） */
  function sheetPreload(id) {
    if (!SHEET_CACHE[id]) SHEET_CACHE[id] = {};
    for (let d = 0; d < 8; d++) {
      for (let f = 0; f < SHEET_CLIPS.idle; f++) sheetNeed(id, 'idle', d, f);
      for (let f = 0; f < SHEET_CLIPS.walk; f++) sheetNeed(id, 'walk', d, f);
    }
  }

  /* 尝试用烘焙精灵图绘制；成功返回 true */
  function heroSheet(c, o) {
    const look = o.look || {};
    const id = look.id;
    if (!id || SHEET_IDS.indexOf(id) < 0) return false;
    if (!SHEET_CACHE[id]) sheetPreload(id);

    /* 推进动画时钟（按绘制调用间隔估算，60fps 下每帧约 16.7ms） */
    SHEET_CLOCK += 1 / 60;

    let dir = sheetDirFromAim(o.aim, o.backView);
    if (o.flip && !o.backView) dir = 8 - (dir % 8);       /* 镜像朝向（保留翻转语义） */
    const clip = sheetPickClip(o);
    const frame = sheetFrameOf(clip, o);

    let img = sheetImg(id, clip, dir, frame);
    /* 目标帧还没加载完时：先借待机帧，再退到程序化绘制 */
    if (!img) {
      sheetNeed(id, clip, dir, frame);
      img = sheetImg(id, 'idle', dir, 0);
      if (!img) { sheetNeed(id, 'idle', dir, 0); return false; }
    }

    /* 取景：让精灵图的显示高度与像素小人一致 —— 像素小人高 62 单位，
       而图内角色约占 100/128，所以整图高度 = s × HERO_SCALE × 62 × (128/100) */
    const sBase = (o.s || 3) * HERO_SCALE * ((o.look && o.look.height) || 1) * (o.fit || 1);
    const H = sBase * 62 * SHEET_FIT;
    const W = H * (img.width / img.height);
    const footRatio = 0.953;                               /* 图内脚底在 122/128 */
    const cx = o.x, cy = o.y;

    c.save();
    if (o.alpha != null) c.globalAlpha = o.alpha;
    c.imageSmoothingEnabled = false;
    /* 走路 / 攻击时加一点上下起伏与倾斜，弥补只有待机帧 */
    let bobY = 0, tilt = 0, sx = 1;
    if (o.moving) bobY = -Math.abs(Math.sin((o.ph || 0) * 0.34)) * H * 0.022;
    if (o.action === 'attack') {
      const p = U.clamp(o.atkT == null ? 0.4 : o.atkT, 0, 1);
      tilt = (o.flip ? -1 : 1) * (0.10 - Math.abs(p - 0.5) * 0.2);
      sx = 1 + Math.sin(p * Math.PI) * 0.05;
    } else if (o.action === 'hurt') {
      tilt = (o.flip ? 1 : -1) * 0.09;
    } else if (o.action === 'crouch') {
      bobY = H * 0.16;
    }
    c.translate(cx, cy + bobY);
    if (tilt) c.rotate(tilt);
    if (sx !== 1) c.scale(sx, 1);
    c.drawImage(img, -W / 2, -H * footRatio, W, H);
    c.restore();
    return true;
  }

  /* ---------------- 主角 ---------------- */
  /**
   * @param {CanvasRenderingContext2D} c
   * @param {object} o { x, y, s, ph, moving, action, atkT, aim, look, equip, wtype, reach, flip, alpha }
   */
  function hero(c, o) {
    /* =========================================================
       优先使用 Godot 烘焙的体素 3D 精灵图（8 朝向 × 2 待机帧）
       资源：assets/hero/<角色id>_d<朝向0-7>_f<帧0-1>.png
       找不到图（或图还没加载完）时，自动回退到下面的程序化像素小人。
       ========================================================= */
    if (heroSheet(c, o)) return;
    /* 统一乘以全局角色缩放，改 HERO_SCALE 即可整体放大/缩小角色。
       look.height 用于体型修正（女性预设 1.08，更接近参考图的高挑比例） */
    const hMul = (o.look && o.look.height) || 1;
    const s = (o.s || 3) * HERO_SCALE * hMul, x = o.x, y = o.y;
    VPROP = true;                     /* 主角启用垂直比例映射（Minecraft 风格比例） */
    const L = resolveLook(o.look);
    const D = L.detail;
    const ph = o.ph || 0;
    const moving = !!o.moving;
    const action = o.action || 'idle';
    const eq = o.equip || {};
    const cloth = eq.body, legs = eq.legs, cloak = eq.cloak, hat = eq.head;
    const broad = L.build === 'broad';
    const w = broad ? 12 : 10;
    const chest = broad ? 15 : 13;
    const overChest = !!cloth;
    const overLegs = !!legs;
    /* 视图（旋转动画用）：o.view 0=正面 / 1=背面；o.squashX 横向压缩模拟转身 */
    const backView = !!o.backView;
    const squashX = o.squashX == null ? 1 : Math.max(0.06, o.squashX);

    c.save();
    c.translate(x, y);
    c.scale(s * squashX, s);
    if (o.flip) c.scale(-1, 1);
    /* 下蹲 / 滑铲：整体下压（碰撞盒同步减半）；空中攻击：轻微前倾 */
    if (action === 'crouch') {
      c.translate(1.5, 15);
      c.scale(1, 0.72);
    } else if (o.airAtk) {
      c.rotate(-0.06);
    }
    if (o.alpha != null) c.globalAlpha = o.alpha;

    const bob = moving ? Math.round(Math.abs(Math.sin(ph * 0.22)) * -1) : Math.round(Math.sin(ph * 0.05) * 0.6);
    const hurtTilt = action === 'hurt' ? 1 : 0;
    const armSw = moving ? Math.sin(ph * 0.34) * 2 : 0;
    const crouch = action === 'crouch';
    /* 下蹲滑动时身后拖出残影 */
    if (crouch && moving) {
      px(c, -14, -14, 5, 12, 'rgba(200,210,225,.18)');
      px(c, -19, -11, 4, 9, 'rgba(200,210,225,.10)');
    }

    /* 1. 披风 / 斗篷 —— 站姿时先画在身后摆动的下摆 */
    c.save();
    c.translate(hurtTilt, 0);
    if (cloak) {
      const ct = (cloak.look && cloak.look.tone) || D.capeTone;
      const wave = Math.sin(ph * 0.16) * (moving ? 2.4 : 1.1);
      px(c, -8, -40 + bob, 16, 10, shade(ct, -.14));
      px(c, -9 + wave * .4, -34, 3, 16, shade(ct, -.08));
      px(c, -8, -26 + bob, 16, 10, shade(ct, -.2));
      px(c, -7 + wave * .3, -16, 7, 8, shade(ct, -.26));
      px(c, 0 + wave * .3, -16, 7, 8, shade(ct, -.3));
    } else {
      drawCape(c, L, bob, ph, moving);
    }
    c.restore();

    /* 1.5 塔盾（骑士，左手持，画在身体之前作为背景层） */
    if ((D.feat || {}).shield) drawShield(c, L, bob);

    /* 2. 背弓 */
    drawBackBow(c, L, bob);

    /* 3. 后手臂（垂在身侧） */
    const axB = broad ? -7 : -6;
    px(c, axB, -43 + bob - armSw * .4, 3, 9, overChest ? shade(L.base, -.14) : D.bracers);
    px(c, axB, -34 + bob - armSw * .4, 3, 6, overChest ? shade(L.base, -.16) : shade(D.bracers, -.08));
    px(c, axB, -28 + bob - armSw * .4, 3, 3, L.skin);

    /* 4. 腿 + 靴子 */
    drawLower(c, L, ph, moving, overLegs ? (legs.look && legs.look.tone) : null);

    /* 5. 躯干 */
    if (overChest) {
      drawChest(c, Object.assign({}, L, { base: (cloth.look && cloth.look.tone) || L.base }), bob, true);
    } else {
      drawChest(c, L, bob, false);
    }

    /* 6. 腰带 / 挂件 */
    drawWaist(c, L, bob);

    /* 7. 脖子 + 头（头部 y -66 ~ -50，脸区 9×14，足够画出清晰五官） */
    const hb = bob;
    px(c, -2.5, -52 + hb, 5, 4, shade(L.skin, -.18));   // 脖子
    px(c, -4, -66 + hb, 8, 16, L.skin);                 // 头骨
    px(c, -4.5, -64 + hb, 1, 10, shade(L.skin, -.06));  // 左侧轮廓
    px(c, 3.5, -64 + hb, 1, 10, shade(L.skin, .04));    // 右侧受光
    px(c, -3, -65.4 + hb, 6, 1, shade(L.skin, .14));    // 额顶高光
    px(c, -3, -51 + hb, 6, 1, shade(L.skin, -.16));     // 下巴过渡
    px(c, -5, -61 + hb, 1, 3.5, shade(L.skin, -.12));   // 左耳
    px(c, 4, -61 + hb, 1, 3.5, shade(L.skin, -.12));    // 右耳
    const featH = D.feat || {};
    drawHair(c, L, hb);
    if (featH.halo) drawHalo(c, L, hb, Math.sin(ph * 0.08) * 0.5 + 0.5);
    if (backView) {
      /* 背视：头发已由 drawHair 画好，这里只补后脑的体积明暗与发缝 */
      px(c, -3.6, -64 + hb, 7.2, 11, shade(L.hair, .06));   /* 后脑受光面 */
      px(c, -1, -63 + hb, 2, 9, shade(L.hair, -.18));       /* 后颈发缝 */
      px(c, -3.6, -65 + hb, 7.2, 0.9, shade(L.hair, .24));  /* 后脑高光 */
      px(c, -3.6, -54 + hb, 7.2, 1.0, shade(L.hair, -.22)); /* 发尾压边 */
    } else if (featH.fullHelm) {
      drawFullHelm(c, L, hb);                       /* 全罩头盔：不画脸 */
    } else {
      drawFace(c, L, hb);
      if (featH.wideHat) drawWideHat(c, L, hb);     /* 宽檐帽压在头发上 */
    }
    if (hat) drawHeadGear(c, o, hat.look && hat.look.hat, hat.look && hat.look.tone);

    /* 8. 前手臂 + 武器（手臂 y -44 ~ -31，手在 -34） */
    const atk = action === 'attack' ? (o.atkT == null ? 0.35 : o.atkT) : 0;
    const ext = action === 'attack' ? 1 : 0;
    const ax = (broad ? 4 : 4) + Math.round(ext * 3);
    const ay = -44 + hb + Math.round(armSw * .4) - ext * 2;
    px(c, ax, ay, 4, 6, overChest ? shade(L.base, .04) : D.bracers);        // 上臂
    px(c, ax, ay + 6, 4, 5, overChest ? shade(L.base, .1) : D.bracersLight); // 护腕
    px(c, ax, ay + 11, 4, 4, L.skin);                                        // 手

    const wt = o.wtype || 'blade';
    const sw = action === 'attack'
      ? U.lerp(-1.1, 0.9, U.clamp(atk, 0, 1))
      : (moving ? Math.sin(ph * 0.2) * 0.06 : Math.sin(ph * 0.05) * 0.04);
    if (backView) {
      /* 背视不画手持武器 */
    } else if ((D.feat || {}).staff) {
      c.save();
      c.translate(ax + 2, ay + 11);
      drawStaff(c, L);                            /* 法师：手持法杖，不用普通武器 */
      c.restore();
    } else {
      c.save();
      c.translate(ax + 3, ay + 13);
      c.rotate(sw + (wt === 'staff' || wt === 'crossbow' || wt === 'bow' ? -0.2 : 0));
      drawWeaponSimple(c, wt);
      c.restore();
    }

    /* 8.5 细节层：边光 / 甲片分割 / 铆钉 / 缝线 / 靴扣 / 发丝高光 */
    drawDetails(c, L, {
      flip: !!o.flip, action: action, atkT: o.atkT, equip: eq,
      weapon: { hx: ax + 3, hy: ay + 13, rot: sw + (wt === 'staff' || wt === 'crossbow' || wt === 'bow' ? -0.2 : 0) }
    }, bob, moving, ph);

    /* 8.6 背视：披风前襟翻到最上层，遮住正面服饰 */
    if (backView && !cloak && D.cape) {
      const ct = D.capeTone;
      const wave2 = Math.sin(ph * 0.16) * (moving ? 2.4 : 1.1);
      px(c, -8, -47 + bob, 16, 20, shade(ct, -.08));
      px(c, -8, -47 + bob, 16, 1.4, shade(ct, .2));
      px(c, -6 + wave2 * .3, -27, 12, 12, shade(ct, -.16));
      px(c, -8, -47 + bob, 1.4, 20, shade(ct, .1));
      px(c, 6.6, -47 + bob, 1.4, 20, shade(ct, -.24));
    }

    /* 9. 挥砍轨迹（1 平斩 / 2 上挑 / 3 下劈） */
    if (action === 'attack') {
      const p = U.clamp(o.atkT == null ? 0.4 : o.atkT, 0, 1);
      const r = Math.max(18, (o.reach || 46) * 0.55);
      const st = o.comboStep || 1;
      const dir = o.flip ? -1 : 1;
      c.save();
      c.globalAlpha = (1 - p) * 0.75;
      c.strokeStyle = L.accent;
      c.lineWidth = st === 3 ? 3.6 : 2.4;
      c.beginPath();
      if (st === 2) {
        c.arc(2, -30 + hb, r, dir > 0 ? (-1.5 + p * 2.2) : (Math.PI + 1.5 - p * 2.2),
              dir > 0 ? (-0.2 + p * 2.2) : (Math.PI + 0.2 + p * 2.2), dir < 0);
      } else if (st === 3) {
        c.arc(2, -34 + hb, r, dir > 0 ? (-2.2 + p * 1.9) : (Math.PI + 2.2 - p * 1.9),
              dir > 0 ? (-0.5 + p * 1.9) : (Math.PI + 0.5 + p * 1.9), dir < 0);
      } else {
        c.arc(2, -30 + hb, r, dir > 0 ? (-1.15 + p * 2.1) : (Math.PI + 1.15 - p * 2.1),
              dir > 0 ? (-0.35 + p * 2.1) : (Math.PI + 0.35 + p * 2.1), dir < 0);
      }
      c.stroke();
      c.globalAlpha = (1 - p) * 0.35;
      c.lineWidth = st === 3 ? 8 : 6;
      c.beginPath();
      c.arc(2, -32 + hb, r * 0.86, -1.1 + p * 2.1, -0.42 + p * 2.1);
      c.stroke();
      c.restore();
    }

    c.restore();
    VPROP = false;
  }

  /* =========================================================
     参考图造型件：宽檐帽 / 光环 / 全罩头盔 / 法杖 / 塔盾
     ========================================================= */

  /** 宽檐帽（游侠）：帽檐 + 帽冠 + 帽带 */
  function drawWideHat(c, L, hb) {
    const D = L.detail;
    const brim = D.hatTone || '#4a3320';
    const crown = shade(brim, .12);
    const band = D.beltBuckle || '#c9a24a';
    /* 帽檐（比头宽，两侧下垂） */
    px(c, -7.5, -68 + hb, 15, 2, brim);
    px(c, -8.0, -67 + hb, 16, 1, shade(brim, -.16));
    px(c, -7.0, -69 + hb, 14, 1, shade(brim, .18));
    /* 帽冠（锥形） */
    px(c, -4.5, -73 + hb, 9, 5, crown);
    px(c, -3.5, -75 + hb, 7, 2, crown);
    px(c, -2.5, -76.4 + hb, 5, 1.4, crown);
    px(c, -4.5, -73 + hb, 1, 5, shade(crown, -.18));
    px(c, 3.5, -73 + hb, 1, 5, shade(crown, .1));
    px(c, -2.5, -76.4 + hb, 5, 1, shade(crown, .24));
    /* 帽带 + 扣 */
    px(c, -4.5, -70 + hb, 9, 1.4, band);
    px(c, -1, -70 + hb, 2, 1.4, shade(band, .3));
  }

  /** 光环（法师）：细圆环 + 内圈高光 + 外部微光 */
  function drawHalo(c, L, hb, pulse) {
    const D = L.detail;
    const col = D.haloTone || '#c07cff';
    const y = -75.5 + hb;
    const a = 0.5 + pulse * 0.4;
    alphaFn(c, a * 0.3, function () {
      px(c, -4.6, y - 0.5, 9.2, 2.2, col);                /* 外部光晕 */
    });
    px(c, -4.6, y, 9.2, 0.7, shade(col, -.3));            /* 环下缘 */
    px(c, -4.6, y - 0.7, 9.2, 0.8, col);                  /* 主环 */
    px(c, -3.4, y - 1.3, 6.8, 0.7, shade(col, .35));      /* 内圈高光 */
    px(c, -5.3, y - 0.6, 0.9, 1.2, shade(col, .16));      /* 两端加厚 */
    px(c, 4.4, y - 0.6, 0.9, 1.2, shade(col, .16));
  }

  /** 全罩头盔（骑士）：高顶盔 + 面缝 + 呼吸孔 + 顶脊 */
  function drawFullHelm(c, L, hb) {
    const feat = L.detail.feat || {};
    const t = feat.helmTone || L.detail.chestTopLight || '#8a94a2';
    const dk = shade(t, -.3), hi = shade(t, .24);
    /* 盔体（高顶：从 -74 到 -54） */
    px(c, -6, -70 + hb, 12, 16, t);                       // 主盔体
    px(c, -5, -72.5 + hb, 10, 3, t);                      // 盔顶收窄
    px(c, -3.5, -74.5 + hb, 7, 2.5, t);                   // 盔尖
    px(c, -2, -76.5 + hb, 4, 2.2, shade(t, .1));          // 顶饰
    /* 明暗面 */
    px(c, -6, -70 + hb, 1.4, 16, dk);
    px(c, 4.6, -70 + hb, 1.4, 16, shade(t, -.14));
    px(c, -5, -72.5 + hb, 1.3, 3, dk);
    px(c, 3.7, -72.5 + hb, 1.3, 3, shade(t, -.16));
    /* 顶脊高光 */
    px(c, -1.2, -76.5 + hb, 2.4, 9, hi);
    px(c, -5, -71.6 + hb, 10, 0.9, hi);
    /* 面缝（横条，只露一线） */
    px(c, -4.6, -64 + hb, 9.2, 3.4, '#0c0f13');
    px(c, -4.6, -64 + hb, 9.2, 0.8, 'rgba(255,255,255,.18)');
    px(c, -3.6, -63.2 + hb, 3.0, 1.6, '#414c59');         // 眼部微光
    px(c, 0.6, -63.2 + hb, 3.0, 1.6, '#414c59');
    /* 呼吸孔 */
    px(c, -1.5, -59.2 + hb, 0.9, 1.6, dk);
    px(c, 0.6, -59.2 + hb, 0.9, 1.6, dk);
    /* 颈护 */
    px(c, -5.6, -55.4 + hb, 11.2, 2.6, shade(t, -.1));
    px(c, -5.6, -55.4 + hb, 11.2, 0.8, hi);
    px(c, -5.6, -53.4 + hb, 11.2, 0.8, dk);
  }

  /** 法杖（法师，右手）：木杖 + 紫水晶 + 缠绕 */
  function drawStaff(c, L) {
    const D = L.detail;
    const wood = D.staffTone || '#3a2a1a';
    const gem = D.accent || '#a06cff';
    /* 杖身（从手向下延伸到脚边） */
    px(c, -1.1, -14, 2.2, 34, wood);
    px(c, -1.1, -14, 0.7, 34, shade(wood, .2));
    px(c, 0.3, -14, 0.7, 34, shade(wood, -.2));
    /* 握把缠绕 */
    for (let i = 0; i < 4; i++) px(c, -1.4, 4 + i * 2.4, 2.8, 1.1, shade(wood, .3));
    /* 杖头：托架 + 水晶 */
    px(c, -2.4, -18.5, 4.8, 3.4, shade(wood, .16));
    px(c, -2.4, -18.5, 4.8, 0.9, shade(wood, .34));
    px(c, -1.6, -24.5, 3.2, 6.2, gem);
    px(c, -0.6, -25.4, 1.2, 1.4, shade(gem, .4));
    px(c, -1.6, -24.5, 1.0, 6.2, shade(gem, .26));
    px(c, 0.6, -24.5, 1.0, 6.2, shade(gem, -.24));
    alphaFn(c, 0.3, function () { px(c, -2.6, -25.8, 5.2, 8.4, gem); });
  }

  /** 塔盾（骑士，左手，持在身前侧）：盾面 + 金边 + 金色徽记 */
  function drawShield(c, L, bob) {
    const D = L.detail;
    const face = D.shieldTone || D.chestTopLight || '#7d8798';
    const trim = D.beltBuckle || '#f6c667';
    const x = -11, y = -34 + bob;
    const w = 7, h = 20;
    /* 盾面（上宽下收尖） */
    px(c, x, y, w, h, face);
    px(c, x + 0.9, y + h, w - 1.8, 2.6, shade(face, -.1));
    px(c, x + 2.0, y + h + 2.6, w - 4.0, 2.0, shade(face, -.2));
    /* 盾面受光与暗边 */
    px(c, x + 0.9, y + 1.4, w - 2.6, h - 3, shade(face, .1));
    px(c, x + w - 1.6, y + 1.4, 1.0, h - 3, shade(face, -.16));
    /* 金边 */
    px(c, x, y, w, 1.3, trim);
    px(c, x, y, 1.1, h, trim);
    px(c, x + w - 1.1, y, 1.1, h, shade(trim, -.14));
    px(c, x + 1.1, y + h - 1.3, w - 2.2, 1.3, shade(trim, -.1));
    /* 徽记：金色箭形 + 横杠 */
    px(c, x + 3.2, y + 3.4, 1.2, 3.4, trim);
    px(c, x + 2.0, y + 6.4, 3.6, 1.1, trim);
    px(c, x + 3.0, y + 7.4, 1.6, 4.2, trim);
    px(c, x + 2.4, y + 11.4, 2.8, 1.0, shade(trim, -.08));
  }

  /* =========================================================
     女性版服饰：露腰 + 束胸 + 短裙 + 大腿靴
     在躯干 / 腿部画完后覆盖上去（细节层里调用）
     ========================================================= */
  function drawFemaleFit(c, L, bob, moving, ph) {
    const D = L.detail;
    const f = D.feat || {};
    if (!f.bareMidriff && !f.corset && !f.miniSkirt) return;
    const skin = L.skin;
    const skinSh = shade(skin, -.14), skinHi = shade(skin, .1);
    const hip = -21 + bob;

    /* ---- 露腰：把下腹还原成皮肤 ---- */
    if (f.bareMidriff) {
      px(c, -4.0, -32 + bob, 8.0, 7.0, skin);
      px(c, -4.0, -32 + bob, 8.0, 0.8, skinHi);
      px(c, -4.0, -26.2 + bob, 8.0, 1.2, skinSh);           // 腰线阴影
      px(c, -1.0, -30 + bob, 1.0, 4.0, shade(skin, -.06));  // 腹肌中线
      px(c, -4.0, -32 + bob, 1.0, 7.0, shade(skin, -.1));   // 左侧收边
      px(c, 3.0, -32 + bob, 1.0, 7.0, shade(skin, -.04));
    }

    /* ---- 束胸（corset）：上胸保留甲色，下缘收到腰 ---- */
    if (f.corset) {
      const ct = D.chestTop, ctHi = D.chestTopLight;
      px(c, -4.6, -44 + bob, 9.2, 12.0, ct);                // 束胸主体
      px(c, -4.6, -44 + bob, 9.2, 1.4, ctHi);               // 上沿
      px(c, -4.6, -33.4 + bob, 9.2, 1.6, shade(ct, -.3));   // 下沿压边
      px(c, -4.6, -44 + bob, 1.0, 12.0, shade(ct, -.18));   // 左轮廓
      px(c, 3.6, -44 + bob, 1.0, 12.0, shade(ct, -.06));
      /* 胸前 V 形吊带 */
      c.save();
      c.strokeStyle = D.strapLight || D.strap;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-3.4, -45 + bob); c.lineTo(0, -38 + bob); c.lineTo(3.4, -45 + bob);
      c.stroke();
      c.restore();
      /* 中央系带 + 金扣 */
      px(c, -0.5, -41.5 + bob, 1.0, 7.0, shade(ct, -.34));
      px(c, -1.2, -41.0 + bob, 2.4, 1.8, D.beltBuckle);
      px(c, -1.2, -36.0 + bob, 2.4, 1.4, shade(D.beltBuckle, -.12));
      /* 胸线高光 */
      px(c, -3.4, -42.6 + bob, 2.6, 1.2, ctHi);
      px(c, 0.8, -42.6 + bob, 2.6, 1.2, ctHi);
    }

    /* ---- 迷你短裙：盖住髋部，裙摆外扩 ---- */
    if (f.miniSkirt) {
      const sk = D.bottom;
      px(c, -5.4, -25 + bob, 10.8, 5.6, sk);                // 裙身
      px(c, -6.2, -21.0 + bob, 12.4, 2.6, shade(sk, -.08)); // 裙摆外扩
      px(c, -5.4, -25 + bob, 10.8, 1.2, shade(sk, .2));     // 腰头
      px(c, -6.2, -18.6 + bob, 12.4, 0.9, shade(sk, -.24)); // 下摆压边
      /* 腰带 + 大方扣 */
      px(c, -5.6, -26.4 + bob, 11.2, 1.8, D.belt);
      px(c, -5.6, -26.4 + bob, 11.2, 0.7, shade(D.belt, .22));
      px(c, -1.6, -26.6 + bob, 3.2, 2.2, D.beltBuckle);
      px(c, -1.0, -26.2 + bob, 2.0, 1.4, shade(D.beltBuckle, .3));
      /* 裙侧竖褶 */
      px(c, -3.8, -24.4 + bob, 0.8, 5.0, shade(sk, -.16));
      px(c, 3.0, -24.4 + bob, 0.8, 5.0, shade(sk, -.16));
      /* 大腿侧挂小包 */
      px(c, 4.4, -24 + bob, 2.6, 3.0, shade(D.belt, -.1));
      px(c, 4.4, -24 + bob, 2.6, 0.8, shade(D.beltBuckle, -.1));
    }

    /* ---- 大腿靴：盖住小腿上半段，靴口加宽 ---- */
    if (f.thighBoots) {
      const bt = D.boots, btHi = shade(bt, .24), btSh = shade(bt, -.2);
      const swing = moving ? Math.sin(ph * 0.34) * 2 : 0;
      [-2 - Math.round(swing), -1 + Math.round(swing)].forEach(function (lx, i) {
        const x = lx - 2.2;
        const w = 4.4;
        /* 大腿露出（靴口以上是皮肤） */
        px(c, x + 0.4, -16 + bob, w - 0.8, 3.4, skin);
        px(c, x + 0.4, -16 + bob, w - 0.8, 0.7, skinSh);
        /* 靴筒 */
        px(c, x, -12.6 + bob + (i ? 0 : 0), w, 12.6 - (0), bt);
        px(c, x, -12.6 + bob, w, 1.4, btHi);                 // 靴口
        px(c, x, -11.4 + bob, w, 0.8, btSh);
        px(c, x + w - 1.1, -11.4 + bob, 1.1, 11.0, btHi);    // 外侧高光
        px(c, x, -11.4 + bob, 1.1, 11.0, btSh);
        /* 靴面搭扣 ×2 */
        px(c, x - 0.4, -7.0 + bob, w + 0.8, 1.2, D.beltBuckle);
        px(c, x - 0.4, -3.2 + bob, w + 0.8, 1.2, D.beltBuckle);
        /* 鞋头 */
        px(c, x - 0.6, -1.6 + bob, w + 1.4, 1.8, shade(bt, -.12));
      });
    }
  }

  /* 头盔造型 */
  function drawHeadGear(c, o, hat, tone) {
    const t = tone || '#8d97a5';
    if (hat === 'hood') {
      px(c, -5, -60, 10, 8, t);
      px(c, -6, -54, 2, 5, t); px(c, 4, -54, 2, 5, t);
      px(c, -5, -61, 10, 1, 'rgba(255,255,255,.25)');
      px(c, -5, -52, 10, 1, 'rgba(0,0,0,.28)');
    } else if (hat === 'helm') {
      px(c, -5, -61, 10, 10, t);
      px(c, -6, -53, 12, 2, '#5b636f');
      px(c, -4, -56, 8, 1, 'rgba(0,0,0,.55)');
      px(c, -1, -63, 2, 2, '#d94b3a');           // 盔顶羽饰
      px(c, -5, -61, 10, 1, 'rgba(255,255,255,.4)');
    } else if (hat === 'crown') {
      px(c, -5, -60, 10, 2, tone || '#f6c667');
      px(c, -4, -62, 2, 2, tone || '#f6c667');
      px(c, -1, -63, 2, 3, tone || '#f6c667');
      px(c, 2, -62, 2, 2, tone || '#f6c667');
      px(c, -1, -62, 1, 1, '#fff6d0');
    }
  }

  /* 颜色明暗调整 */
  function shade(hex, amt) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = U.clamp(Math.round(r + 255 * amt), 0, 255);
    g = U.clamp(Math.round(g + 255 * amt), 0, 255);
    b = U.clamp(Math.round(b + 255 * amt), 0, 255);
    return '#' + [r, g, b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  /* 简易像素武器（跟随手部） */
  function drawWeaponSimple(c, wt) {
    switch (wt) {
      case 'greatsword':
        px(c, 0, -2, 4, 8, WGRIP);
        px(c, 4, -4, 18, 3, WBASE);
        px(c, 4, -5, 17, 1, '#f2f6ff');
        px(c, 21, -3, 3, 2, WBASE);
        break;
      case 'spear':
        px(c, 0, -1, 3, 10, WGRIP);
        px(c, 2, -2, 26, 2, WDARK);
        px(c, 27, -4, 6, 5, WBASE);
        break;
      case 'axe':
        px(c, 0, -1, 3, 9, WGRIP);
        px(c, 2, -3, 12, 2, WDARK);
        px(c, 12, -8, 7, 11, WBASE);
        px(c, 12, -8, 7, 3, '#eef3ff');
        break;
      case 'hammer':
        px(c, 0, -1, 3, 10, WGRIP);
        px(c, 2, -2, 12, 2, WDARK);
        px(c, 12, -9, 12, 13, WDARK);
        px(c, 13, -8, 10, 11, WBASE);
        break;
      case 'bow':
        px(c, 2, -12, 2, 24, '#8a5a34');
        px(c, 0, -12, 4, 2, '#c9d3e0');
        px(c, 0, 10, 4, 2, '#c9d3e0');
        px(c, 3, -10, 1, 20, 'rgba(255,255,255,.5)');
        break;
      case 'crossbow':
        px(c, -6, -2, 20, 4, WDARK);
        px(c, 8, -8, 3, 16, '#8a5a34');
        px(c, -8, -3, 4, 6, WBASE);
        break;
      case 'staff':
        px(c, 0, -2, 3, 30, '#6b4a2a');
        ell(c, 2, -8, 5, 5, 'rgba(160,108,255,.45)');
        px(c, -1, -11, 6, 6, '#a06cff');
        px(c, 0, -10, 3, 3, '#e6d8ff');
        break;
      case 'gauntlet':
        px(c, 0, -4, 6, 7, WDARK);
        px(c, 5, -3, 4, 5, WBASE);
        px(c, 0, -4, 6, 2, WACC);
        break;
      case 'scythe':
        px(c, 0, -2, 3, 24, WGRIP);
        px(c, 2, -34, 3, 34, WDARK);
        px(c, 3, -36, 16, 3, WBASE);
        px(c, 17, -34, 3, 10, '#dff2ff');
        break;
      case 'whip':
        c.strokeStyle = WACC;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(12, 6, 26, -6);
        c.stroke();
        break;
      default: /* blade */
        px(c, 0, -1, 4, 7, WGRIP);
        px(c, 3, -3, 4, 4, '#f6c667');
        px(c, 4, -3, 17, 3, WBASE);
        px(c, 4, -4, 16, 1, '#f4f8ff');
        px(c, 20, -3, 3, 2, '#e8eef8');
        break;
    }
  }

  /* =========================================================
     生物（中立 / 善良 / 无攻击）：猪 / 牛 / 羊 / 鸡 / 鱼
     每个种类外观都不同，用体素块拼（与原像素小人同一套 px 原语）
     ========================================================= */
  function creature(c, o, t) {
    const s = o.s || 2.4;
    const kind = o.species || 'cr_pig';
    c.save();
    c.translate(o.x, o.y);
    c.scale(s, s);
    if (o.flip) c.scale(-1, 1);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    const ph = (t || 0) * 2.4;
    const step = o.moving ? Math.sin(ph) : 0;
    const breathe = o.moving ? 0 : Math.sin(ph * 0.5) * 0.6;
    const B = o.body || '#e8a0a8', B2 = o.body2 || B, DK = o.dark || '#8a5a60';

    if (kind === 'cr_deer') {
      /* 梅花鹿（参考图）：棕身 + 白色斑点 + 分叉鹿角 + 细长腿 */
      const bodyY = -18 + breathe;
      const sp = o.spot || '#f4ece0';
      const hn = o.horn || '#c9b48a';
      px(c, -11, bodyY, 20, 10, B);                        // 身体
      px(c, -11, bodyY, 20, 2.6, B2);                      // 背脊高光
      px(c, -11, bodyY + 8, 20, 2, shade(B, -.16));        // 腹部
      px(c, -12, bodyY + 1, 4, 5, shade(B, -.1));          // 臀
      /* 白色斑点（梅花） */
      const dots = [[-8, 3], [-4, 1.4], [-1, 4], [3, 1.6], [6, 3.6], [-6, 6], [1, 6.6], [7, 6.4]];
      for (let i = 0; i < dots.length; i++) px(c, dots[i][0], bodyY + dots[i][1], 1.8, 1.8, sp);
      /* 脖子（斜向上） */
      px(c, 7, bodyY - 5, 4.4, 8, B);
      px(c, 8, bodyY - 5, 2, 8, B2);
      /* 头 + 长吻 */
      const hx = 9, hy = bodyY - 12;
      px(c, hx, hy, 7, 6.4, B);
      px(c, hx, hy, 7, 2, B2);
      px(c, hx + 5.6, hy + 2.6, 5, 3.4, shade(B, -.06));   // 吻
      px(c, hx + 10, hy + 3.2, 1.6, 1.8, o.snout || '#3a2818');
      px(c, hx + 2, hy + 1.6, 1.8, 1.8, '#1a1210');        // 眼
      px(c, hx + 2.2, hy + 1.8, 0.8, 0.8, '#ffffff');
      px(c, hx - 0.6, hy + 0.6, 3, 2.6, o.ear || '#8a5028');  // 耳
      px(c, hx - 0.2, hy + 1, 2.2, 1.6, shade(o.ear || '#8a5028', -.2));
      /* 鹿角（分叉，参考图很明显） */
      px(c, hx + 1.4, hy - 4, 1.8, 5, hn);
      px(c, hx + 1.4, hy - 6, 1.8, 3, hn);
      px(c, hx - 1.4, hy - 6.6, 3, 1.6, hn);
      px(c, hx + 3.4, hy - 7.4, 3, 1.6, hn);
      px(c, hx + 0.6, hy - 9, 1.6, 3, hn);
      px(c, hx + 4.6, hy - 5, 1.6, 3.4, hn);
      /* 四条细腿 */
      const legs = [[-8, 1], [-3, -1], [3, -1], [8, 1]];
      for (let i = 0; i < 4; i++) {
        const lo = step * legs[i][1] * 1.6;
        px(c, legs[i][0] + lo * 0.4, bodyY + 9, 2.6, 10 + lo, shade(B, -.14));
        px(c, legs[i][0] + lo * 0.4, bodyY + 18, 2.6, 2, o.foot || '#4a2e18');
      }
      /* 短尾 */
      px(c, -13, bodyY + 2, 3, 3, sp);
    } else if (kind === 'cr_boar') {
      /* 野猪（参考图）：深棕厚身 + 竖立鬃毛 + 白獠牙 + 拱地鼻 */
      const bodyY = -15 + breathe;
      const br = o.bristle || '#6e5440';
      const ts = o.tusk || '#f0e8d0';
      px(c, -12, bodyY, 22, 12, B);                        // 厚实身体
      px(c, -12, bodyY, 22, 3, B2);
      px(c, -12, bodyY + 10, 22, 2, shade(B, -.2));
      /* 竖立鬃毛（背上一排） */
      for (let i = 0; i < 8; i++) {
        const bh = 3.4 + (i === 3 || i === 4 ? 2 : 0);
        px(c, -11 + i * 2.8, bodyY - bh, 2, bh, br);
      }
      px(c, -12, bodyY - 1, 22, 2, shade(br, -.15));
      /* 头（低垂，拱地姿态） */
      const hx = 8, hy = bodyY + 2;
      px(c, hx, hy, 8, 8, B);
      px(c, hx, hy, 8, 2, shade(B, .1));
      px(c, hx + 6, hy + 3.4, 3.4, 4.4, o.snout || '#c07a78');   // 鼻盘
      px(c, hx + 7.4, hy + 4.4, 1, 1, '#5a2a28');
      px(c, hx + 8.4, hy + 6, 1, 1, '#5a2a28');
      px(c, hx + 2.2, hy + 1.4, 1.8, 1.8, '#f0e0c0');      // 眼（小）
      px(c, hx + 2.4, hy + 1.8, 1, 1, '#2a1a10');
      px(c, hx - 0.4, hy - 1.4, 3.4, 3.4, o.ear || '#3a2c1e');   // 耳
      px(c, hx + 4.4, hy - 1, 3, 3, o.ear || '#3a2c1e');
      /* 獠牙（向上弯，参考图很醒目） */
      px(c, hx + 6.4, hy + 7, 1.8, 3.4, ts);
      px(c, hx + 5.8, hy + 9.6, 1.8, 2.6, ts);
      px(c, hx + 6.2, hy + 11.4, 1.4, 2, ts);
      /* 四条短粗腿 */
      const legs = [[-9, 1], [-4, -1], [4, -1], [9, 1]];
      for (let i = 0; i < 4; i++) {
        const lo = step * legs[i][1] * 1.2;
        px(c, legs[i][0] + lo * 0.4, bodyY + 11, 4, 6.4, shade(B, -.16));
        px(c, legs[i][0] + lo * 0.4, bodyY + 16, 4.4, 2.4, o.foot || '#2a1e14');
      }
      /* 短卷尾 */
      px(c, -14, bodyY + 2, 3, 2.4, shade(B, -.1));
      px(c, -16, bodyY + 1, 2.4, 2.4, shade(B, -.16));
      /* 拱地扬起的土（参考图有尘土） */
      if (o.moving) alpha(c, .3, function () {
        ell(c, hx + 9, bodyY + 19, 7, 2.4, '#6a5540');
      });
    } else if (kind === 'cr_frog') {
      /* 青蛙（参考图）：亮绿 + 大黄眼 + 白肚 + 蹲姿 */
      const bodyY = -9 + breathe;
      const eye = o.eye || '#e8a020';
      px(c, -8, bodyY, 17, 10, B);                         // 身体
      px(c, -8, bodyY, 17, 2.6, B2);
      px(c, -7, bodyY + 7, 15, 3, o.snout || '#d8e8a8');   // 白肚
      /* 后腿（蹲着的粗腿） */
      px(c, -10, bodyY + 5, 5, 6, shade(B, -.16));
      px(c, -11, bodyY + 9, 6, 3, o.foot || '#4a8a28');
      px(c, 5, bodyY + 5, 5, 6, shade(B, -.1));
      px(c, 5, bodyY + 9, 6, 3, o.foot || '#4a8a28');
      /* 前腿（细） */
      px(c, 1, bodyY + 8, 2.6, 4, shade(B, -.2));
      px(c, 4.4, bodyY + 8, 2.6, 4, shade(B, -.24));
      /* 头（宽，与身体连成一体）+ 鼓出的眼睛 */
      px(c, 6, bodyY - 1, 7, 7, B);
      px(c, 6, bodyY - 1, 7, 2, B2);
      px(c, 6.6, bodyY - 4, 3.6, 4, B);                    // 左眼包
      px(c, 10, bodyY - 4, 3.6, 4, B);                     // 右眼包
      px(c, 7, bodyY - 3.4, 3, 3, eye);
      px(c, 10.4, bodyY - 3.4, 3, 3, eye);
      px(c, 7.6, bodyY - 3, 1.6, 2.2, '#1a1210');
      px(c, 11, bodyY - 3, 1.6, 2.2, '#1a1210');
      px(c, 7.4, bodyY - 3.2, 0.9, 1, '#ffffff');
      px(c, 10.8, bodyY - 3.2, 0.9, 1, '#ffffff');
      /* 嘴 */
      px(c, 8, bodyY + 4.4, 6, 1, shade(B, -.3));
    } else if (kind === 'cr_leafkin') {
      /* 叶精灵（参考图）：绿叶斗篷 + 尖耳 + 大棕眼 + 木杖 + 荧光 */
      const gl = o.glow || '#d8ff8a';
      const bodyY = -13 + breathe;
      const st = o.staff || '#7a5a32';
      /* 腿 + 叶靴 */
      const lo = step * 1.6;
      px(c, -4, -6, 3.4, 7 + lo, B);
      px(c, 1, -6, 3.4, 7 - lo, shade(B, -.14));
      px(c, -5, -1, 5, 2.4, o.foot || '#4a3a22');
      px(c, 1, -1, 5, 2.4, o.foot || '#4a3a22');
      /* 身体 + 叶片裙 */
      px(c, -6, bodyY, 13, 9, B);
      px(c, -6, bodyY, 13, 2.4, B2);
      for (let i = 0; i < 5; i++) {                        // 叶片裙摆
        const lx = -7 + i * 3;
        px(c, lx, bodyY + 7, 3, 4 - (i % 2), i % 2 ? shade(B, -.12) : B);
      }
      /* 叶斗篷（肩上） */
      px(c, -8, bodyY - 1, 17, 5, shade(B, .08));
      px(c, -8, bodyY - 1, 17, 2, B2);
      for (let i = 0; i < 6; i++) px(c, -8 + i * 3, bodyY + 3.4, 2.6, 3, shade(B, -.1));
      /* 叶领（尖尖的） */
      px(c, -4, bodyY - 4, 3, 4, B2);
      px(c, 1, bodyY - 4.4, 3, 4.4, B2);
      /* 头 */
      const hy = bodyY - 12;
      px(c, -5, hy, 11, 10, B);
      px(c, -5, hy, 11, 2.4, B2);
      /* 尖耳（参考图很明显） */
      px(c, -8, hy + 1, 3.4, 4, B);
      px(c, -10, hy + 2, 2.4, 3, shade(B, .06));
      px(c, 5, hy + 1, 3.4, 4, B);
      px(c, 7.4, hy + 2, 2.4, 3, shade(B, .06));
      /* 叶帽（头顶一片大叶子） */
      px(c, -6, hy - 4, 13, 5, shade(B, .1));
      px(c, -4, hy - 6.6, 9, 3, B2);
      px(c, 1, hy - 8, 4, 2, B2);
      px(c, -5, hy - 3, 11, 1.4, shade(B, -.2));
      /* 大棕眼 + 微笑 */
      px(c, -2.4, hy + 3, 3.4, 3.4, '#2a1a10');
      px(c, 1.6, hy + 3, 3.4, 3.4, '#2a1a10');
      px(c, -2, hy + 3.4, 2.6, 2.6, o.eye || '#8a5a2a');
      px(c, 2, hy + 3.4, 2.6, 2.6, o.eye || '#8a5a2a');
      px(c, -1.4, hy + 3.8, 1.2, 1.4, '#1a0e08');
      px(c, 2.6, hy + 3.8, 1.2, 1.4, '#1a0e08');
      px(c, -1, hy + 3.6, 0.9, 1, '#ffffff');
      px(c, 3, hy + 3.6, 0.9, 1, '#ffffff');
      px(c, 0.4, hy + 7.4, 3, 1.4, '#3f7a22');             // 嘴
      /* 木杖（右手） */
      px(c, 7, hy + 6, 2.4, 20, st);
      px(c, 7, hy - 2, 3, 10, shade(st, .12));
      px(c, 6.4, hy - 4, 4.4, 3, st);                      // 杖头弯
      px(c, 6.4, hy - 6, 1.6, 2.4, st);
      /* 荧光点（参考图有黄绿光点） */
      const fl = Math.sin(ph * 2.4) * 1.4;
      alpha(c, .8, function () {
        ell(c, -11, hy - 4 + fl, 1.8, 1.8, gl);
        ell(c, 12, hy + 2 - fl, 1.6, 1.6, gl);
        ell(c, -9, hy + 10 + fl * 0.7, 1.4, 1.4, gl);
      });
    } else if (kind === 'cr_slime_buddy') {
      /* 行囊史莱姆（参考图）：蓝色半透明果冻 + 圆帽 + 背包 + 大眼 + 腮红 */
      const gl = o.glow || '#bfe8ff';
      const ht = o.hat || '#c08840';
      const pk = o.pack || '#8a6a3a';
      const bodyY = -11 + breathe;
      const squash = o.moving ? 1 + Math.sin(ph * 2) * 0.06 : 1;
      c.save();
      c.translate(0, 0);
      c.scale(1 / squash, squash);
      /* 果冻身体（圆润，底部略平） */
      ell(c, 0, bodyY + 2, 13, 11.4, B);
      ell(c, 0, bodyY, 12, 10, B2);
      px(c, -11, bodyY + 8, 22, 5, B);                     // 底部加宽
      alpha(c, .45, function () { ell(c, -5, bodyY - 3, 4.4, 3.4, '#ffffff'); });   // 高光
      alpha(c, .3, function () { ell(c, 6, bodyY + 5, 3, 2.4, '#ffffff'); });
      /* 滴落的小水珠（参考图有动态感） */
      px(c, -10, bodyY + 12, 2, 3, B);
      px(c, 9, bodyY + 12, 1.6, 2.4, B);
      /* 眼睛（大而圆，参考图很可爱） */
      px(c, -5, bodyY + 1, 4.4, 4.4, '#ffffff');
      px(c, 1.6, bodyY + 1, 4.4, 4.4, '#ffffff');
      px(c, -3.6, bodyY + 2, 3, 3.4, '#1a3a5a');
      px(c, 2.6, bodyY + 2, 3, 3.4, '#1a3a5a');
      px(c, -3.2, bodyY + 2.4, 1.6, 1.8, '#0a1a2a');
      px(c, 3, bodyY + 2.4, 1.6, 1.8, '#0a1a2a');
      px(c, -2.8, bodyY + 2, 1.2, 1.4, '#ffffff');
      px(c, 3.4, bodyY + 2, 1.2, 1.4, '#ffffff');
      /* 嘴（小微笑）+ 腮红 */
      px(c, -1.4, bodyY + 6.4, 3, 1, '#3a6a8a');
      alpha(c, .5, function () {
        ell(c, -8, bodyY + 5, 2.4, 1.8, '#e87a9a');
        ell(c, 8, bodyY + 5, 2.4, 1.8, '#e87a9a');
      });
      /* 背包（斜挎，参考图有） */
      px(c, -12, bodyY - 2, 6, 8, pk);
      px(c, -12, bodyY - 2, 6, 2, shade(pk, .18));
      px(c, -11.4, bodyY + 4, 5, 1.4, shade(pk, -.24));
      px(c, -3, bodyY - 8, 8, 2, pk);                      // 背带
      /* 圆帽（参考图戴着一顶棕色圆帽） */
      px(c, -6, bodyY - 10, 13, 3.4, ht);
      px(c, -6, bodyY - 11.4, 13, 1.4, shade(ht, .2));
      px(c, -4, bodyY - 14, 9, 4, ht);
      px(c, -4, bodyY - 14.6, 9, 1.4, shade(ht, .24));
      px(c, -4.4, bodyY - 9.4, 10, 1.6, shade(ht, -.28));  // 帽带
      /* 闪光点 */
      const fl = Math.sin(ph * 3) * 1.2;
      alpha(c, .75, function () {
        ell(c, 13, bodyY - 2 + fl, 1.6, 1.6, gl);
        ell(c, -14, bodyY + 4 - fl, 1.4, 1.4, gl);
      });
      c.restore();
    } else if (kind === 'cr_pig') {
      /* 猪：圆身 + 扁鼻 + 三角耳 + 卷尾 + 四条短腿 */
      const bodyY = -9 + breathe;
      px(c, -8, bodyY, 16, 10, B);                       // 身体
      px(c, -8, bodyY, 16, 3, B2);                       // 背脊高光
      px(c, -8, bodyY + 8, 16, 2, shade(B, -.12));       // 腹部
      px(c, -9, bodyY + 2, 2, 6, DK);                    // 尾端
      px(c, -10, bodyY + 1, 2, 2, DK);                   // 卷尾
      px(c, 6, bodyY + 1, 5, 8, B);                      // 头
      px(c, 6, bodyY + 1, 5, 2, B2);
      px(c, 10, bodyY + 4, 3, 3, o.snout || '#f2a0ac');  // 鼻子
      px(c, 11, bodyY + 5, 1, 1, DK);
      px(c, 7, bodyY + 5, 1.6, 1.6, '#1a1210');          // 眼
      px(c, 7, bodyY + 5, 0.7, 0.7, '#ffffff');
      px(c, 6.4, bodyY - 1, 3, 3, o.ear || '#d98a96');   // 耳
      px(c, 6.4, bodyY - 1, 3, 1, shade(o.ear || '#d98a96', .2));
      for (let i = 0; i < 4; i++) {                       // 四条腿
        const lx = -7 + i * 4.6;
        const lo = (i % 2 === 0) ? step : -step;
        px(c, lx, -1, 3, 3 + lo * 0.8, o.foot || DK);
      }
    } else if (kind === 'cr_cow') {
      /* 牛：大身 + 黑白花 + 角 + 长脸 */
      const bodyY = -11 + breathe;
      px(c, -10, bodyY, 20, 13, B);
      px(c, -10, bodyY, 20, 3, B2);
      px(c, -10, bodyY + 11, 20, 2, shade(B, -.12));
      /* 黑斑 */
      px(c, -7, bodyY + 3, 5, 5, DK);
      px(c, 1, bodyY + 5, 4, 5, DK);
      px(c, -2, bodyY + 1, 3, 3, DK);
      px(c, 8, bodyY + 2, 6, 9, B);                      // 头
      px(c, 12, bodyY + 6, 4, 5, o.snout || '#e8a898');  // 口鼻
      px(c, 13, bodyY + 8, 1, 1, DK);
      px(c, 9.4, bodyY + 4, 1.8, 1.8, '#1a1210');
      px(c, 9.4, bodyY + 4, 0.8, 0.8, '#ffffff');
      px(c, 7.6, bodyY - 2, 2, 2, o.horn || '#d8ccb8');  // 角
      px(c, 5.4, bodyY - 1, 2, 2, o.horn || '#d8ccb8');
      px(c, 7, bodyY + 1, 3, 2, o.ear || '#e8dcd0');     // 耳
      for (let i = 0; i < 4; i++) {
        const lx = -9 + i * 5.6;
        const lo = (i % 2 === 0) ? step : -step;
        px(c, lx, -1, 3.4, 4 + lo * 0.9, o.foot || '#4a4038');
      }
    } else if (kind === 'cr_sheep') {
      /* 羊：蓬松卷毛（多层圆块）+ 细腿 */
      const bodyY = -12 + breathe;
      px(c, -8, bodyY + 1, 16, 11, B);                   // 毛身
      px(c, -9, bodyY, 4, 4, B2);                        // 卷毛凸起
      px(c, -5, bodyY - 2, 5, 4, B2);
      px(c, 0, bodyY - 2, 5, 4, B2);
      px(c, 4, bodyY - 1, 4, 3, B2);
      px(c, -9, bodyY + 5, 4, 4, B2);
      px(c, 4, bodyY + 6, 4, 3, B2);
      px(c, 6, bodyY + 3, 5, 6, DK);                     // 深色脸
      px(c, 10, bodyY + 5, 2, 3, o.snout || '#d8c8b8');
      px(c, 7.6, bodyY + 4, 1.6, 1.6, '#f2eee8');
      px(c, 7.6, bodyY + 4.4, 0.8, 0.8, '#1a1210');
      px(c, 6.2, bodyY + 2, 2, 2, o.ear || '#e4dcd0');
      for (let i = 0; i < 4; i++) {
        const lx = -6.4 + i * 4.4;
        const lo = (i % 2 === 0) ? step : -step;
        px(c, lx, -4, 2.4, 5 + lo * 0.7, o.foot || '#5a5048');
      }
    } else if (kind === 'cr_chicken') {
      /* 鸡：小白身 + 红冠 + 黄喙 + 细爪 */
      const bodyY = -8 + breathe;
      px(c, -6, bodyY + 1, 11, 8, B);                    // 身体
      px(c, -6, bodyY + 1, 11, 2.4, B2);
      px(c, -7, bodyY + 4, 3, 4, shade(B, -.08));        // 尾羽
      px(c, -8.4, bodyY + 1, 2, 4, shade(B, -.16));
      px(c, 4, bodyY - 2, 5, 6, B);                      // 头
      px(c, 4.6, bodyY - 4, 3, 2.6, o.comb || '#d94b3a'); // 红冠
      px(c, 4.6, bodyY - 4.6, 1.4, 1.6, o.comb || '#d94b3a');
      px(c, 8.6, bodyY + 1, 2.6, 2, o.snout || '#f0a030'); // 喙
      px(c, 5.6, bodyY, 1.6, 1.6, '#1a1210');            // 眼
      px(c, 5.6, bodyY, 0.7, 0.7, '#ffffff');
      px(c, -1, bodyY + 9, 4, 2, shade(B, -.1));         // 翅膀
      for (let i = 0; i < 2; i++) {
        const lx = -2 + i * 5;
        const lo = (i === 0) ? step : -step;
        px(c, lx, -1, 2, 3 + lo * 0.8, o.foot || '#e8a838');
      }
    } else if (kind === 'cr_fish') {
      /* 鱼：流线身 + 尾鳍 + 背鳍 + 侧线（水里上下浮动） */
      const fy = -6 + Math.sin(ph * 0.8) * 1.6 + breathe;
      px(c, -6, fy, 12, 7, B);                           // 身体
      px(c, -6, fy, 12, 2.4, B2);                        // 背部高光
      px(c, -6, fy + 5.4, 12, 1.6, shade(B, -.14));
      px(c, -9.6, fy + 1.6, 4, 4, o.tail || '#4f98c8');  // 尾鳍
      px(c, -11.4, fy, 2.4, 7, o.tail || '#4f98c8');
      px(c, -1, fy - 2.6, 5, 3, o.fin || '#7fc8e8');     // 背鳍
      px(c, -2, fy + 6.6, 3.4, 2.4, o.fin || '#7fc8e8'); // 腹鳍
      px(c, 3.4, fy + 2, 2, 2, '#0d1014');               // 眼
      px(c, 3.4, fy + 2, 0.8, 0.8, '#ffffff');
      px(c, -3, fy + 3, 6, 0.8, 'rgba(255,255,255,.35)'); // 侧线
      px(c, 5.6, fy + 2.6, 2, 1.6, o.snout || '#c8e8f8'); // 嘴
    }
    c.restore();
  }

  /* ---------------- 敌人 ---------------- */
  function enemy(c, e, t) {
    const s = e.s || 3;
    const x = e.x, y = e.y;
    const col = e.color || '#8a5a3a';
    const kind = e.kind || 'melee';
    const ph = t * 2.2;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    if (e.flip) c.scale(-1, 1);
    if (e.alpha != null) c.globalAlpha = e.alpha;

    /* 影子 */
    alpha(c, .35, function () { ell(c, 0, 0, 8, 2.4, '#000'); });

    if (kind === 'boss') {
      /* 首领：厚重躯干 + 巨臂 + 发光核 */
      px(c, -10, -34, 20, 22, col);
      px(c, -12, -32, 5, 16, shade(col, -.12));
      px(c, 7, -32, 5, 16, shade(col, -.16));
      px(c, -6, -40, 12, 10, shade(col, .06));
      px(c, -4, -38, 3, 3, '#ffe0a0');
      px(c, 1, -38, 3, 3, '#ffe0a0');
      px(c, -7, -12, 6, 12, shade(col, -.2));
      px(c, 1, -12, 6, 12, shade(col, -.24));
      px(c, -6, -26, 12, 8, shade(col, .2));
      ell(c, 0, -22, 4 + Math.sin(ph) * .6, 4, 'rgba(255,220,150,.95)');
      ell(c, 0, -22, 7, 7, 'rgba(255,140,60,.28)');
    } else if (kind === 'ranged') {
      px(c, -8, -26, 16, 18, col);
      px(c, -8, -26, 16, 3, shade(col, .12));
      px(c, -4, -22, 8, 6, '#191f2a');
      px(c, -3, -21, 6, 3, '#ff7a4d');
      px(c, -6, -8, 5, 8, shade(col, -.2));
      px(c, 1, -8, 5, 8, shade(col, -.24));
      px(c, 8, -24, 12, 4, shade(col, .14));   // 炮管
      px(c, 18, -25, 4, 6, WACC);
    } else if (kind === 'flyer') {
      const f = Math.sin(ph * 2.2) * 3;
      px(c, -4, -22, 8, 8, col);
      px(c, -12, -24 - f, 8, 3, shade(col, -.1));
      px(c, 4, -24 - f, 8, 3, shade(col, -.1));
      px(c, -3, -20, 2, 2, '#ffd479');
      px(c, 1, -20, 2, 2, '#ffd479');
      px(c, -2, -14, 4, 3, shade(col, -.2));
    } else if (kind === 'charger') {
      px(c, -9, -20, 18, 12, col);
      px(c, -10, -24, 8, 6, shade(col, .08));
      px(c, -8, -26, 3, 3, '#ff6b5b');
      px(c, -3, -26, 3, 3, '#ff6b5b');
      px(c, -9, -30, 4, 5, shade(col, -.1));
      px(c, 5, -30, 4, 5, shade(col, -.1));
      px(c, -9, -8, 4, 8, shade(col, -.2));
      px(c, -2, -8, 4, 8, shade(col, -.22));
      px(c, 5, -8, 4, 8, shade(col, -.24));
      px(c, 9, -18, 6, 3, '#e8eef8');
    } else if (kind === 'wolf') {
      /* 幽影狼（参考图）：黑毛 + 红色凶眼 + 外露獠牙 + 冲锋前压低 */
      const crouch = e.charging ? 2.0 : 0;
      const bl = '#232028', bl2 = '#33303a', bl3 = '#15131a';
      const bodyY = -13 + crouch + (e.moving ? Math.sin(ph * 1.6) * 0.5 : 0);
      /* 躯干（细长，背部拱起） */
      px(c, -11, bodyY, 20, 9, bl);
      px(c, -11, bodyY, 20, 2.6, bl2);                      // 背脊高光
      px(c, -11, bodyY + 7, 20, 2, bl3);                    // 腹侧阴影
      px(c, -6, bodyY - 1.6, 9, 3, bl2);                    // 肩隆
      /* 鬃毛（背上一排尖刺） */
      for (let i = 0; i < 6; i++) px(c, -9 + i * 3, bodyY - 2.6 - (i > 2 && i < 5 ? 1.4 : 0), 1.8, 3.2, bl3);
      /* 头（前伸，吻部尖） */
      const hx = 9, hy = bodyY + 1;
      px(c, hx, hy, 9, 8, bl);
      px(c, hx + 1, hy, 7, 2, bl2);
      px(c, hx + 7, hy + 3.4, 5, 3.4, bl3);                  // 吻部
      px(c, hx + 11, hy + 4, 1.6, 1.6, '#0a0808');           // 鼻头
      /* 红眼（参考图最醒目） */
      px(c, hx + 2.4, hy + 1.6, 2.6, 2.2, '#e8202a');
      px(c, hx + 2.8, hy + 1.9, 1.2, 1.2, '#ff8a80');
      /* 外露獠牙 */
      px(c, hx + 7, hy + 6.4, 1.4, 2.6, '#f4ecd8');
      px(c, hx + 9.4, hy + 6.4, 1.4, 2.2, '#f4ecd8');
      /* 耳朵（尖立） */
      px(c, hx + 1, hy - 3.6, 2.6, 4, bl3);
      px(c, hx + 5, hy - 3.4, 2.6, 3.8, bl);
      px(c, hx + 1.6, hy - 2.6, 1.4, 2, '#5a3038');
      /* 四条腿（前腿更粗，冲锋时前伸） */
      const st = e.moving ? Math.sin(ph * 2.4) : 0;
      const legs = [[-9, 1], [-4, -1], [5, -1], [9, 1]];
      for (let i = 0; i < legs.length; i++) {
        const off = st * legs[i][1] * 2.4 + (e.charging ? legs[i][1] * 2 : 0);
        px(c, legs[i][0] + off * 0.3, bodyY + 8, 3.4, 8 + (i < 2 ? 1 : 0), i < 2 ? bl2 : bl3);
        px(c, legs[i][0] + off * 0.3 - 0.4, bodyY + 15, 4.2, 2.4, '#0a0808');   // 爪
      }
      /* 尾巴（上翘的蓬松尾） */
      const tw = Math.sin(ph * 1.8) * 2;
      px(c, -13, bodyY + 1 + tw * 0.3, 5, 4, bl3);
      px(c, -17, bodyY - 1 + tw * 0.6, 5, 4.4, bl);
      px(c, -20, bodyY - 5 + tw, 3.6, 4, bl3);
      /* 脚下暗影粒子（参考图有黑雾） */
      alpha(c, .3, function () {
        ell(c, -4, bodyY + 18, 14, 2.6, '#000');
        ell(c, hx + 4, bodyY + 18, 7, 2, '#000');
      });
    } else if (kind === 'vine') {
      /* 藤蔓魔（参考图）：绿色藤躯 + 胸口橙色火核 + 尖刺 + 触须 */
      const vg = '#4a7a2a', vg2 = '#5f9a35', vg3 = '#2f5a1a', vd = '#6a2a3a';
      const sway = Math.sin(ph) * 1.4;
      const bodyY = -26 + (e.moving ? Math.sin(ph * 2) * 0.7 : 0);
      /* 腿（粗藤柱） */
      px(c, -8, -14, 6, 15, vg3);
      px(c, -8, -14, 6, 2, vg);
      px(c, 2, -14, 6, 15, vg3);
      px(c, 2, -14, 6, 2, vg);
      px(c, -9, -2, 8, 3, '#3a2a14');                        // 脚
      px(c, 1, -2, 8, 3, '#3a2a14');
      /* 躯干（上宽下窄，藤条缠绕） */
      px(c, -10, bodyY, 20, 14, vg);
      px(c, -10, bodyY, 20, 3, vg2);
      px(c, -10, bodyY + 11, 20, 3, vg3);
      /* 藤条纹理（斜向） */
      for (let i = 0; i < 5; i++) px(c, -9 + i * 4, bodyY + 2 + (i % 2) * 3, 2.4, 9, vg3);
      for (let i = 0; i < 3; i++) px(c, -7 + i * 5, bodyY + 5, 5, 1.8, vd);   // 暗红筋膜
      /* 胸口火核（参考图核心） */
      ell(c, 0, bodyY + 7, 6.5, 6.5, 'rgba(255,140,40,.30)');
      px(c, -3, bodyY + 4, 6, 7, '#ff8a20');
      px(c, -2, bodyY + 5, 4, 5, '#ffd070');
      px(c, -1, bodyY + 6, 2, 3, '#fff4d0');
      /* 尖刺（肩上与背部） */
      for (let i = 0; i < 4; i++) px(c, -12 + i * 7, bodyY - 4 - (i === 1 || i === 2 ? 2 : 0), 2.2, 5, '#d8ccb0');
      /* 头（小而前倾，黄眼） */
      const hx = 2, hy = bodyY - 8;
      px(c, hx - 5, hy, 11, 8, vg);
      px(c, hx - 5, hy, 11, 2.4, vg2);
      px(c, hx - 3, hy + 6, 8, 3, vg3);                      // 下颌
      px(c, hx - 2, hy + 4.6, 6, 1.6, '#1a0e08');            // 咧嘴
      for (let i = 0; i < 4; i++) px(c, hx - 2 + i * 1.8, hy + 4.6, 0.9, 1.8, '#f0e8c8');  // 牙
      px(c, hx - 2.4, hy + 1.6, 3, 2.4, '#ffd020');          // 黄眼
      px(c, hx + 1.6, hy + 1.6, 3, 2.4, '#ffd020');
      px(c, hx - 1.6, hy + 2.2, 1.4, 1.2, '#201008');
      px(c, hx + 2.4, hy + 2.2, 1.4, 1.2, '#201008');
      /* 头顶藤须 */
      for (let i = 0; i < 3; i++) {
        px(c, hx - 4 + i * 4, hy - 3 - i, 2, 4, vg);
        px(c, hx - 4 + i * 4 + 1, hy - 5 - i, 1.6, 2.4, vg2);
      }
      /* 手臂：右臂是藤鞭（甩动），左臂是爪 */
      const aw = Math.sin(ph * 2.2) * 3;
      px(c, 9, bodyY + 2, 9, 4.4, vg);                       // 右臂
      px(c, 17, bodyY + 1 + aw, 4, 4, vg2);
      px(c, 20, bodyY - 1 + aw * 1.4, 12, 3.4, vg3);         // 藤鞭
      px(c, 31, bodyY - 3 + aw * 1.8, 8, 2.6, vg2);
      px(c, 38, bodyY - 5 + aw * 2, 4, 2, vg3);
      px(c, -17, bodyY + 3, 8, 4, vg3);                      // 左臂
      for (let i = 0; i < 3; i++) px(c, -21 - i * 1.6, bodyY + 5 + i * 2.4, 2, 4.4, vg2);  // 爪指
    } else if (kind === 'skeleton') {
      /* 墓碑骷髅（参考图）：白骨 + 蓝色鬼火眼 + 肩上扛墓碑 + 破斗篷 */
      const bn = '#ded4c0', bn2 = '#f4ecd8', bn3 = '#a89880';
      const cloak = '#3a3038', cloak2 = '#4a3f48';
      const bodyY = -30;
      const bob = e.moving ? Math.sin(ph * 2.4) * 1.2 : Math.sin(ph * 0.8) * 0.6;
      /* 腿骨 */
      px(c, -6, -16, 3.4, 15, bn);
      px(c, 2, -16, 3.4, 15, bn3);
      px(c, -8, -14, 4, 2.4, bn2);
      px(c, 1, -14, 4, 2.4, bn3);
      px(c, -8, -2, 6, 2.6, bn3);                            // 脚骨
      px(c, 1, -2, 6, 2.6, bn3);
      /* 骨盆 + 破斗篷下摆 */
      px(c, -6, -18, 12, 4, bn);
      px(c, -8, -17, 16, 7, cloak);                          // 斗篷下摆
      for (let i = 0; i < 5; i++) px(c, -8 + i * 3.4, -10 + (i % 2) * 1.6, 2.6, 3.6, cloak);  // 破布条
      /* 肋骨（参考图很清晰） */
      px(c, -5, bodyY + 6, 10, 16, bn);
      px(c, -5, bodyY + 6, 10, 3, bn2);
      for (let i = 0; i < 5; i++) px(c, -5, bodyY + 9 + i * 2.8, 10, 1.2, cloak);   // 肋骨缝
      px(c, -1, bodyY + 6, 2, 16, bn3);                      // 脊柱
      /* 肩 + 斗篷领 */
      px(c, -9, bodyY + 2, 18, 4, cloak2);
      /* 手臂：右臂高举墓碑 */
      const swing = e.attacking ? 0 : Math.sin(ph * 1.4) * 2;
      px(c, 7, bodyY + 4, 4, 10, bn);                        // 右臂骨
      px(c, 6, bodyY - 4 + swing, 5, 9, bn3);
      px(c, 5, bodyY - 10 + swing, 6, 5, bn2);               // 手骨
      /* 墓碑（参考图核心道具：拱顶石板 + 十字） */
      const gx = 2, gy = bodyY - 34 + swing;
      px(c, gx, gy, 16, 22, '#8a8478');
      px(c, gx, gy, 16, 3, '#a8a294');
      px(c, gx + 1, gy + 20, 14, 3, '#6a6458');
      /* 拱顶 */
      px(c, gx + 2, gy - 3, 12, 4, '#8a8478');
      px(c, gx + 4, gy - 5, 8, 3, '#8a8478');
      px(c, gx + 4, gy - 5, 8, 1.4, '#a8a294');
      /* 裂纹 */
      px(c, gx + 3, gy + 6, 1.4, 8, '#5a5448');
      px(c, gx + 11, gy + 10, 1.4, 6, '#5a5448');
      /* 十字刻纹 */
      px(c, gx + 6.6, gy + 4, 2.4, 10, '#5a5448');
      px(c, gx + 4, gy + 7, 8, 2.4, '#5a5448');
      /* 左臂骨 */
      px(c, -10, bodyY + 4, 3.4, 11, bn3);
      for (let i = 0; i < 3; i++) px(c, -11 - i * 0.6, bodyY + 14 + i * 1.2, 2, 4.4, bn3);  // 爪指
      /* 头骨 */
      const hy = bodyY - 7;
      px(c, -5, hy, 11, 10, bn2);
      px(c, -5, hy, 11, 2.4, '#ffffff');
      px(c, -4, hy + 8, 9, 3.4, bn);                         // 下颌
      px(c, -4, hy + 7.4, 9, 1, '#8a7f6a');
      for (let i = 0; i < 5; i++) px(c, -3.4 + i * 1.8, hy + 7.4, 1.2, 3, '#f4ecd8');  // 牙
      /* 蓝色鬼火眼（参考图最醒目） */
      px(c, -3.4, hy + 1.8, 3.4, 3, '#2a8ae8');
      px(c, 1.6, hy + 1.8, 3.4, 3, '#2a8ae8');
      px(c, -2.6, hy + 2.4, 2, 2, '#8fd8ff');
      px(c, 2.4, hy + 2.4, 2, 2, '#8fd8ff');
      ell(c, -1.7, hy + 3.3, 4, 3, 'rgba(60,160,255,.30)');
      ell(c, 3.3, hy + 3.3, 4, 3, 'rgba(60,160,255,.30)');
      /* 头顶鬼火 */
      const fl = Math.sin(ph * 3) * 1;
      ell(c, 0, hy - 6 + fl, 5, 5, 'rgba(60,160,255,.22)');
      px(c, -1.6, hy - 9 + fl, 3.2, 5, '#3aa0ff');
      px(c, -0.8, hy - 11 + fl, 1.8, 3, '#a8e0ff');
    } else if (kind === 'elite') {
      px(c, -9, -30, 18, 18, col);
      px(c, -9, -30, 18, 4, shade(col, .16));
      px(c, -5, -34, 10, 8, shade(col, .05));
      px(c, -3, -32, 2, 2, '#ffd479');
      px(c, 1, -32, 2, 2, '#ffd479');
      px(c, -9, -12, 6, 12, shade(col, -.2));
      px(c, 3, -12, 6, 12, shade(col, -.24));
    } else {
      /* melee 团块 / 壮汉 */
      const w = e.size > 22 ? 22 : 16;
      const h = e.size > 22 ? 26 : 18;
      px(c, -w / 2, -h, w, h, col);
      px(c, -w / 2, -h, w, 3, shade(col, .14));
      px(c, -w / 2 + 2, -h + 5, 3, 3, '#ff8a5b');
      px(c, w / 2 - 5, -h + 5, 3, 3, '#ff8a5b');
      if (e.size > 22) {
        px(c, -w / 2 - 5, -h + 6, 5, 14, shade(col, -.1));
        px(c, w / 2, -h + 6, 5, 14, shade(col, -.14));
      }
      px(c, -w / 2 + 2, -3, 5, 4, shade(col, -.2));
      px(c, w / 2 - 7, -3, 5, 4, shade(col, -.24));
    }

    /* 精英光环 */
    if (e.affix) {
      c.strokeStyle = e.affix.color || '#fff';
      c.lineWidth = 1.2;
      c.globalAlpha = 0.55 + Math.sin(ph * 1.6) * 0.2;
      c.beginPath();
      c.ellipse(0, -16, 14, 20, 0, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
  }

  /* ---------------- 场景物件（大厅装饰 & 平台） ---------------- */
  function prop(c, kind, x, y, t) {
    c.save();
    c.translate(x, y);
    switch (kind) {
      case 'anvil':
        px(c, -12, -10, 24, 8, '#5b636f');
        px(c, -16, -14, 32, 5, '#79828f');
        px(c, -5, -2, 10, 6, '#4a525c');
        break;
      case 'crate':
        px(c, -11, -14, 22, 14, '#6b4a2a');
        px(c, -11, -14, 22, 2, '#8a6238');
        px(c, -11, -8, 22, 2, '#4d341c');
        break;
      case 'board':
        px(c, -16, -30, 32, 20, '#5a3f26');
        px(c, -14, -28, 28, 16, '#8a6a44');
        px(c, -11, -25, 12, 2, '#e8e0cc');
        px(c, -11, -21, 18, 2, '#e8e0cc');
        px(c, -11, -17, 9, 2, '#e8e0cc');
        px(c, -2, -12, 4, 12, '#3d2a18');
        break;
      case 'fire':
        flame(c, 0, 0, t, 1);
        break;
      case 'gate':
        px(c, -20, -46, 40, 46, '#2b3342');
        px(c, -16, -42, 32, 42, '#101722');
        ell(c, 0, -20, 13, 19, 'rgba(255,140,60,' + (0.16 + Math.sin(t * 1.6) * 0.05) + ')');
        px(c, -20, -46, 40, 3, '#4a5568');
        break;
      case 'mirror':
        px(c, -9, -38, 18, 30, '#4a5568');
        px(c, -7, -36, 14, 26, '#8fb8d8');
        px(c, -5, -34, 5, 20, 'rgba(255,255,255,.35)');
        px(c, -9, -8, 18, 4, '#5b636f');
        break;
      case 'chest':
        px(c, -11, -14, 22, 14, '#7a5230');
        px(c, -11, -17, 22, 5, '#8d6238');
        px(c, -11, -10, 22, 2, '#f6c667');
        px(c, -2, -10, 4, 5, '#3d2a18');
        break;
      case 'crystal':
        px(c, -5, -26, 10, 26, '#4fd7ff');
        px(c, -3, -30, 6, 6, '#9eeaff');
        ell(c, 0, -14, 10, 14, 'rgba(79,215,255,.16)');
        break;
      case 'lantern':
        px(c, -1, -34, 2, 10, '#4a5568');
        px(c, -6, -24, 12, 10, '#3a4150');
        ell(c, 0, -19, 5, 5, 'rgba(255,170,80,.9)');
        ell(c, 0, -19, 14, 14, 'rgba(255,150,60,.14)');
        break;
      case 'lava':
        for (let i = 0; i < 4; i++) {
          const ox = Math.sin(t * 1.2 + i) * 4;
          ell(c, i * 26 + ox, -2 + Math.sin(t * 2 + i) * 1.5, 9, 3, 'rgba(255,110,40,.7)');
        }
        break;
      default:
        px(c, -8, -8, 16, 8, '#3a4150');
    }
    c.restore();
  }

  /* 火焰（大厅篝火 / 火盆） */
  function flame(c, x, y, t, scale) {
    const s = scale || 1;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    px(c, -13, -5, 26, 6, '#3a2a1c');
    px(c, -11, -7, 22, 3, '#57402a');
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(t * 6 + i * 1.7) * 1.6;
      const hgt = 16 + i * 5;
      ell(c, f, -8 - hgt / 2, 5 - i, hgt / 2, i === 0 ? 'rgba(255,200,90,.95)' : (i === 1 ? 'rgba(255,140,50,.75)' : 'rgba(255,90,40,.5)'));
    }
    ell(c, 0, -12, 22, 26, 'rgba(255,140,60,' + (0.12 + Math.sin(t * 3) * 0.03) + ')');
    /* 火星 */
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.6 + i * 0.25) % 1;
      px(c, Math.sin(t * 2 + i * 2) * 6, -14 - p * 30, 1.6, 1.6, 'rgba(255,190,120,' + (1 - p) + ')');
    }
    c.restore();
  }

  G.Sprites = {
    hero: hero,
    creature: creature,
    enemy: enemy,
    prop: prop,
    flame: flame,
    drawWeaponSimple: drawWeaponSimple,
    shade: shade,
    px: px,
    ell: ell,
    DEF: DEF,
    resolveLook: resolveLook,
    /* 立绘画布尺寸与锚点：按实测包围盒留余量（含鞭/镰等长武器与挥砍弧线） */
    FRAME: { w: 82, h: 58, ax: 0.30, ay: 48 },   /* 比例改矮后收紧：角色高约 52 单位 */
    /* 小头像画布：只框住头肩，用于登录/角色页的外观选择格 */
    FACE: { w: 30, h: 32, ax: 0.5, ay: 68 },
    /** 在画布上绘制一个居中的角色立绘（含地面投影），返回该帧的显示尺寸 */
    preview: function (c, cssW, effS, t, opts) {
      const o = opts || {};
      const F = G.Sprites.FRAME;
      const s = effS || 4;
      /* 每帧都重置变换，避免上一次绘制残留的缩放叠加 */
      const cssH = parseFloat(c.canvas.style.height) || c.canvas.height;
      const dpr = cssH ? c.canvas.height / cssH : 1;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = false;
      const cx = Math.round(cssW * F.ax), cy = Math.round(F.ay * s);
      c.globalAlpha = 0.3;
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(cx, cy + 1, 4.4 * s, 1.5 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      const ph = (t || 0) * 2.2;
      const act = o.action || 'idle';
      const wpn = o.equip && o.equip.weapon;
      /* fit：把体素精灵图整体缩到画布内（顶栏头像 / 卡片格子用），
         画布高度 = F.h × s，精灵图按此比例缩放后正好贴合 */
      const sheetFit = cssH ? (F.h * s) / (s * HERO_SCALE * ((o.look && o.look.height) || 1) * 62 * 1.28) : 1;
      hero(c, {
        x: cx, y: cy, s: s,
        ph: ph, moving: act === 'run', action: act,
        atkT: o.atkT == null ? null : o.atkT,
        aim: 0, look: o.look, equip: o.equip || {},
        wtype: wpn ? wpn.wtype : 'blade',
        reach: wpn ? wpn.reach : 46,
        fit: Math.min(1, sheetFit)
      });
      return { s: s, cx: cx, cy: cy };
    },
    /**
     * 在画布上绘制「头肩」半身像（用于外观选择格），自带适配与错误兜底
     * @param {HTMLCanvasElement} canvas 目标画布
     * @param {object} look 外观对象
     * @param {number} s 像素倍率
     */
    drawFaceChip: function (canvas, look, s) {
      const F = G.Sprites.FACE;
      const k = s || 2.4;
      const w = Math.round(F.w * k), h = Math.round(F.h * k);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = false;
      const cx = Math.round(w * F.ax), cy = Math.round(F.ay * k);
      c.globalAlpha = 0.3;
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(cx, cy + 1, 4 * k, 1.2 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      try {
        hero(c, { x: cx, y: cy, s: k, ph: 0.6, moving: false, action: 'idle', atkT: null,
          aim: 0, look: look, equip: {}, wtype: 'blade', reach: 46 });
      } catch (err) {
        /* 兜底：只画一个头色块，避免外观选择格空白 */
        px(c, cx - 4 * k, cy - 58 * k, 8 * k, 13 * k, (look && look.skin) || '#e0a882');
        px(c, cx - 5 * k, cy - 60 * k, 10 * k, 5 * k, (look && look.hair) || '#2b2320');
      }
      return canvas;
    },
    /** 从存档里组装主角绘制参数 */
    /* 调试：查看体素精灵图状态（不影响游戏逻辑） */
    sheetDebug: function () {
      const out = { enabled: SHEET_ENABLED, style: SHEET_STYLE, dir: SHEET_DIR, clips: SHEET_CLIPS, loaded: {} };
      Object.keys(SHEET_CACHE).forEach(function (k) {
        const c = SHEET_CACHE[k];
        let n = 0, miss = 0;
        Object.keys(c).forEach(function (key) { if (c[key]) n++; else miss++; });
        out.loaded[k] = n + ' 张已加载' + (miss ? '，' + miss + ' 张待加载' : '');
      });
      return out;
    },
    equipFromState: function () {
      const eq = G.State.state.equipped;
      return {
        head: G.State.clothAt('head'),
        body: G.State.clothAt('body'),
        legs: G.State.clothAt('legs'),
        cloak: G.State.clothAt('cloak'),
        weapon: G.State.weapon()
      };
    }
  };
})(window.G = window.G || {});
