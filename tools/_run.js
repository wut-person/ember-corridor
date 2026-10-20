'use strict';
/* =========================================================
   测试运行器：沙箱化临时目录 + 自动清理 + 汇总
   用法：
     node tools/_run.js smoke-test          跑单个
     node tools/_run.js --all               跑全部核心套件
     node tools/_run.js --list              列出可用套件
   ========================================================= */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const cleanup = require('./lib/cleanup');

const TOOLS = __dirname;
const CORE = [
  'smoke-test.js',
  'world-test.js',
  'creature-test.js',
  'harvest-test.js',
  'ruin-test.js',
  'rotate-test.js',
  'pick-test.js',
  'pose-test.js',
  'fps-test.js',
  'edge-test.js',
  'cdp-test.js',
  'run-check.js'
];

function listSuites() {
  return fs.readdirSync(TOOLS)
    .filter((f) => /-(test|check)\.js$/.test(f) && f !== '_run.js')
    .sort();
}

function runOne(file, sandbox) {
  const full = path.join(TOOLS, file);
  if (!fs.existsSync(full)) {
    console.log('  [跳过] 找不到 ' + file);
    return { file, code: -1, out: '' };
  }
  /* 每个套件独立沙箱，避免互相干扰 */
  const sb = path.join(sandbox, file.replace(/\.js$/, ''));
  fs.mkdirSync(sb, { recursive: true });
  const env = Object.assign({}, process.env, {
    TEMP: sb, TMP: sb, TMPDIR: sb
  });
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [full], {
    env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  const ms = Date.now() - t0;
  return { file, code: r.status, out: (r.stdout || '') + (r.stderr || ''), ms };
}

function summarize(out) {
  const lines = String(out).split('\n');
  const pick = lines.filter((l) =>
    /全部检查通过|通过 \d+ \/|通过 \d+ 项|失败 \d+ 项|结论|运行时异常|控制台异常|发现 \d+ 个问题|FAIL/.test(l)
  );
  return pick.map((l) => '    ' + l.trim()).slice(0, 6).join('\n');
}

(function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    console.log('可用套件：');
    listSuites().forEach((f) => console.log('  ' + f));
    return;
  }

  const sandbox = cleanup.begin();
  console.log('[runner] 临时沙箱：' + sandbox);
  console.log('');

  const targets = argv.includes('--all')
    ? CORE
    : (argv.filter((a) => !a.startsWith('--')).map((a) => (a.endsWith('.js') ? a : a + '.js')));

  if (!targets.length) {
    console.log('用法：node tools/_run.js <套件名> | --all | --list');
    console.log('例：  node tools/_run.js smoke-test');
    cleanup.end();
    return;
  }

  let pass = 0, fail = 0;
  const failed = [];
  for (const f of targets) {
    process.stdout.write('▶ ' + f + ' … ');
    const r = runOne(f, sandbox);
    const ok = r.code === 0;
    if (ok) { pass++; process.stdout.write('通过\n'); }
    else { fail++; failed.push(f); process.stdout.write('失败（exit ' + r.code + '）\n'); }
    const s = summarize(r.out);
    if (s) console.log(s);
  }

  console.log('');
  console.log('============ 汇总 ============');
  console.log('通过 ' + pass + ' / ' + (pass + fail));
  if (failed.length) console.log('失败：' + failed.join('、'));

  cleanup.end();
  if (failed.length) process.exitCode = 1;
})();
