/* =========================================================
   余烬回廊 · 程序化音效（WebAudio，无外部资源）
   ========================================================= */
(function (G) {
  const A = { enabled: true, ctx: null, master: null };

  function ctx() {
    if (!A.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { A.enabled = false; return null; }
        A.ctx = new AC();
        A.master = A.ctx.createGain();
        A.master.gain.value = 0.28;
        A.master.connect(A.ctx.destination);
      } catch (e) { A.enabled = false; return null; }
    }
    if (A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) { } }
    return A.ctx;
  }

  function tone(opt) {
    if (!A.enabled) return;
    const c = ctx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1 && opt.f1 !== opt.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t + (opt.dur || 0.16));
    const vol = (opt.vol == null ? 0.3 : opt.vol);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.16));
    osc.connect(gain); gain.connect(A.master);
    osc.start(t); osc.stop(t + (opt.dur || 0.16) + 0.03);
  }

  function noise(opt) {
    if (!A.enabled) return;
    const c = ctx();
    if (!c) return;
    const dur = opt.dur || 0.14;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, opt.decay || 1.6);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = opt.filter || 'lowpass';
    filter.frequency.value = opt.freq || 1200;
    const gain = c.createGain();
    gain.gain.value = opt.vol == null ? 0.25 : opt.vol;
    src.connect(filter); filter.connect(gain); gain.connect(A.master);
    src.start();
  }

  const SFX = {
    hover: function () { tone({ type: 'sine', f0: 620, f1: 820, dur: 0.07, vol: 0.06 }); },
    click: function () { tone({ type: 'triangle', f0: 380, f1: 640, dur: 0.1, vol: 0.16 }); },
    back: function () { tone({ type: 'triangle', f0: 420, f1: 240, dur: 0.11, vol: 0.14 }); },
    login: function () {
      tone({ type: 'sine', f0: 420, f1: 660, dur: 0.16, vol: 0.16 });
      setTimeout(function () { tone({ type: 'sine', f0: 660, f1: 990, dur: 0.22, vol: 0.13 }); }, 120);
    },
    swing: function () { noise({ dur: 0.11, freq: 2400, filter: 'highpass', vol: 0.16, decay: 2.2 }); },
    hit: function () {
      noise({ dur: 0.09, freq: 900, vol: 0.22 });
      tone({ type: 'square', f0: 180, f1: 90, dur: 0.08, vol: 0.1 });
    },
    crit: function () {
      noise({ dur: 0.14, freq: 1600, vol: 0.26 });
      tone({ type: 'square', f0: 520, f1: 200, dur: 0.14, vol: 0.14 });
    },
    hurt: function () { tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.2, vol: 0.18 }); },
    die: function () { tone({ type: 'sawtooth', f0: 160, f1: 40, dur: 0.45, vol: 0.2 }); },
    shoot: function () { tone({ type: 'square', f0: 780, f1: 320, dur: 0.08, vol: 0.11 }); },
    cast: function () { tone({ type: 'sine', f0: 300, f1: 900, dur: 0.26, vol: 0.14 }); },
    dash: function () { noise({ dur: 0.16, freq: 1500, filter: 'bandpass', vol: 0.14, decay: 1.4 }); },
    pickup: function () { tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.1, vol: 0.13 }); },
    coin: function () { tone({ type: 'square', f0: 1046, f1: 1568, dur: 0.09, vol: 0.1 }); },
    ui_open: function () { tone({ type: 'sine', f0: 300, f1: 620, dur: 0.14, vol: 0.12 }); },
    clear: function () {
      tone({ type: 'sine', f0: 520, f1: 780, dur: 0.18, vol: 0.15 });
      setTimeout(function () { tone({ type: 'sine', f0: 780, f1: 1046, dur: 0.26, vol: 0.13 }); }, 140);
    },
    wave: function () { tone({ type: 'sawtooth', f0: 140, f1: 260, dur: 0.34, vol: 0.13 }); },
    levelup: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'sine', f0: f, f1: f * 1.02, dur: 0.2, vol: 0.15 }); }, i * 90);
      });
    },
    quest: function () {
      [660, 880].forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'triangle', f0: f, f1: f, dur: 0.16, vol: 0.14 }); }, i * 110);
      });
    }
  };

  A.play = function (name) {
    const f = SFX[name];
    if (f) { try { f(); } catch (e) { } }
  };
  A.setEnabled = function (v) { A.enabled = !!v; };
  A.toggle = function () { A.enabled = !A.enabled; if (A.enabled) A.play('click'); return A.enabled; };
  A.unlock = function () { ctx(); };

  G.Audio = A;
})(window.G = window.G || {});
