'use strict';
/* 只读诊断：给 sprites.js 的像素绘制函数打桩，列出「头顶上方」每一笔是谁画的 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

/* 读取 sprites.js，在 IIFE 内部把 px 包一层记录（只在诊断时使用，不改源文件） */
let src = fs.readFileSync(path.join(ROOT, 'js/core/sprites.js'), 'utf8');
/* sprites.js 里像素绘制函数名固定为 px(c, x, y, w, h, col)，在定义后插入记录钩子 */
const hook = `
  const __origPx = px;
  px = function (c, x, y, w, h, col) { if (__rec) __rec.push([x, y, w, h, col]); return __origPx(c, x, y, w, h, col); };
`;
if (!/function px\s*\(/.test(src)) { console.error('未找到 px 函数定义'); process.exit(1); }
src = src.replace(/(function px\s*\([^)]*\)\s*\{[\s\S]*?\n  \})/, '$1\n' + hook);
if (src.indexOf('__origPx') < 0) { console.error('打桩失败（未能定位 px 主体）'); process.exit(1); }

const rec = [];
const logs = [];
const ctx = {
  save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
  beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, stroke() {}, closePath() {},
  ellipse() {}, setLineDash() {}, fill() {}, fillRect() {}, strokeRect() {}, clearRect() {},
  quadraticCurveTo() {}, bezierCurveTo() {}, rect() {}, clip() {}, setTransform() {}, transform() {},
  drawImage() {}, createPattern() { return null; },
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  measureText() { return { width: 10 }; }, fillText() {}, strokeText() {},
  set fillStyle(v) {}, get fillStyle() { return ''; },
  set strokeStyle(v) {}, get strokeStyle() { return ''; },
  set lineWidth(v) {}, get lineWidth() { return 0; },
  set lineCap(v) {}, set lineJoin(v) {}, set globalAlpha(v) {}, get globalAlpha() { return 1; },
  set globalCompositeOperation(v) {}, get globalCompositeOperation() { return 'source-over'; },
  set font(v) {}, get font() { return ''; },
  set textAlign(v) {}, get textAlign() { return ''; },
  set shadowColor(v) {}, set shadowBlur(v) {}, set shadowOffsetX(v) {}, set shadowOffsetY(v) {},
  set imageSmoothingEnabled(v) {}, get imageSmoothingEnabled() { return false; }
};

const sandbox = {
  window: {}, document: { createElement: () => ({ getContext: () => ctx, style: {}, width: 0, height: 0 }) },
  performance: { now: () => 0 }, console, Math, Date, JSON
};
sandbox.window.G = sandbox.window.G || {};
vm.createContext(sandbox);
vm.runInContext('var __rec = null;', sandbox);
/* 先加载外观数据（G.LOOKS / G.getLook），再加载精灵层 */
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core/util.js'), 'utf8'), sandbox, { filename: 'util.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data/clothing.js'), 'utf8'), sandbox, { filename: 'clothing.js' });
vm.runInContext(src, sandbox, { filename: 'sprites.js' });
const G = sandbox.window.G;

const look = G.getLook(process.argv[2] || 'lk_b');   /* 铁壁游侠（发髻） */
console.log('外观：' + look.name + '　发型：' + look.hairStyle);

sandbox.__rec = rec;
G.Sprites.hero(ctx, {
  x: 0, y: 0, s: 1, ph: 1, moving: false, action: 'idle', atkT: null, aim: 0,
  look: look, equip: {}, wtype: 'blade', reach: 46
});

console.log('总绘制笔数：' + rec.length);
const above = rec.filter((r) => r[1] < -60);          /* 头顶上方（-60 以上） */
console.log('\n=== 位于 y < -60 的绘制笔（头顶上方）共 ' + above.length + ' 笔 ===');
above
  .sort((a, b) => a[1] - b[1])
  .forEach((r) => {
    console.log('  y=' + r[1] + '  h=' + r[2] + '  x=' + r[0] + '  w=' + r[3] + '  颜色=' + r[4]);
  });

let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
rec.forEach((r) => {
  minY = Math.min(minY, r[1]); maxY = Math.max(maxY, r[1] + r[2]);
  minX = Math.min(minX, r[0]); maxX = Math.max(maxX, r[0] + r[3]);
});
console.log('\n整体包围盒：x ' + minX + ' ~ ' + maxX + '　y ' + minY + ' ~ ' + maxY + '（画出高度 ' + (maxY - minY) + ' 单位）');
