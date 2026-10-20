'use strict';
/* =========================================================
   测试脚本临时目录清理器（沙箱 + 自动回收）
   用途：让 tools/ 下的浏览器测试脚本把临时文件都写在
         %TEMP%\_dsh-test-<pid>\ 里，脚本退出时整目录删掉。
   好处：不用改任何一个测试脚本；os.tmpdir() 会读到我们设的 TEMP。
   ========================================================= */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REAL_TMP = process.env.TEMP || process.env.TMP || os.tmpdir();
const SANDBOX = path.join(REAL_TMP, '_dsh-test-' + process.pid);

function ensureSandbox() {
  try { fs.mkdirSync(SANDBOX, { recursive: true }); } catch (e) { return null; }
  return SANDBOX;
}

/** 开启沙箱：把 TEMP/TMP 指向自己的目录，返回沙箱路径 */
function begin() {
  const sb = ensureSandbox();
  if (!sb) return null;
  process.env.TEMP = sb;
  process.env.TMP = sb;
  process.env.TMPDIR = sb;
  return sb;
}

/** 统计目录大小（MB，保留 1 位） */
function sizeMB(dir) {
  try {
    let total = 0;
    const walk = (d) => {
      let items;
      try { items = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
      for (const it of items) {
        const p = path.join(d, it.name);
        if (it.isDirectory()) walk(p);
        else { try { total += fs.statSync(p).size; } catch (e) { /* 占用中 */ } }
      }
    };
    walk(dir);
    return Math.round(total / 1048576 * 10) / 10;
  } catch (e) { return 0; }
}

/** 删除沙箱里的子项（浏览器可能还占着个别文件，多试几次） */
function purge(dir) {
  if (!dir) return { removed: 0, left: 0 };
  let removed = 0, left = 0;
  const wipe = (d) => {
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const it of items) {
      const p = path.join(d, it.name);
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) {
        try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 2 }); ok = true; }
        catch (e) { /* 再试 */ }
      }
      if (ok) removed++; else left++;
    }
  };
  wipe(dir);
  /* 目录本身也尝试删掉（可能因残留文件失败，不影响下次运行） */
  try { fs.rmdirSync(dir); } catch (e) { /* 留着也行，反正每次都新建 */ }
  return { removed, left };
}

/** 结束：统计、清理、打印一行提示；返回清理掉的 MB */
function end(quiet) {
  const before = sizeMB(SANDBOX);
  const r = purge(SANDBOX);
  if (!quiet && before > 0) {
    console.log('[cleanup] 已清理测试临时目录 ' + before + ' MB' +
      (r.left ? '（' + r.left + ' 项被占用，稍后可手动删）' : ''));
  }
  /* 顺手清掉本次运行前遗留的旧沙箱（超过 1 小时的） */
  sweepOld(quiet);
  return before;
}

/** 清扫历史遗留的旧沙箱目录（别人/上次异常退出留下的） */
function sweepOld(quiet) {
  let items;
  try { items = fs.readdirSync(REAL_TMP, { withFileTypes: true }); } catch (e) { return 0; }
  const now = Date.now();
  let freed = 0, n = 0;
  for (const it of items) {
    if (!it.isDirectory() || it.name.indexOf('_dsh-test-') !== 0) continue;
    const p = path.join(REAL_TMP, it.name);
    if (p === SANDBOX) continue;
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (now - st.mtimeMs < 3600000) continue;          /* 1 小时内的不动，可能在跑 */
    const mb = sizeMB(p);
    try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 2 }); freed += mb; n++; } catch (e) { /* 占用 */ }
  }
  if (!quiet && n) console.log('[cleanup] 额外清掉 ' + n + ' 个历史临时目录，' + Math.round(freed * 10) / 10 + ' MB');
  return freed;
}

module.exports = { begin, end, purge, sizeMB, sweepOld, SANDBOX, REAL_TMP };
