/* =========================================================
   余烬回廊 · 细分系统 3：任务界面
   ========================================================= */
(function (G) {
  const U = G.U, K = G.Screen;

  K.register('quests', {
    mount: function (node, params) {
      const st = G.State.state;
      const TABS = [
        { id: 'all', label: '全部' },
        { id: 'main', label: '主线' },
        { id: 'side', label: '支线' },
        { id: 'bounty', label: '悬赏' },
        { id: 'daily', label: '日常' }
      ];
      let tab = (params && params.tab) || 'all';
      G.State.syncQuestProgress();
      let focusId = (params && params.focus) || null;

      const bg = U.el('div', 'bg-layer');
      bg.appendChild(U.el('div', 'bg-grid'));
      bg.appendChild(U.el('div', 'bg-vignette'));
      node.appendChild(bg);
      node.appendChild(K.topbar({ crumb: '任务板 · 委托与赏金', backTo: 'lobby', backParams: { type: 'hub' } }));

      const wrap = U.el('div', 'sub-wrap');
      const head = U.el('div', 'sub-head');
      head.innerHTML = '<span style="width:4px;height:22px;border-radius:3px;background:linear-gradient(180deg,var(--ember),var(--ember-2));display:inline-block"></span>' +
        '<h2>任务</h2><span class="crumb">接收 → 追踪 → 完成 → 交付奖励</span>';
      const headRight = U.el('div', 'row gap8');
      head.appendChild(U.el('div', 'spacer grow'));
      headRight.innerHTML = '<span class="cur-item">' + G.Icons.coin() + '<b class="gold">' + U.commas(st.wallet.i_ember || 0) + '</b></span>';
      headRight.querySelector('svg').setAttribute('width', '18');
      headRight.querySelector('svg').setAttribute('height', '18');
      head.appendChild(headRight);
      wrap.appendChild(head);

      const body = U.el('div', 'sub-body quest-wrap');
      wrap.appendChild(body);

      /* 左：筛选 + 列表 */
      const colL = U.el('div', 'col gap12');
      const filterCard = U.el('div', 'panel');
      filterCard.style.padding = '12px 14px';
      const tabHost = U.el('div');
      filterCard.appendChild(tabHost);
      colL.appendChild(filterCard);

      const list = U.el('div', 'quest-list');
      colL.appendChild(list);
      body.appendChild(colL);

      /* 右：详情 */
      const detail = U.el('div', 'panel glow');
      body.appendChild(detail);

      node.appendChild(wrap);

      /* ---------------- 工具 ---------------- */
      function questStatus(q) {
        const s = st.quests[q.id];
        const p = Math.min(G.Quests.progress(q, st.stats, st.bag), q.target.count);
        if (!s) return { key: p >= q.target.count ? 'ready' : 'none', text: p >= q.target.count ? '可接取（已完成条件）' : '未接取', prog: p };
        if (s.state === 'claimed') return { key: 'claimed', text: '已交付', prog: q.target.count };
        if (s.state === 'done' || p >= q.target.count) return { key: 'done', text: '可交付', prog: q.target.count };
        return { key: 'doing', text: '追踪中', prog: p };
      }

      function rewardChips(q) {
        const r = q.reward || {};
        const out = [];
        if (r.exp) out.push('<span class="reward-chip">✦ EXP +' + r.exp + '</span>');
        if (r.ember) out.push('<span class="reward-chip">' + G.Icons.coin().replace('<svg', '<svg width="16" height="16"') + '+' + r.ember + '</span>');
        (r.items || []).forEach(function (it) {
          const item = G.Items.get(it.id);
          out.push('<span class="reward-chip rq-' + (item ? item.rarity : 0) + '">' +
            (item ? G.Icons.item(item).replace('<svg', '<svg width="16" height="16"') : '') + G.Items.name(it.id) + ' ×' + it.count + '</span>');
        });
        return out.join('');
      }

      /* ---------------- 列表渲染 ---------------- */
      function renderTabs() {
        U.clear(tabHost);
        const counts = { all: 0, main: 0, side: 0, bounty: 0, daily: 0 };
        G.Quests.list.forEach(function (q) {
          if ((q.lvlReq || 1) > st.account.lvl + 3) return;
          counts.all++; counts[q.kind]++;
        });
        tabHost.appendChild(K.tabs(TABS.map(function (t) { return { id: t.id, label: t.label, n: counts[t.id] }; }), tab, function (id) {
          tab = id; renderList();
        }));
      }

      function visibleQuests() {
        return G.Quests.list.filter(function (q) {
          if ((q.lvlReq || 1) > st.account.lvl + 3) return false;
          if (tab !== 'all' && q.kind !== tab) return false;
          return true;
        }).sort(function (a, b) {
          const sa = questStatus(a), sb = questStatus(b);
          const rank = { done: 0, doing: 1, ready: 2, none: 3, claimed: 4 };
          const d = rank[sa.key] - rank[sb.key];
          if (d !== 0) return d;
          return (a.lvlReq || 1) - (b.lvlReq || 1);
        });
      }

      function renderList() {
        U.clear(list);
        const qs = visibleQuests();
        if (!qs.length) {
          list.appendChild(U.el('div', 'empty-tip', '这个分类下暂时没有任务'));
          renderDetail();
          return;
        }
        qs.forEach(function (q) {
          const s = questStatus(q);
          const locked = (q.lvlReq || 1) > st.account.lvl;
          const card = U.el('div', 'quest-card' + (s.key === 'done' ? ' done' : '') + (q.id === focusId ? ' on' : ''));
          if (locked) card.style.opacity = '.55';
          card.innerHTML =
            '<div class="qc-ic" style="color:' + G.Quests.kindColor[q.kind] + '">' + q.icon + '</div>' +
            '<div class="qc-tx">' +
            '<div class="qc-t">' +
            '<span class="rarity-tag" style="color:' + G.Quests.kindColor[q.kind] + '">' + (G.QuestKindName[q.kind] || q.kind) + '</span>' +
            q.name +
            (q.repeat ? '<span class="tiny mute">· 可重复</span>' : '') +
            (locked ? '<span class="tiny red">· 需要 Lv.' + q.lvlReq + '</span>' : '') +
            '</div>' +
            '<div class="qc-d">' + q.desc + '</div>' +
            K.prog(s.prog, q.target.count, s.key === 'done' ? 'gr' : '') +
            '<div class="row" style="justify-content:space-between;margin-top:6px">' +
            '<span class="tiny ' + (s.key === 'done' ? 'green bold' : 'mute') + '">' + s.text + '　' + s.prog + ' / ' + q.target.count + '</span>' +
            '<span class="tiny mute">' + q.chapter + '</span>' +
            '</div></div>' +
            '<div class="col gap6" style="justify-content:center;align-items:flex-end">' +
            '<div class="quest-rewards">' + rewardChips(q) + '</div>' +
            '<div class="qact"></div>' +
            '</div>';

          const actBox = U.qs('.qact', card);
          if (locked) {
            actBox.innerHTML = '<span class="lock-tip">🔒 等级不足</span>';
          } else if (s.key === 'claimed') {
            actBox.innerHTML = '<span class="lock-tip">✔ 已交付</span>';
          } else if (s.key === 'done') {
            actBox.appendChild(K.btn('领取奖励', 'xs primary', function (e) {
              e.stopPropagation();
              G.State.claimQuest(q.id);
              renderAll();
            }));
          } else if (s.key === 'doing') {
            actBox.innerHTML = '<span class="tiny cyan">追踪中</span>';
          } else {
            actBox.appendChild(K.btn('接取', 'xs ghost', function (e) {
              e.stopPropagation();
              G.State.acceptQuest(q.id);
              focusId = q.id;
              renderAll();
            }));
          }

          card.onclick = function () {
            focusId = q.id;
            G.Audio.play('click');
            renderList();
            renderDetail();
          };
          list.appendChild(card);
        });
        renderDetail();
        K.bindTips(list);
      }

      /* ---------------- 详情 ---------------- */
      function renderDetail() {
        U.clear(detail);
        let q = focusId ? G.Quests.get(focusId) : null;
        if (!q) {
          const first = visibleQuests()[0];
          q = first || null;
          focusId = q ? q.id : null;
        }
        if (!q) {
          detail.innerHTML = '<div class="empty-tip" style="padding:70px 20px">暂无可查看的任务</div>';
          return;
        }
        const s = questStatus(q);
        const locked = (q.lvlReq || 1) > st.account.lvl;
        const prog = G.Quests.progress(q, st.stats, st.bag);

          const headBox = U.el('div', 'detail-hero');
        const kc = G.Quests.kindColor[q.kind] || '#ff8a3c';
        headBox.style.cssText = 'background:radial-gradient(circle at 20% 40%, color-mix(in srgb, ' + kc + ' 22%, transparent), transparent 70%)';
        headBox.innerHTML =
          '<div class="dhic" style="font-size:34px">' + q.icon + '</div>' +
          '<div><div class="detail-title">' + q.name + '</div>' +
          '<div class="detail-meta">' +
          '<span class="rarity-tag" style="color:' + kc + '">' + (G.QuestKindName[q.kind] || q.kind) + '</span>' +
          '<span class="tiny dim">' + q.chapter + '</span>' +
          '<span class="tiny dim">需要 Lv.' + (q.lvlReq || 1) + '</span>' +
          (q.repeat ? '<span class="tiny cyan">可重复接取</span>' : '') +
          '</div></div>';
        detail.appendChild(headBox);

        const b = U.el('div', 'detail-body');
        b.innerHTML =
          '<div class="small bold dim" style="letter-spacing:.12em;margin-bottom:8px">任务描述</div>' +
          '<div class="small" style="line-height:2;color:var(--txt)">' + q.desc + '</div>' +
          '<div class="small bold dim" style="letter-spacing:.12em;margin:18px 0 8px">目标进度</div>' +
          '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
          '<span class="small">' + targetText(q) + '</span>' +
          '<span class="small bold ' + (prog >= q.target.count ? 'green' : '') + '">' + Math.min(prog, q.target.count) + ' / ' + q.target.count + '</span>' +
          '</div>' +
          K.prog(Math.min(prog, q.target.count), q.target.count, prog >= q.target.count ? 'gr' : '') +
          '<div class="small bold dim" style="letter-spacing:.12em;margin:18px 0 8px">任务奖励</div>' +
          '<div class="quest-rewards">' + rewardChips(q) + '</div>' +
          '<div class="small bold dim" style="letter-spacing:.12em;margin:18px 0 8px">状态</div>' +
          '<div class="kv-row"><span class="k">当前状态</span><span class="v ' + (s.key === 'done' ? 'green' : s.key === 'doing' ? 'cyan' : '') + '">' + s.text + '</span></div>';

        /* 相关敌人信息（悬赏/主线击杀类） */
        if (q.target.enemy) {
          const e = G.Enemies.get(q.target.enemy);
          if (e) {
            b.innerHTML +=
              '<div class="small bold dim" style="letter-spacing:.12em;margin:18px 0 8px">目标资料</div>' +
              '<div class="card">' +
              '<div class="row gap8"><span class="bold">' + e.name + '</span>' +
              '<span class="sbadge">' + ({ melee: '近战', charger: '冲锋', ranged: '远程', flyer: '飞行', boss: '首领' }[e.kind] || e.kind) + '</span>' +
              '<span class="sbadge">生命 ' + e.hp + '</span><span class="sbadge">攻击 ' + e.atk + '</span></div>' +
              '<div class="small dim" style="margin-top:6px">行为：' + e.behavior + '</div>' +
              '<div class="small green" style="margin-top:4px">弱点：' + e.weak + '</div>' +
              '</div>';
          }
        }

        const acts = U.el('div', 'row gap8');
        acts.style.marginTop = '20px';
        if (locked) {
          acts.innerHTML = '<span class="lock-tip">🔒 需要等级 Lv.' + q.lvlReq + ' 才能接取</span>';
        } else if (s.key === 'claimed') {
          acts.innerHTML = '<span class="lock-tip">✔ 该任务已完成并交付</span>';
        } else if (s.key === 'done') {
          acts.appendChild(K.btn('领取奖励', 'primary', function () {
            G.State.claimQuest(q.id);
            renderAll();
          }));
        } else if (s.key === 'doing') {
          acts.appendChild(K.btn('放弃任务', 'ghost', function () {
            K.confirm('放弃任务', '放弃后进度会保留，但不再出现在追踪列表中。确定吗？', function () {
              delete st.quests[q.id];
              G.State.save();
              K.toast('已放弃任务', 'warn');
              renderAll();
            });
          }));
          acts.appendChild(K.btn('前往远征', 'primary', function () {
            K.pushHistory('quests', { tab: tab, focus: focusId });
            K.go('lobby', { type: 'stages' });
          }));
        } else {
          acts.appendChild(K.btn('接取任务', 'primary', function () {
            G.State.acceptQuest(q.id);
            renderAll();
          }));
        }
        acts.appendChild(K.btn('刷新进度', 'ghost', function () {
          G.State.syncQuestProgress();
          K.toast('任务进度已同步', 'ok');
          renderAll();
        }));
        b.appendChild(acts);
        detail.appendChild(b);
      }

      function targetText(q) {
        const t = q.target;
        const map = {
          kill: function () { const e = G.Enemies.get(t.enemy); return '击杀 ' + (e ? e.name : t.enemy); },
          killAny: function () { return '击杀任意敌人'; },
          elite: function () { return '击杀精英敌人'; },
          boss: function () { return '击败首领'; },
          room: function () { return '清空房间'; },
          run: function () { return '完成远征'; },
          stageClear: function () { return '通关指定层数'; },
          collect: function () { return '收集 ' + G.Items.name(t.item); },
          useWeapon: function () { return '使用指定类型武器击杀（' + t.wtype + '）'; }
        };
        return (map[t.type] || function () { return '完成任务目标'; })();
      }

      function renderAll() {
        renderTabs();
        renderList();
      }

      renderAll();

      /* 任务状态变化时自动刷新（交付奖励 / 战斗结束） */
      const offQ = G.State.on('quests', function () { renderAll(); });
      const obs = new MutationObserver(function () {
        if (!document.body.contains(node)) { offQ(); obs.disconnect(); }
      });
      obs.observe(document.getElementById('screen-root'), { childList: true });
    }
  });
})(window.G = window.G || {});
