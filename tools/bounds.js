'use strict';
/* 精确测量主角精灵在各动作下的像素格包围盒，用于确定立画画布尺寸 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9159;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'ember-bounds-' + Date.now()),
    '--window-size=1440,900', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; } catch (e) { await sleep(300); } }
  const tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r && r.exceptionDetails) return 'EXC: ' + JSON.stringify(r.exceptionDetails).slice(0, 600);
    return r && r.result ? r.result.value : ('RAW:' + JSON.stringify(r).slice(0, 400));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(3200);
  await ev("document.querySelector('.login-panel input.input').value='x';document.querySelector('.login-panel .btn.primary').click();1");
  await sleep(1200);
  await ev(`if(!G.State.state.ownedWeapons.length){var w=JSON.parse(JSON.stringify(G.Weapons.get('w_iron_falchion')));w.uid='g0';w.instName=w.name;G.State.addWeapon(w);G.State.equipWeapon('g0');['head','body','legs','cloak'].forEach(function(s,i){var pool=G.Clothing.bySlot(s);var c=JSON.parse(JSON.stringify(pool[Math.min(1,pool.length-1)]));c.uid='gc'+i;G.State.addClothing(c);G.State.equipCloth(c.uid);});G.State.saveNow();}1`);
  await sleep(400);
  console.log(await ev(`(function(){
    var out = [];
    var cv = document.createElement('canvas');
    cv.width = 900; cv.height = 900;
    var c = cv.getContext('2d');
    var s = 10, ox = 450, oy = 800;
    var eq = G.Sprites.equipFromState();
    ['idle','attack','run','hurt'].forEach(function(act){
      c.setTransform(1,0,0,1,0,0);
      c.clearRect(0,0,900,900);
      G.Sprites.hero(c, { x: ox, y: oy, s: s, ph: 1.2, moving: act === 'run', action: act, atkT: 0.4, aim: 0,
        look: G.getLook('lk_a'), equip: eq, wtype: 'blade', reach: 60 });
      var d = c.getImageData(0,0,900,900).data;
      var minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
      for (var y=0;y<900;y++) for (var x=0;x<900;x++){ if (d[(y*900+x)*4+3]>8){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } }
      out.push(act + ' 格坐标 x[' + ((minX-ox)/s).toFixed(1) + ',' + ((maxX-ox)/s).toFixed(1) + '] y[' + ((minY-oy)/s).toFixed(1) + ',' + ((maxY-oy)/s).toFixed(1) + ']');
    });
    cv.remove();
    return out.join('\\n');
  })()`));
  ws.close(); proc.kill();
  await sleep(200);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
