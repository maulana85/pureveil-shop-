/* Pure Veil Jordan — one cart shared by every product page.
 * Every modal type in group A shares one offer (1 = 4, 2 = 7, 3 = 10, 4 = 10 JOD: the 4th is a gift; then 2 JOD per extra piece, owner 31/10/2026),
 * mixing types is allowed, and delivery is charged once: Amman 2.5 JOD, other governorates 3 JOD.
 * The server (Order API JO) recomputes every price; this file only displays them. */
(function () {
  var KEY = 'pv_jo_cart_v1', TTL = 3 * 864e5, GKEY = 'pv_jo_gov_v1';
  var API = 'https://script.google.com/macros/s/AKfycbyYF-qbK6z-gjKINzIiSQycFdAIwYJ6jNtxYY1oOnWeuAnpRzuhjZCNlzHOU3U_kHz5cg/exec';
  var GROUPS = {
    A: { tiers: [0, 4, 7, 10, 10], old: [0, 4, 8, 12, 16], extra: 2, label: 'أنواع المودال' },
    // Chiffon with qamta: 1 = 5, 2 = 8, 3 = 10 JOD, then 3 JOD per extra piece (owner, 31/10/2026). Not mixed with modal.
    B: { tiers: [0, 5, 8, 10], old: [0, 5, 10, 15], extra: 3 }
  };
  // Keys are the Model Code column of the 'products' sheet.
  var MODELS = {
    'TH': { name: 'مودال تايلندي', path: 'thai',     g: 'A', img: 'thai/model.jpg' },
    'SP': { name: 'مودال إسفنجي',  path: 'sponge',   g: 'A', img: 'sponge/model.jpg' },
    'MK': { name: 'مودال مكسّر',   path: 'mukassar', g: 'A', img: 'mukassar/model.jpg', soon: true },
    'FR': { name: 'مودال فروزن',   path: 'frozen',   g: 'A', img: 'frozen/model.jpg', soon: true },
    'CH': { name: 'شيفون سوفت مع قمطة', path: 'chiffon', g: 'B', img: 'chiffon/model.jpg' }
  };
  var ORDER = ['TH', 'CH', 'SP', 'MK', 'FR'];
  // Governorate value = the English name the Orders sheet and the courier already use; label = Arabic.
  var GOVS = [['Amman', 'عمّان'], ['Zarqa', 'الزرقاء'], ['Irbid', 'إربد'], ['Balqa', 'البلقاء (السلط)'], ['Madaba', 'مادبا'],
    ['Mafraq', 'المفرق'], ['Jerash', 'جرش'], ['Ajloun', 'عجلون'], ['Karak', 'الكرك'], ['Tafila', 'الطفيلة'], ['Maan', 'معان'], ['Aqaba', 'العقبة']];
  function feeFor(gov) { return !gov ? null : gov === 'Amman' ? 2.5 : 3; }
  var mem = {}, gmem = '';

  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.c && Date.now() - o.t < TTL) return o.c;
    } catch (e) {}
    return mem;
  }
  function write(c) {
    var out = {};
    Object.keys(c).forEach(function (m) {
      if (!MODELS[m]) return;
      Object.keys(c[m] || {}).forEach(function (n) {
        var q = parseInt(c[m][n], 10);
        if (q > 0) { out[m] = out[m] || {}; out[m][n] = q; }
      });
    });
    mem = out;
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), c: out })); } catch (e) {}
    return out;
  }
  function getGov() { try { return localStorage.getItem(GKEY) || gmem; } catch (e) { return gmem; } }
  // Up to the offer size: the ladder. After it: every extra piece at the group's flat 'extra' price.
  // Without 'extra' (the struck-through single prices) the ladder repeats.
  function price(t, q, extra) {
    var n = t.length - 1;
    if (extra && q > n) return t[n] + (q - n) * extra;
    return Math.floor(q / n) * t[n] + t[q % n];
  }
  function gprice(g, q) { return price(GROUPS[g].tiers, q, GROUPS[g].extra); }
  function sum(o) { return Object.keys(o || {}).reduce(function (a, n) { return a + o[n]; }, 0); }
  function num(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function fmt(n) { var r = Math.round(n * 100) / 100; return num(n) + (r >= 3 && r <= 10 && r === Math.floor(r) ? ' دنانير' : ' دينار'); }
  function unit(q) { return q === 1 ? 'قطعة' : q === 2 ? 'قطعتين' : q + ' قطع'; }

  var api = {
    MODELS: MODELS, GOVS: GOVS, feeFor: feeFor, fmt: fmt, num: num, unit: unit,
    get: function (m) { var c = read()[m] || {}, o = {}; Object.keys(c).forEach(function (n) { o[+n] = c[n]; }); return o; },
    set: function (m, sel) { var c = read(); c[m] = sel; write(c); },
    setQty: function (m, n, q) { var c = read(); c[m] = c[m] || {}; c[m][n] = q; write(c); },
    clear: function () { write({}); refreshUI(); },
    gov: getGov,
    setGov: function (g) { gmem = g || ''; try { localStorage.setItem(GKEY, gmem); } catch (e) {} },
    last: function (m) { try { if (m) localStorage.setItem(KEY + '_last', m); return localStorage.getItem(KEY + '_last') || ''; } catch (e) { return m || ''; } },
    /** Everything in the cart, priced. delivery is null until a governorate is chosen. */
    totals: function () {
      var c = read(), lines = [], groups = {}, qty = 0, total = 0, old = 0;
      ORDER.forEach(function (m) {
        var q = sum(c[m]); if (!q) return;
        var info = MODELS[m];
        lines.push({ model: m, name: info.name, path: info.path, g: info.g, qty: q, colors: c[m] });
        groups[info.g] = (groups[info.g] || 0) + q; qty += q;
      });
      Object.keys(groups).forEach(function (g) { total += gprice(g, groups[g]); old += price(GROUPS[g].old, groups[g]); });
      var fee = qty ? feeFor(getGov()) : 0;
      return { lines: lines, groups: groups, qty: qty, total: total, old: old, delivery: fee,
               cod: total + (fee || 0), label: unit(qty) };
    },
    /** Body lines for the Order API. */
    lines: function () {
      return api.totals().lines.map(function (l) {
        return { model: l.model, items: Object.keys(l.colors).map(function (n) { return { color: +n, qty: l.colors[n] }; }) };
      });
    },
    /** "Add one more for X" hint for the group of model m. */
    nudge: function (m) {
      var g = MODELS[m].g, G = GROUPS[g], n = G.tiers.length - 1, q = api.totals().groups[g] || 0;
      if (!q) return 'اكبسي على اللون اللي بيعجبك';
      if (q >= n) return 'وفّرتي ' + fmt(price(G.old, q) - gprice(g, q)) + ' 🎉 وكل قطعة زيادة بـ ' + fmt(G.extra);
      var left = n - q, add = gprice(g, n) - gprice(g, q);
      if (!add) return 'القطعة الرابعة هدية 🎁 اختاري لونها من أي نوع';
      return 'زيدي ' + (left === 1 ? 'قطعة وحدة' : unit(left)) + (G.label ? ' من أي نوع' : '') + ' بـ ' + fmt(add) + ' بس 🎁';
    },
    /** Lines of the other products already in the cart (for the current page). */
    othersHTML: function (m) {
      var others = api.totals().lines.filter(function (l) { return l.model !== m; });
      if (!others.length) return '';
      return '<div class="others"><b>بسلتك كمان:</b> ' + others.map(function (l) {
        return '<a href="../' + l.path + '/">' + l.name + ' × ' + l.qty + ' <u>تعديل</u></a>';
      }).join('') + '</div>';
    },
    /** Order summary rows (whole cart). */
    sumHTML: function () {
      var T = api.totals();
      var rows = T.lines.map(function (l) {
        return '<div class="ln"><span>' + l.name + '</span><span>' + Object.keys(l.colors).sort(function (a, b) { return a - b; })
          .map(function (n) { return 'لون ' + n + (l.colors[n] > 1 ? ' ×' + l.colors[n] : ''); }).join('، ') + '</span></div>';
      }).join('');
      return rows
        + '<div><span>القطع (' + T.qty + ')</span><span><s>' + (T.qty && T.old > T.total ? fmt(T.old) : '') + '</s> ' + fmt(T.total) + '</span></div>'
        + (T.qty && T.old > T.total ? '<div class="save"><span>خصم العرض</span><span>− ' + fmt(T.old - T.total) + '</span></div>' : '')
        + (T.delivery == null
          ? '<div><span>التوصيل</span><span>عمّان 2.5 · المحافظات 3</span></div>'
          : '<div><span>التوصيل' + (T.lines.length > 1 ? ' (مرة وحدة)' : '') + '</span><span>' + fmt(T.delivery) + '</span></div>')
        + '<div class="tot"><span>المجموع عند الاستلام</span><span>' + (T.delivery == null ? fmt(T.total) + ' + التوصيل' : fmt(T.cod)) + '</span></div>';
    }
  };
  /** Upsell box shown at the top of the order form (step 2). */
  api.upsellHTML = function (m) {
    var T = api.totals(), g = MODELS[m].g, G = GROUPS[g], n = G.tiers.length - 1, q = T.groups[g] || 0;
    if (!T.qty) return '';
    var card = function (k) {
      var x = MODELS[k];
      return '<a class="up-p" href="../' + x.path + '/"><img src="../' + x.img + '" alt="" loading="lazy"><span>' + x.name + '</span></a>';
    };
    var same = ORDER.filter(function (k) { return MODELS[k].g === g && k !== m && !MODELS[k].soon; });
    if (q && q < n) {
      var left = n - q, add = gprice(g, n) - gprice(g, q);
      return '<div class="upsell"><b>🎁 ' + (!add ? 'القطعة الرابعة إلك هدية! اختاري لونها'
          : 'زيدي ' + (left === 1 ? 'قطعة وحدة' : unit(left)) + ' بـ ' + fmt(add) + ' بس') + '</b>'
        + '<small>وبيصير عندك ' + unit(n) + ' بـ ' + fmt(gprice(g, n)) + '، والتوصيل نفسه.' + (G.label ? ' بتقدري تخلطي بين الأنواع.' : '') + '</small>'
        + '<div class="up-row"><a class="up-p up-here" href="#pick"><span>⬆ من نفس الألوان</span></a>' + same.map(card).join('') + '</div></div>';
    }
    return '<div class="upsell"><b>🎉 كمّلتي العرض! هلأ كل قطعة زيادة بـ ' + fmt(G.extra) + ' بس</b>'
      + '<small>بنفس التوصيل' + (G.label ? '، ومن أي نوع' : '') + '.</small>'
      + '<div class="up-row"><a class="up-p up-here" href="#pick"><span>⬆ من نفس الألوان</span></a>' + same.map(card).join('') + '</div></div>';
  };

  /* ---------- floating cart: button + drawer, on every page that loads this file ---------- */
  var BASE = (function () {
    try { var el = document.currentScript || document.querySelector('script[src*="cart.js"]'); return el.getAttribute('src').replace(/cart\.js.*$/, ''); } catch (e) { return '../'; }
  })();
  var CSS = '.pvc-btn[hidden]{display:none!important}.pvc-btn{position:fixed;top:10px;right:10px;z-index:40;display:flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:8px 14px;'
    + 'background:#2b1426;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}'
    + '.pvc-btn b{background:#a94e5a;border-radius:999px;min-width:22px;height:22px;display:grid;place-items:center;font-size:12.5px;padding:0 6px}'
    + '.pvc-bg{position:fixed;inset:0;z-index:50;background:rgba(20,8,18,.45);display:none}.pvc-bg.open{display:block}'
    + '.pvc{position:fixed;inset:auto 0 0 0;z-index:51;max-height:86vh;overflow:auto;background:#fff;border-radius:20px 20px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));'
    + 'transform:translateY(105%);transition:transform .25s;max-width:560px;margin:0 auto;color:#2b1426;font-family:inherit}.pvc.open{transform:none}'
    + '.pvc h3{margin:0 0 10px;display:flex;justify-content:space-between;align-items:center;font-size:18px}.pvc h3 button{border:0;background:#f3e9e1;border-radius:999px;width:34px;height:34px;font-size:18px}'
    + '.pvc .ln{display:grid;grid-template-columns:58px 1fr;gap:10px;padding:10px 0;border-top:1px solid #efe6ea}.pvc .ln img{width:58px;height:58px;object-fit:cover;border-radius:10px}'
    + '.pvc .nm{display:flex;justify-content:space-between;align-items:center;font-weight:700}.pvc .nm a{font-size:12.5px;color:#6e3b5e;font-weight:700}'
    + '.pvc .cs{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.pvc .c{display:inline-flex;align-items:center;gap:6px;border:1px solid #efe6ea;border-radius:999px;padding:3px 4px 3px 10px;font-size:13px}'
    + '.pvc .c button{border:0;background:#f3e9e1;border-radius:50%;width:24px;height:24px;font-size:15px;line-height:1;cursor:pointer}'
    + '.pvc .sum{display:grid;gap:4px;border-top:1px solid #efe6ea;padding-top:10px;margin-top:4px;font-variant-numeric:tabular-nums}.pvc .sum div{display:flex;justify-content:space-between}'
    + '.pvc .sum s{color:#86727f}.pvc .sum .save{color:#2e7d4f;font-weight:600}.pvc .sum .tot{font-weight:800;font-size:17px}.pvc .sum .ln{display:none}'
    + '.pvc .go{display:block;width:100%;margin-top:12px;border:0;border-radius:14px;padding:14px;background:#a94e5a;color:#fff;font:800 16px inherit;cursor:pointer}'
    + '.pvc .more{display:block;text-align:center;margin-top:10px;color:#6e3b5e;font-weight:700}.pvc .empty{text-align:center;color:#86727f;padding:20px 0}';
  var ui = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function changed() { try { window.dispatchEvent(new Event('pvcart')); } catch (e) {} refreshUI(); }
  function curModel() { return Object.keys(MODELS).filter(function (k) { return location.pathname.indexOf('/' + MODELS[k].path + '/') >= 0; })[0] || ''; }
  function buildUI() {
    if (ui || !document.body) return;
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    var btn = el('button', 'pvc-btn'); btn.type = 'button'; btn.setAttribute('aria-label', 'السلة');
    var bg = el('div', 'pvc-bg'), dr = el('div', 'pvc'); dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', 'سلتك');
    document.body.appendChild(btn); document.body.appendChild(bg); document.body.appendChild(dr);
    var close = function () { bg.classList.remove('open'); dr.classList.remove('open'); };
    btn.onclick = function () { renderDrawer(); bg.classList.add('open'); dr.classList.add('open'); };
    bg.onclick = close;
    ui = { btn: btn, bg: bg, dr: dr, close: close };
  }
  function renderDrawer() {
    var T = api.totals(), cur = curModel(), dr = ui.dr;
    var h = '<h3><span>🛍 سلتك</span><button type="button" data-x>✕</button></h3>';
    if (!T.qty) h += '<p class="empty">سلتك فاضية. اختاري ألوانك من الصور.</p>';
    T.lines.forEach(function (l) {
      var info = MODELS[l.model];
      h += '<div class="ln"><img src="' + BASE + info.img + '" alt=""><div><div class="nm"><span>' + l.name + ' (' + l.qty + ')</span>'
        + (l.model === cur ? '' : '<a href="' + BASE + info.path + '/">زيدي ألوان ←</a>') + '</div><div class="cs">'
        + Object.keys(l.colors).sort(function (a, b) { return a - b; }).map(function (n) {
            return '<span class="c">لون ' + n + ' × ' + l.colors[n] + '<button type="button" data-m="' + l.model + '" data-n="' + n + '" aria-label="شيلي قطعة">−</button></span>';
          }).join('') + '</div></div></div>';
    });
    if (T.qty) h += '<div class="sum">' + api.sumHTML() + '</div><button type="button" class="go" data-go>أكملي الطلب ✓</button>';
    h += '<a class="more" href="' + BASE + '">+ أضيفي من أنواع ثانية</a>';
    dr.innerHTML = h;
    dr.querySelector('[data-x]').onclick = ui.close;
    Array.prototype.forEach.call(dr.querySelectorAll('[data-m]'), function (b) {
      b.onclick = function () { var c = read(), m = b.getAttribute('data-m'), n = b.getAttribute('data-n'); c[m][n]--; write(c); changed(); renderDrawer(); };
    });
    var go = dr.querySelector('[data-go]');
    if (go) go.onclick = function () {
      var f = document.getElementById('f');
      if (cur && f) { ui.close(); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var last = api.last(), l = T.lines.filter(function (x) { return x.model === last; })[0] || T.lines[T.lines.length - 1];
      location.href = BASE + l.path + '/#f';
    };
  }
  function refreshUI() {
    if (!ui) return;
    var T = api.totals();
    ui.btn.hidden = !T.qty;
    ui.btn.innerHTML = '🛍 السلة <b>' + T.qty + '</b>';
    if (ui.dr.classList.contains('open')) renderDrawer();
  }
  var origSet = api.set;
  api.set = function (m, sel) { origSet(m, sel); refreshUI(); };
  function ladderNote() {
    var m = curModel(), lad = document.getElementById('ladder');
    if (!m || !lad || document.getElementById('pvExtra')) return;
    var G = GROUPS[MODELS[m].g], n = G.tiers.length - 1;
    var p = el('p', '', 'وبعد ' + (n === 4 ? 'الأربعة' : n === 3 ? 'الثلاثة' : unit(n)) + ': كل قطعة زيادة بـ <b>' + fmt(G.extra) + '</b> بس' + (G.label ? ' · وبتقدري تخلطي بين ' + G.label : ''));
    p.id = 'pvExtra'; p.style.cssText = 'margin:8px 4px 0;text-align:center;font-size:14px;color:#6e3b5e;font-weight:600';
    lad.parentNode.insertBefore(p, lad.nextSibling);
  }
  /** Offer box replacing the page's #ladder for a group whose last piece is free (modal: 3 + 1 gift). */
  var OCSS = '.pvo{background:var(--surface,#fff);border:2px solid var(--accent,#6e3b5e);border-radius:18px;padding:16px 14px;display:grid;gap:12px;text-align:center;font-variant-numeric:tabular-nums}'
    + '.pvo h2{margin:0;font:800 21px/1.3 var(--display,inherit);color:var(--ink,#2a2229)}.pvo h2 em{font-style:normal;color:#b8326a}'
    + '.pvo-eq{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;direction:rtl}'
    + '.pvo-pc{width:40px;height:48px;border-radius:10px;background:var(--accent,#6e3b5e);color:#fff;display:grid;place-items:center;font:700 15px var(--display,inherit)}'
    + '.pvo-pc.gift{background:#f6c445;color:#5a3a00;font-size:20px;box-shadow:0 0 0 3px #fff3c4}'
    + '.pvo-op{font:700 18px var(--display,inherit);color:var(--muted,#7a6d77)}'
    + '.pvo-eq strong{font:800 26px var(--display,inherit);color:var(--ink,#2a2229)}.pvo-eq s{color:var(--muted,#7a6d77);font-size:15px;text-decoration-color:#c0392b;text-decoration-thickness:2px}'
    + '.pvo-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}'
    + '.pvo-row div{border:1px solid var(--line,#e6dde3);border-radius:12px;padding:8px 2px;display:grid;gap:2px}'
    + '.pvo-row b{font:600 12.5px var(--display,inherit);color:var(--muted,#7a6d77)}.pvo-row strong{font:800 18px var(--display,inherit)}'
    + '.pvo-row .g{background:#fff7dc;border-color:#f6c445}.pvo-row .g small{color:#8a5a00;font-weight:700;font-size:11.5px}'
    + '.pvo-more{background:var(--bg,#f6f3f5);border-radius:12px;padding:10px;display:grid;gap:6px}'
    + '.pvo-more p{margin:0;font:700 15px var(--display,inherit)}.pvo-more p b{color:#2f7a52;font-size:17px}'
    + '.pvo-ex{display:flex;justify-content:center;flex-wrap:wrap;gap:6px}.pvo-ex span{background:var(--surface,#fff);border:1px solid var(--line,#e6dde3);border-radius:999px;padding:3px 10px;font-size:13px}'
    + '.pvo-mix{margin:0;font-size:13.5px;color:var(--accent,#6e3b5e);font-weight:600}';
  api.offerHTML = function (m) {
    var g = MODELS[m].g, G = GROUPS[g], t = G.tiers, n = t.length - 1;
    var cells = [1, 2, 3, 4].map(function (q) {
      return q === n ? '<div class="g"><b>' + unit(q) + '</b><strong>' + num(t[q]) + '</strong><small>الرابعة ببلاش 🎁</small></div>'
        : '<div><b>' + unit(q) + '</b><strong>' + num(t[q]) + '</strong><small style="visibility:hidden">.</small></div>';
    }).join('');
    var ex = [n + 1, n + 2, n + 4].map(function (q) { return '<span>' + unit(q) + ' = ' + fmt(gprice(g, q)) + '</span>'; }).join('');
    var names = ORDER.filter(function (k) { return MODELS[k].g === g && !MODELS[k].soon; }).map(function (k) { return MODELS[k].name.replace('مودال ', ''); });
    return '<style>' + OCSS + '</style><div class="pvo" id="ladder">'
      + '<h2>اشتري 3 قطع، <em>والرابعة هدية 🎁</em></h2>'
      + '<div class="pvo-eq"><span class="pvo-pc">1</span><span class="pvo-pc">2</span><span class="pvo-pc">3</span><span class="pvo-op">+</span>'
      + '<span class="pvo-pc gift">🎁</span><span class="pvo-op">=</span><strong>' + fmt(t[n]) + '</strong><s>' + fmt(G.old[n]) + '</s></div>'
      + '<div class="pvo-row">' + cells + '</div>'
      + '<div class="pvo-more" id="pvExtra"><p>وبعد الأربعة: كل قطعة زيادة بـ <b>' + fmt(G.extra) + '</b> بس</p><div class="pvo-ex">' + ex + '</div></div>'
      + (G.label ? '<p class="pvo-mix">بتقدري تخلطي بين ' + names.join(' و') + ' بنفس العرض</p>' : '')
      + '</div>';
  };
  function boot() { buildUI(); refreshUI(); ladderNote(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('pageshow', refreshUI);
  window.addEventListener('storage', refreshUI);
  /* Campaign / staff tag from ?c= — remembered 7 days so it survives moving between pages. */
  var CKEY = 'pv_jo_camp_v1', cmem = '';
  try {
    var qcamp = new URLSearchParams(location.search).get('c');
    if (qcamp) { cmem = qcamp.slice(0, 100); localStorage.setItem(CKEY, JSON.stringify({ c: cmem, t: Date.now() })); }
  } catch (e) {}
  api.campaign = function () {
    try { var o = JSON.parse(localStorage.getItem(CKEY) || 'null'); if (o && o.c && Date.now() - o.t < 7 * 864e5) return o.c; } catch (e) {}
    return cmem;
  };
  api.API = API;
  window.PVCart = api;
})();
