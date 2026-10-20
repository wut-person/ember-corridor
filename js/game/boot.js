/* =========================================================
   余烬回廊 · 战斗场景装配（HUD / 结算 / 暂停 / 快捷键）
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  K.register('game', {
    mount: function (node, params) {
      const stageId = (params && params.stageId) || G.STAGES[0].id;
      const stage = G.STAGES.find(function (s) { return s.id === stageId; }) || G.STAGES[0];

      /* ---------- 载入过场 ---------- */
      const loading = U.el('div', 'loading-wrap',
        '<div class="loading-inner"><div class="lt">正在进入 · ' + stage.name + '</div>' +
        '<div class="lb"><i></i></div></div>');
      node.appendChild(loading);

      /* ---------- 场景 ---------- */
      const gs = U.el('div', 'game-screen');
      const stageEl = U.el('div', 'game-stage');
      const cv = U.el('canvas');
      cv.id = 'game-canvas';
      stageEl.appendChild(cv);
      gs.appendChild(stageEl);
      node.appendChild(gs);

      /* ---------- HUD ---------- */
      const hudEl = U.el('div', 'hud');
      hudEl.innerHTML =
        '<div class="hud-top">' +
        '  <div class="hud-left">' +
        '    <div class="hud-card">' +
        '      <div class="hp-row"><span class="hp-label">HP</span><div class="hp-bar"><i id="h-hp"></i><b id="h-hp-t"></b></div></div>' +
        '      <div class="hp-row" style="margin-top:6px"><span class="hp-label">体力</span><div class="hp-bar shield" style="height:11px"><i id="h-st"></i><b id="h-st-t" style="font-size:10px"></b></div></div>' +
        '      <div class="hp-row" style="margin-top:6px"><span class="hp-label">EXP</span><div class="hp-bar xp"><i id="h-xp"></i></div></div>' +
        '      <div style="margin-top:8px" class="mini-bars">' +
        '        <div class="mini" title="当前武器攻击力"><i class="st" id="h-m1" style="width:60%"></i></div>' +
        '        <div class="mini" title="本次远征击杀"><i class="po" id="h-m2" style="width:20%"></i></div>' +
        '        <div class="mini" title="本次远征伤害"><i class="em" id="h-m3" style="width:30%"></i></div>' +
        '      </div>' +
        '    </div>' +
        '    <div class="hud-weapon" id="h-weapon"></div>' +
        '  </div>' +
        '  <div class="hud-center">' +
        '    <div class="room-title" id="h-title"></div>' +
        '    <div class="room-sub" id="h-sub"></div>' +
        '    <div class="wave-note hide" id="h-note"></div>' +
        '  </div>' +
        '  <div class="hud-right">' +
        '    <div class="hud-card hud-title" id="h-title-badge"></div>' +
        '    <div class="hud-skills" id="h-skills"></div>' +
        '    <div class="hud-card" style="padding:8px 12px">' +
        '      <div class="tiny mute">W 跳 · S 下蹲/滑铲 · 左键三段 · 右键主技能 · Q 副技能 · Shift 闪避 · E 交互</div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="boss-bar hide" id="h-boss"><div class="bn" id="h-boss-n"></div><div class="bb"><i id="h-boss-hp"></i></div></div>' +
        '<div class="hud-bottom">' +
        '  <div class="pickup-log" id="h-log"></div>' +
        '</div>';
      stageEl.appendChild(hudEl);

      const el = {
        hp: U.qs('#h-hp', hudEl), hpT: U.qs('#h-hp-t', hudEl),
        st: U.qs('#h-st', hudEl), stT: U.qs('#h-st-t', hudEl),
        xp: U.qs('#h-xp', hudEl),
        m1: U.qs('#h-m1', hudEl), m2: U.qs('#h-m2', hudEl), m3: U.qs('#h-m3', hudEl),
        weapon: U.qs('#h-weapon', hudEl), skills: U.qs('#h-skills', hudEl),
        titleBadge: U.qs('#h-title-badge', hudEl),
        title: U.qs('#h-title', hudEl), sub: U.qs('#h-sub', hudEl), note: U.qs('#h-note', hudEl),
        boss: U.qs('#h-boss', hudEl), bossN: U.qs('#h-boss-n', hudEl), bossHP: U.qs('#h-boss-hp', hudEl),
        log: U.qs('#h-log', hudEl)
      };

      /* 道具栏（F 使用） */
      const itemBar = U.el('div', 'hud-skills');
      itemBar.style.marginTop = '8px';
      el.skills.parentNode.appendChild(itemBar);

      let lastSkillSig = '', lastItemSig = '';

      const hud = {
        update: function (d) {
          const hpPct = U.clamp(d.hp / d.maxHp, 0, 1) * 100;
          el.hp.style.width = hpPct + '%';
          el.hpT.textContent = d.hp + ' / ' + d.maxHp;
          el.hp.style.background = hpPct < 30
            ? 'linear-gradient(90deg,#7a1420,#ff5b6b)'
            : 'linear-gradient(90deg,#c0392b,#ff5b6b 55%,#ff8b7a)';
          const stPct = U.clamp(d.stamina / d.maxStamina, 0, 1) * 100;
          el.st.style.width = stPct + '%';
          el.stT.textContent = Math.round(d.stamina) + ' / ' + d.maxStamina;
          el.xp.style.width = U.clamp(d.exp / d.expNeed, 0, 1) * 100 + '%';
          el.m1.style.width = U.clamp((d.weapon ? d.weapon.atk : 8) / 60, 0, 1) * 100 + '%';
          el.m2.style.width = U.clamp(d.kills / 30, 0, 1) * 100 + '%';
          el.m3.style.width = U.clamp(d.dmgDone / 3000, 0, 1) * 100 + '%';

          el.title.textContent = d.stage.name;
          el.sub.textContent = '房间 ' + d.room + ' / ' + d.totalRooms + '　·　第 ' + d.wave + ' / ' + d.waves + ' 波　·　剩余敌人 ' + d.enemies + '　·　击杀 ' + d.kills;

          /* 武器卡 */
          const w = d.weapon;
          el.weapon.innerHTML = (w ? G.Icons.weapon(w) : '') +
            '<div><div class="wn ' + U.qClass(w ? w.rarity : 0) + '">' + (w ? (w.instName || w.name) : '空手') + '</div>' +
            '<div class="wd">' + (w ? ((G.WTYPE_INFO[w.wtype] || {}).label + ' · 攻击 ' + w.atk + ' · 暴击 ' + Math.round(w.crit * 100) + '%') : '拾取一把武器') + '</div></div>';

          /* 称号徽章 */
          if (d.title && el.titleBadge) {
            const pb = d.passive ? d.passive.name : '';
            el.titleBadge.innerHTML =
              '<div class="tb-cn">' + d.title.name + '</div>' +
              '<div class="tb-sub">' + (d.title.split ? '近战 / 远程双分支' : '第 ' + d.title.lvl + ' 阶称号') +
              (pb ? ' · 被动：' + pb : '') + '</div>';
          }

          /* 主技能 / 副技能 / 闪避（按键固定，效果随称号进化） */
          const sig = [d.mainSkill && d.mainSkill.name, Math.ceil(d.mainCd * 10),
                       d.skill && d.skill.name, Math.ceil(d.skillCd * 10),
                       d.dodgeSkill && d.dodgeSkill.name, Math.ceil(d.dodgeCd * 10),
                       Math.ceil(d.stamina),
                       d.mainReady ? 1 : 0, d.qReady ? 1 : 0, d.dodgeReady ? 1 : 0].join('|');
          if (sig !== lastSkillSig) {
            lastSkillSig = sig;
            function btn(key, sk, cd, hint, cls, ready) {
              if (!sk) return '';
              return '<div class="skill ' + (cd <= 0 ? 'ready' : '') + (ready ? ' cd-flash' : '') + ' ' + (cls || '') + '">' +
                '<span class="key">' + key + '</span>' +
                '<span class="sk-name">' + sk.name + '</span>' +
                (cd > 0 ? '<span class="cd">' + cd.toFixed(1) + '</span>' : '') +
                '<span class="name">' + (hint || ('体力 ' + sk.cost)) + '</span></div>';
            }
            el.skills.innerHTML =
              btn('左键', { name: '三段连招', cost: 6 }, 0, '第 ' + (d.comboStep || 1) + ' 段', 'lmb', false) +
              btn('右键', d.mainSkill, d.mainCd, '体力 ' + ((d.mainSkill && d.mainSkill.cost) || 10), 'rmb', d.mainReady) +
              btn('Q', d.skill, d.skillCd, '体力 ' + ((d.skill && d.skill.cost) || 16), 'q', d.qReady) +
              btn('Shift', d.dodgeSkill, d.dodgeCd, '体力 ' + ((d.dodgeSkill && d.dodgeSkill.cost) || 12), 'shift', d.dodgeReady);
          }

          /* 道具 */
          const isig = d.items.map(function (i) { return i.id + i.count + Math.ceil(i.cd); }).join(',');
          if (isig !== lastItemSig) {
            lastItemSig = isig;
            itemBar.innerHTML = '';
            d.items.forEach(function (it, i) {
              const sk = U.el('div', 'skill ' + (it.cd > 0 ? '' : 'ready'));
              sk.innerHTML = '<span class="key">' + (i + 1) + '</span>' +
                '<span style="width:34px;height:34px;display:block">' + G.Icons.item(it.item) + '</span>' +
                '<span class="name">×' + it.count + '</span>' +
                (it.cd > 0 ? '<span class="cd">' + it.cd.toFixed(1) + '</span>' : '');
              itemBar.appendChild(sk);
            });
            const f = U.el('div', 'skill ready');
            f.innerHTML = '<span class="key">F</span><span style="font-size:13px">使用</span>';
            itemBar.appendChild(f);
          }

          /* 首领血条 */
          if (d.boss) {
            el.boss.classList.remove('hide');
            el.bossN.textContent = d.boss.name + (d.boss.affix ? ' · ' + d.boss.affix.name : '');
            el.bossHP.style.width = U.clamp(d.boss.hp / d.boss.maxHp, 0, 1) * 100 + '%';
          } else {
            el.boss.classList.add('hide');
          }

          /* 波次提示（显示期间隐藏顶部标题，避免文字重叠） */
          if (d.note) {
            el.note.classList.remove('hide');
            el.note.innerHTML = d.note.title + '<small>' + d.note.sub + '</small>';
            el.title.style.visibility = 'hidden';
            el.sub.style.visibility = 'hidden';
          } else {
            el.note.classList.add('hide');
            el.title.style.visibility = '';
            el.sub.style.visibility = '';
          }
        },
        logPickup: function (item, count) {
          if (!item) return;
          const d = U.el('div', 'pickup rq-' + item.rarity,
            '<span style="width:20px;height:20px;display:block">' + G.Icons.item(item) + '</span>' +
            '<span class="' + U.qClass(item.rarity) + '">' + item.name + '</span><b>×' + count + '</b>');
          el.log.appendChild(d);
          setTimeout(function () {
            d.style.transition = 'opacity .3s, transform .3s';
            d.style.opacity = '0';
            d.style.transform = 'translateX(-10px)';
            setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 320);
          }, 2600);
        },
        toast: function (msg, kind) { K.toast(msg, kind); },
        pause: function (on) {
          if (on) {
            const wrap = U.el('div', 'pause-wrap');
            const card = U.el('div', 'panel pause-card', 
              '<h3>已暂停</h3><div class="mute small">' + stage.name + '</div>' +
              '<div class="keys">' +
              '<div><kbd>A</kbd><kbd>D</kbd> 左右移动　<kbd>W</kbd> 跳跃（长按更高 / 二段跳）</div>' +
              '<div><kbd>S</kbd> 下蹲 · 空中加速下落 · 奔跑中滑铲</div>' +
              '<div><kbd>鼠标左键</kbd> 三段连招（连点衔接）　<kbd>鼠标右键</kbd> 主技能</div>' +
              '<div><kbd>Q</kbd> 副技能　<kbd>Shift</kbd> 突进闪避　<kbd>E</kbd> 交互 / 拾取 / 开门</div>' +
              '<div><kbd>F</kbd> 使用道具　<kbd>1</kbd><kbd>2</kbd> 切换道具　<kbd>M</kbd> 静音　<kbd>ESC</kbd> 继续 / 暂停</div>' +
              '</div>');
            const row = U.el('div', 'row gap8');
            row.style.justifyContent = 'center';
            row.appendChild(K.btn('继续战斗', 'primary', function () {
              game.paused = false;
              game.syncPause();
            }));
            row.appendChild(K.btn('重新开始', 'ghost', function () {
              game.restart();
            }));
            row.appendChild(K.btn('放弃并结算', 'danger', function () {
              K.confirm('放弃远征', '当前进度会结算为失败，已获得的掉落与余烬保留。确定吗？', function () {
                game.paused = false;
                game.over = true;
                game.result = 'quit';
                game.showResult(false);
              });
            }));
            card.appendChild(row);
            wrap.appendChild(card);
            stageEl.appendChild(wrap);
            el.__pause = wrap;
          } else if (el.__pause && el.__pause.parentNode) {
            el.__pause.parentNode.removeChild(el.__pause);
            el.__pause = null;
          }
        },
        result: function (stats, onAction) {
          const wrap = U.el('div', 'result-wrap');
          const card = U.el('div', 'panel result-card');
          const win = stats.win;
          const drops = Object.keys(stats.drops || {}).map(function (id) {
            const it = G.Items.get(id);
            return '<div class="rstat rq-' + (it ? it.rarity : 0) + '" style="padding:8px 10px">' +
              '<div style="width:34px;height:34px;margin:0 auto 4px">' + G.Icons.item(it) + '</div>' +
              '<div class="small ' + U.qClass(it ? it.rarity : 0) + '">' + (it ? it.name : id) + '</div>' +
              '<div class="tiny mute">×' + stats.drops[id] + '</div></div>';
          }).join('');
          card.innerHTML =
            '<div class="result-title">' + (win ? '远征成功' : (stats.win === false && stats.kills > 0 ? '倒在途中' : '远征结束')) + '</div>' +
            '<div class="result-sub">' + stats.stage.name + '　·　到达房间 ' + stats.room + ' / ' + stats.totalRooms + '</div>' +
            '<div class="result-stats">' +
            '  <div class="rstat"><div class="rv ember">' + U.commas(stats.kills) + '</div><div class="rk">击杀</div></div>' +
            '  <div class="rstat"><div class="rv" style="color:#c07cff">' + stats.elites + '</div><div class="rk">精英</div></div>' +
            '  <div class="rstat"><div class="rv" style="color:#ffd479">' + stats.bosses + '</div><div class="rk">首领</div></div>' +
            '  <div class="rstat"><div class="rv cyan">' + U.commas(stats.damage) + '</div><div class="rk">造成伤害</div></div>' +
            '  <div class="rstat"><div class="rv" style="color:#ff6b6b">' + U.commas(stats.taken) + '</div><div class="rk">承受伤害</div></div>' +
            '  <div class="rstat"><div class="rv gold">' + U.commas(stats.ember) + '</div><div class="rk">获得余烬</div></div>' +
            '  <div class="rstat"><div class="rv">' + stats.time + 's</div><div class="rk">用时</div></div>' +
            '</div>' +
            (drops ? '<div class="tiny mute center" style="letter-spacing:.16em;margin-bottom:10px">本次拾取</div><div class="result-drops">' + drops + '</div>' : '') +
            '<div class="result-actions"></div>';
          const acts = U.qs('.result-actions', card);
          acts.appendChild(K.btn('🔁 再来一次', 'primary', function () { onAction('retry'); }));
          acts.appendChild(K.btn('🏛️ 返回大厅', 'ghost', function () {
            K.clearHistory();
            K.go('lobby', { type: 'hub' });
          }));
          acts.appendChild(K.btn('🏠 主界面', 'ghost', function () {
            K.clearHistory();
            K.go('home');
          }));
          wrap.appendChild(card);
          stageEl.appendChild(wrap);
        },
        cleanup: function () {
          if (el.__pause && el.__pause.parentNode) el.__pause.parentNode.removeChild(el.__pause);
        },
        build: function () { }
      };

      /* ---------- 启动 ---------- */
      const game = new G.Game(cv, hud);
      G.__game = game;
      setTimeout(function () {
        if (!document.body.contains(node)) return;
        if (loading.parentNode) loading.parentNode.removeChild(loading);
        /* 战斗中隐藏界面提示流，避免遮挡右侧技能栏 */
        const tl = document.getElementById('toast-layer');
        if (tl) { U.clear(tl); tl.style.display = 'none'; }
        /* game.start() 内部会调用 syncHud()，HUD 数据完全由引擎提供，避免二次覆盖 */
        game.start(stage.id);
        game.syncHud();
      }, 900);

      /* 静音快捷键 */
      const mk = function (e) {
        if (e.key.toLowerCase() === 'm') {
          const on = G.Audio.toggle();
          K.toast('音效已' + (on ? '开启' : '关闭'), 'ok');
        }
      };
      window.addEventListener('keydown', mk);

      /* 离开界面时清理 */
      const obs = new MutationObserver(function () {
        if (!document.body.contains(node)) {
          game.stop();
          window.removeEventListener('keydown', mk);
          const tl = document.getElementById('toast-layer');
          if (tl) tl.style.display = '';
          obs.disconnect();
        }
      });
      obs.observe(document.getElementById('screen-root'), { childList: true });
    }
  });
})(window.G = window.G || {});
