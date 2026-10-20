'use strict';
/* 用 Node 模拟 2D 上下文矩阵，验证角色精灵的真实包围盒（不依赖浏览器） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeCtx() {
  const rects = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  function mul(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }
  function apply(x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  return {
    _rects: rects,
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: '', shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: false,
    canvas: { width: 1, height: 1 },
    save() { stack.push(m.slice()); },
    restore() { if (stack.length) m = stack.pop(); },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate() { },
    fillRect(x, y, w, h) {
      const p1 = apply(x, y), p2 = apply(x + w, y + h);
      rects.push({ x1: Math.min(p1[0], p2[0]), y1: Math.min(p1[1], p2[1]), x2: Math.max(p1[0], p2[0]), y2: Math.max(p1[1], p2[1]), color: this.fillStyle });
    },
    clearRect() { }, beginPath() { }, closePath() { }, arc() { }, ellipse() { }, moveTo() { }, lineTo() { }, quadraticCurveTo() { },
    fill() { }, stroke() { }, fillText() { }, measureText() { return { width: 10 }; },
    createLinearGradient() { return { addColorStop() { } }; },
    createRadialGradient() { return { addColorStop() { } }; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
    _matrix() { return m; }
  };
}

const sandbox = {
  console: console, Math: Math, JSON: JSON, Date: Date, Object: Object, Array: Array,
  String: String, Number: Number, Boolean: Boolean, Error: Error, RegExp: RegExp, isNaN: isNaN,
  parseInt: parseInt, parseFloat: parseFloat, Uint8ClampedArray: Uint8ClampedArray, Proxy: Proxy, Set: Set, Map: Map
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

['js/core/util.js', 'js/data/weapons.js', 'js/data/clothing.js', 'js/data/items.js', 'js/core/state.js', 'js/core/sprites.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
});
sandbox.localStorage = { getItem: function () { return null; }, setItem: function () { }, removeItem: function () { } };
const G = sandbox.G;
G.State.load();

const F = G.Sprites.FRAME;
[2, 3, 4, 5, 6, 8].forEach(function (s) {
  const ctx = makeCtx();
  const w = Math.round(F.w * s), h = Math.round(F.h * s);
  ctx.canvas = { width: w, height: h, style: { width: w + 'px' } };
  const cx = Math.round(w * F.ax), cy = Math.round(F.ay * s);
  G.Sprites.hero(ctx, {
    x: cx, y: cy, s: s, ph: 1.2, moving: false, action: 'idle', atkT: null, aim: 0,
    look: G.getLook('lk_a'), equip: {}, wtype: 'blade', reach: 46
  });
  const r = ctx._rects;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  r.forEach(function (q) {
    minX = Math.min(minX, q.x1); maxX = Math.max(maxX, q.x2);
    minY = Math.min(minY, q.y1); maxY = Math.max(maxY, q.y2);
  });
  console.log('s=' + s + ' 画布' + w + 'x' + h + ' 绘制矩形数=' + r.length +
    ' 实际占据 x[' + Math.round(minX) + ',' + Math.round(maxX) + '] y[' + Math.round(minY) + ',' + Math.round(maxY) + ']' +
    ' 宽' + Math.round(maxX - minX) + ' 高' + Math.round(maxY - minY) +
    (minX < 0 || maxX > w || minY < 0 || maxY > h ? '  ← 超出画布' : '  ok'));
});
