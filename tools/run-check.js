'use strict';
const { spawn } = require('child_process');
const path = require('path'); const os = require('os'); const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 9501;
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async function () {
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run','--mute-audio','--remote-debugging-port='+PORT,'--user-data-dir='+path.join(os.tmpdir(),'edge-run-'+Date.now()),'--window-size=1440,900','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
  for (let i=0;i<40;i++){ try { await (await fetch('http://127.0.0.1:'+PORT+'/json/version')).json(); break; } catch(e){ await sleep(300);} }
  const tabs = await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();
  const ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r));
  let id=0; const pend=new Map(); const errs=[]; const logs=[];
  ws.addEventListener('message', e=>{ const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}
    if(m.method==='Runtime.exceptionThrown') errs.push(((m.params.exceptionDetails.exception||{}).description)||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type!=='log') logs.push('['+m.params.type+'] '+m.params.args.map(a=>a.value||a.description||a.type).join(' '));});
  const send=(method,params)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params:params||{}}));});
  const ev=async(fn)=>{const r=await send('Runtime.evaluate',{expression:'('+fn.toString()+')()',returnByValue:true,awaitPromise:true});
    if(r&&r.exceptionDetails) return 'EXC: '+((r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text);
    return r?r.result.value:'NORESULT';};
  const shot=async(n)=>{const s=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(ROOT,'tools','shots','run-'+n+'.png'),Buffer.from(s.data,'base64'));};
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:PAGE_URL}); await sleep(3500);
  console.log('1) 登录界面      ' + await ev(function(){return '标题=' + (document.querySelector('.brand, .logo, h1') ? 'ok' : '?') + ' 输入框=' + document.querySelectorAll('.login-panel input.input').length;}));
  await shot('01-login');
  await ev(function(){const i=document.querySelector('.login-panel input.input'); if(i)i.value='验收'; const b=document.querySelector('.login-panel .btn.primary'); if(b)b.click(); return 1;});
  await sleep(1800);
  console.log('2) 主界面        ' + await ev(function(){return '界面=' + G.Screen.screen + ' 菜单=' + document.querySelectorAll('.menu-item, .home-menu > *').length;}));
  await shot('02-home');
  await ev(function(){ G.Screen.go('character',{}); return 1; });
  await sleep(1800);
  console.log('3) 人物选择      ' + await ev(function(){return '性别按钮=' + document.querySelectorAll('.sex-btn').length + ' 角色卡=' + document.querySelectorAll('.look-card').length;}));
  /* 选女性骑士，触发旋转 */
  const pick = await ev(function(){
    const bs = document.querySelectorAll('.sex-btn');
    for (const b of bs) if (b.textContent.indexOf('女') >= 0) b.click();
    return new Promise(function(res){
      setTimeout(function(){
        const cards = document.querySelectorAll('.look-card');
        cards[3].click();
        res('已选 ' + cards[3].querySelector('.look-tag').textContent + ' 存档=' + G.State.state.account.look);
      }, 600);
    });
  });
  console.log('4) 选择人物      ' + pick);
  await sleep(700); await shot('03-spin');
  await sleep(1400);
  console.log('5) 旋转结束      ' + await ev(function(){return '提示隐藏=' + (document.querySelector('.spin-badge').style.display === 'none') + ' 精灵图=' + JSON.stringify(G.Sprites.sheetDebug().loaded['lk_d_f']);}));
  await shot('04-picked');
  /* 进大世界 */
  await ev(function(){ G.Screen.go('lobby',{type:'hub'}); return 1; });
  await sleep(1500);
  await ev(function(){ G.Screen.go('world',{}); return 1; });
  await sleep(2200);
  console.log('6) 大世界        ' + await ev(function(){return '世界=' + G.__world.world.size + '² 出生=' + G.__world.world.spawn.x + ',' + G.__world.world.spawn.y + ' 贴图=' + G.Sprites.sheetDebug().loaded['lk_d_f'];}));
  await shot('05-world');
  /* 走一段 */
  await ev(function(){ G.__world.keys['d']=true; return 1; });
  await sleep(2000);
  await ev(function(){ G.__world.keys['d']=false; return 1; });
  await sleep(400);
  console.log('7) 漫游后        ' + await ev(function(){const p=G.__world.player; return '坐标=' + Math.round(p.x) + ',' + Math.round(p.y) + ' 朝向=' + (Math.cos(p.aim)>0?'右':'左');}));
  await shot('06-world-move');
  /* 开地图 */
  await ev(function(){ G.__world.toggleMap(); return 1; });
  await sleep(900);
  console.log('8) 世界地图      ' + await ev(function(){return '已打开=' + G.MapView.isOpen + ' 缩放=' + G.MapView.zoom.toFixed(2);}));
  await shot('07-map');
  await ev(function(){ G.__world.toggleMap(); return 1; });
  await sleep(700);
  /* 回大厅 */
  await ev(function(){ G.Screen.go('home',{}); return 1; });
  await sleep(1200);
  console.log('9) 返回主界面    ' + await ev(function(){return '界面=' + G.Screen.screen + ' 存档已写=' + (localStorage.getItem(G.State.KEY) ? '是' : '否');}));
  await sleep(600);
  console.log('');
  console.log('运行时异常 = ' + errs.length + ' 条' + (errs.length ? ' → ' + errs[0].slice(0,160) : ''));
  console.log('控制台告警 = ' + logs.length + ' 条' + (logs.length ? ' → ' + logs.slice(0,3).join(' | ').slice(0,200) : ''));
  ws.close(); proc.kill(); await sleep(200); process.exit(errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});