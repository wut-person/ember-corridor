/* =========================================================
   余烬回廊 · 界面 2：登录后的主界面
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  K.register('home', {
    mount: function (node) {
      const st = G.State.state;
      const look = G.getLook(st.account.look);
      const t = G.State.totals();

      /* 背景 */
      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);
      U.emberField(bg, 24, { cyan: true });

      node.appendChild(K.topbar({}));

      const wrap = U.el('div', 'home-wrap');

      /* ---------------- 左栏：玩家档案 ---------------- */
      const left = U.el('div', 'side-col');
      const pCard = K.panel('驯火者档案', 'glow');
      const pb = K.panelBody(pCard);
      const need = G.State.expNeed(st.account.lvl);
      pb.innerHTML =
        '<div class="row gap12" style="margin-bottom:14px">' +
        '<div style="width:56px;height:56px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,138,60,.5);display:grid;place-items:center;background:rgba(0,0,0,.35)" class="pav-big"></div>' +
        '<div style="min-width:0">' +
        '<div class="bold" style="font-size:15px">' + U.esc(st.account.name) + '</div>' +
        '<div class="mute tiny">' + U.esc(st.account.server) + '</div>' +
        '<div class="gold tiny">' + look.title + '</div>' +
        '</div></div>' +
        '<div class="row" style="justify-content:space-between;font-size:11.5px;margin-bottom:5px">' +
        '<span class="dim">等级 Lv.' + st.account.lvl + '</span>' +
        '<span class="mute">' + st.account.exp + ' / ' + need + ' EXP</span></div>' +
        K.prog(st.account.exp, need);

      const statBox = U.el('div');
      statBox.style.marginTop = '14px';
      statBox.innerHTML =
        '<div class="kv-row"><span class="k">战力评估</span><span class="v ember">' + U.commas(G.State.power()) + '</span></div>' +
        '<div class="kv-row"><span class="k">攻击力</span><span class="v">' + t.atk + '</span></div>' +
        '<div class="kv-row"><span class="k">生命 / 体力</span><span class="v">' + t.maxHp + ' / ' + t.stamina + '</span></div>' +
        '<div class="kv-row"><span class="k">防御 / 暴击</span><span class="v">' + t.def + ' / ' + Math.round(t.crit * 100) + '%</span></div>' +
        '<div class="kv-row"><span class="k">移动加成</span><span class="v">' + (t.spd > 0 ? '+' : '') + Math.round(t.spd * 100) + '%</span></div>';
      pb.appendChild(statBox);
      left.appendChild(pCard);

      /* 战绩 */
      const sCard = K.panel('远征记录');
      const sb = K.panelBody(sCard);
      const s = st.stats;
      sb.innerHTML =
        '<div class="kv-row"><span class="k">总击杀</span><span class="v">' + U.commas(s.kills) + '</span></div>' +
        '<div class="kv-row"><span class="k">精英 / 首领</span><span class="v">' + s.elites + ' / ' + s.bosses + '</span></div>' +
        '<div class="kv-row"><span class="k">清空房间</span><span class="v">' + s.rooms + '</span></div>' +
        '<div class="kv-row"><span class="k">通关次数</span><span class="v green">' + s.wins + '</span></div>' +
        '<div class="kv-row"><span class="k">最高层数</span><span class="v cyan">第 ' + Math.max(1, s.bestDepth) + ' 层</span></div>';
      left.appendChild(sCard);

      /* 图鉴小卡 */
      const gCard = K.panel('回廊图鉴');
      const gb = K.panelBody(gCard);
      gb.innerHTML =
        '<div class="kv-row"><span class="k">武器收集</span><span class="v">' + st.ownedWeapons.length + ' / ' + G.Weapons.list.length + '</span></div>' +
        '<div class="kv-row"><span class="k">衣物收集</span><span class="v">' + st.ownedClothing.length + ' / ' + G.Clothing.list.length + '</span></div>' +
        '<div class="kv-row"><span class="k">可接任务</span><span class="v">' + G.Quests.available(st.account.lvl).length + '</span></div>';
      gb.appendChild(U.el('div', 'lock-tip', '<span>💡 提示：大厅的每个互动点都能打开对应系统</span>'));
      left.appendChild(gCard);
      wrap.appendChild(left);

      /* ---------------- 中间：英雄舞台 + 主菜单 ---------------- */
      const mid = U.el('div', 'col gap12');
      mid.style.minHeight = '0';

      const stage = U.el('div', 'panel hero-stage');
      stage.style.flex = '1';
      stage.style.minHeight = '470px';
      stage.appendChild(U.el('div', 'stage-glow'));
      stage.appendChild(U.el('div', 'stage-ring'));
      const cv = U.el('canvas', 'hero-canvas');
      stage.appendChild(cv);
      stage.appendChild(U.el('div', 'hero-name', U.esc(st.account.name)));
      stage.appendChild(U.el('div', 'hero-title', look.title));
      stage.appendChild(U.el('div', 'hero-quote', '“' + look.quote.replace(/[“”]/g, '') + '”'));

      const stageFoot = U.el('div', 'row gap8');
      stageFoot.style.marginTop = '14px';
      stageFoot.style.position = 'relative';
      stageFoot.style.zIndex = '3';
      stageFoot.appendChild(K.btn('🪞 更换外貌', 'sm ghost', function () { K.pushHistory('home'); K.go('character'); }));
      stageFoot.appendChild(K.btn('⚒️ 铁砧强化', 'sm ghost', function () { K.pushHistory('home'); K.go('mods'); }));
      stage.appendChild(stageFoot);
      mid.appendChild(stage);

      /* 主菜单 */
      const menu = U.el('div', 'panel');
      const mb = K.panelBody(menu);
      mb.style.padding = '14px';
      const list = U.el('div', 'menu-list');

      const items = [
        { icon: '🗺️', t: '继续远征', d: '选择层数，直接进入横板关卡', cls: 'hero-cta', go: ['lobby'] },
        { icon: '🏛️', t: '进入大厅', d: '营地互动：任务板 / 铁砧 / 补给箱 / 试衣镜', go: ['lobby'] },
        { icon: '📜', t: '任务界面', d: '主线 · 支线 · 悬赏 · 每日', go: ['quests'] },
        { icon: '🎒', t: '背包与武器', d: '查看装备、武器招式与词条', go: ['inventory'] },
        { icon: '🧍', t: '角色与衣物', d: '换装、外观、天赋改造', go: ['character'] }
      ];
      items.forEach(function (it) {
        const mi = U.el('div', 'menu-item ' + (it.cls || ''),
          '<div class="mi-ic">' + it.icon + '</div>' +
          '<div class="mi-tx"><div class="mi-t">' + it.t + '</div><div class="mi-d">' + it.d + '</div></div>' +
          '<div class="mi-go">›</div>');
        mi.onclick = function () {
          G.Audio.play('ui_open');
          K.pushHistory('home');
          K.go(it.go[0]);
        };
        list.appendChild(mi);
      });
      mb.appendChild(list);
      mid.appendChild(menu);
      wrap.appendChild(mid);

      /* ---------------- 右栏：任务追踪 + 提示 ---------------- */
      const right = U.el('div', 'side-col');
      const qCard = K.panel('任务追踪', 'glow');
      const qh = U.qs('.panel-head', qCard);
      const more = K.btn('全部 ›', 'xs ghost', function () { K.pushHistory('home'); K.go('quests'); });
      qh.appendChild(more);
      const qb = K.panelBody(qCard);
      const tracks = G.State.trackedQuests(3);
      if (!tracks.length) {
        qb.innerHTML = '<div class="empty-tip" style="padding:26px 0">暂无追踪中的任务<br><span class="tiny">去任务板接取一个吧</span></div>';
        qb.appendChild(K.btn('前往任务板', 'sm primary block', function () { K.pushHistory('home'); K.go('quests'); }));
      } else {
        tracks.forEach(function (tr) {
          const q = tr.q;
          const row = U.el('div', 'track-item');
          row.innerHTML =
            '<div class="tk-ic">' + q.icon + '</div>' +
            '<div class="tk-tx">' +
            '<div class="tk-t"><span style="color:' + (G.Quests.kindColor[q.kind] || '#ff8a3c') + '">' + (G.Quests.kindIcon[q.kind] || '📜') + '</span> ' + q.name + '</div>' +
            '<div class="tk-d">' + q.desc.slice(0, 22) + (q.desc.length > 22 ? '…' : '') + '</div>' +
            K.prog(tr.cur, q.target.count) +
            '<div class="row" style="justify-content:space-between;margin-top:4px">' +
            '<span class="tiny mute">' + tr.cur + ' / ' + q.target.count + '</span>' +
            (tr.done ? '<span class="tiny green">可交付 ✓</span>' : '<span class="tiny mute">进行中</span>') +
            '</div></div>';
          row.onclick = function () { K.pushHistory('home'); K.go('quests', { focus: q.id }); };
          qb.appendChild(row);
        });
      }
      right.appendChild(qCard);

      /* 每日/悬赏快捷 */
      const bCard = K.panel('今日委托');
      const bb = K.panelBody(bCard);
      const dailies = G.Quests.byKind('daily');
      dailies.slice(0, 3).forEach(function (q) {
        const p = Math.min(G.Quests.progress(q, st.stats, st.bag), q.target.count);
        const line = U.el('div', 'kv-row');
        line.innerHTML = '<span class="k">' + q.icon + ' ' + q.name.replace('每日：', '') + '</span><span class="v ' + (p >= q.target.count ? 'green' : 'dim') + '">' + p + '/' + q.target.count + '</span>';
        bb.appendChild(line);
      });
      bb.appendChild(K.btn('领取每日奖励', 'sm primary block', function () {
        K.pushHistory('home');
        K.go('quests', { tab: 'daily' });
      }));
      right.appendChild(bCard);

      /* 公告 */
      const nCard = K.panel('回廊公告');
      const nb = K.panelBody(nCard);
      nb.innerHTML =
        '<div class="small dim" style="line-height:2">' +
        '· 第一版原型：登录 → 主界面 → 大厅 → 关卡 全流程可玩<br>' +
        '· 武器 16 种，招式与被动各不相同<br>' +
        '· 精英词缀 5 种，首领 3 种<br>' +
        '· 进度保存在本机浏览器（localStorage）<br>' +
        '</div>';
      nb.appendChild(K.btn('重置存档', 'xs ghost', function () {
        K.confirm('重置存档', '这会清空所有装备、等级与任务进度，且无法恢复。确定吗？', function () {
          G.State.reset();
          K.toast('存档已重置', 'ok');
          K.clearHistory();
          K.go('login');
        });
      }));
      right.appendChild(nCard);
      wrap.appendChild(right);

      node.appendChild(wrap);

      /* 头像 & 大立绘 */
      let stopHero = null;
      function drawDoll() {
        if (stopHero) stopHero();
        const avail = Math.max(230, (stage.getBoundingClientRect().height || 340) - 168);
        stopHero = K.doll(cv, 4.5, null, true, avail);
      }
      requestAnimationFrame(function () {
        const pav = U.qs('.pav-big', pb);
        if (pav) {
          const c = U.el('canvas');
          pav.appendChild(c);
          const hs = K.doll(c, 2.6, null, true);
          K.onUnmount(hs);
        }
        drawDoll();
      });
      K.onResize(U.debounce(drawDoll, 160));
      K.onUnmount(function () { if (stopHero) stopHero(); });
    }
  });
})(window.G = window.G || {});
