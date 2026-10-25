/* Pure Veil Iraq — one cart shared by every product page.
 * Pieces from models in the same price group count together (4 hijabs from any of
 * thai / sponge / mukassar / chiffon / cotton = 25,000) and delivery is charged once.
 * The server (Order API) recomputes every price; this file only displays them. */
(function () {
  var KEY = 'pv_iq_cart_v1', TTL = 3 * 864e5, DELIVERY = 5000, PKEY = 'pv_iq_promo_v1';
  var API = 'https://script.google.com/macros/s/AKfycbwFJvS4Nuj4LngAdzz7IRjU_oWzLVXXDatn6sL6XHJN3eukFP-7qdKCgLGwGI6j2gK3KA/exec';
  var GROUPS = {
    A:  { tiers: [0, 8000, 14000, 20000, 25000], old: [0, 10000, 18000, 25000, 35000], extra: 6000 },
    CH: { tiers: [0, 10000, 18000, 25000],       old: [0, 15000, 25000, 30000], extra: 8000 },
    PS: { tiers: [0, 20000, 35000, 50000],       old: [0, 30000, 50000, 70000], extra: 16000, set: true }
  };
  var MODELS = {
    'IQ-TH': { name: 'تايلندي',        path: 'thai',          g: 'A'  , img: 'img/trio.jpg' },
    'IQ-SP': { name: 'إسفنجي',         path: 'sponge',        g: 'A'  , img: 'sponge/model.jpg' },
    'IQ-MK': { name: 'مكسّر',          path: 'mukassar',      g: 'A'  , img: 'mukassar/model.jpg' },
    'IQ-CS': { name: 'شيفون سادة',     path: 'chiffon',       g: 'A'  , img: 'chiffon/model.jpg' },
    'IQ-DS': { name: 'قطن دبل سترتش',  path: 'cotton',        g: 'A'  , img: 'cotton/model.jpg' },
    'IQ-CH': { name: 'شيفون بقمطة',    path: 'chiffon-qamta', g: 'CH' , img: 'chiffon-qamta/model.jpg' },
    'IQ-PS': { name: 'طقم Salaty',     path: 'salaty',        g: 'PS' , img: 'salaty/m1.jpg' }
  };
  var ORDER = ['IQ-TH', 'IQ-SP', 'IQ-MK', 'IQ-CS', 'IQ-DS', 'IQ-CH', 'IQ-PS'];
  var mem = {}, pmem = null;
  function getPromo() {
    try { var o = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (o && o.code && Date.now() - o.t < TTL) return o; } catch (e) {}
    return pmem;
  }
  function setPromo(o) { pmem = o; try { if (o) localStorage.setItem(PKEY, JSON.stringify(o)); else localStorage.removeItem(PKEY); } catch (e) {} }

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
  // Up to the offer size: the ladder. After it: every extra piece at the group's flat 'extra' price.
  // Without 'extra' (the struck-through old prices) the ladder repeats.
  function price(t, q, extra) {
    var n = t.length - 1;
    if (extra && q > n) return t[n] + (q - n) * extra;
    return Math.floor(q / n) * t[n] + t[q % n];
  }
  function gprice(g, q) { return price(GROUPS[g].tiers, q, GROUPS[g].extra); }
  function sum(o) { return Object.keys(o || {}).reduce(function (a, n) { return a + o[n]; }, 0); }
  function fmt(n) { return n.toLocaleString('en-US') + ' دينار'; }
  function unit(q, set) {
    if (set) return q === 1 ? 'طقم' : q === 2 ? 'طقمين' : q + ' أطقم';
    return q === 1 ? 'قطعة' : q === 2 ? 'قطعتين' : q + ' قطع';
  }

  var api = {
    MODELS: MODELS, DELIVERY: DELIVERY, fmt: fmt, unit: unit,
    get: function (m) { var c = read()[m] || {}, o = {}; Object.keys(c).forEach(function (n) { o[+n] = c[n]; }); return o; },
    set: function (m, sel) { var c = read(); c[m] = sel; write(c); },
    setQty: function (m, n, q) { var c = read(); c[m] = c[m] || {}; c[m][n] = q; write(c); },
    clear: function () { write({}); },
    last: function (m) { try { if (m) localStorage.setItem(KEY + '_last', m); return localStorage.getItem(KEY + '_last') || ''; } catch (e) { return m || ''; } },
    /** Everything in the cart, priced. */
    totals: function () {
      var c = read(), lines = [], groups = {}, qty = 0, total = 0, old = 0;
      ORDER.forEach(function (m) {
        var q = sum(c[m]); if (!q) return;
        var info = MODELS[m];
        lines.push({ model: m, name: info.name, path: info.path, g: info.g, qty: q, colors: c[m] });
        groups[info.g] = (groups[info.g] || 0) + q; qty += q;
      });
      Object.keys(groups).forEach(function (g) { total += gprice(g, groups[g]); old += price(GROUPS[g].old, groups[g]); });
      var onlySets = lines.length > 0 && lines.every(function (l) { return l.g === 'PS'; });
      var promo = getPromo(), fee = qty && !promo ? DELIVERY : 0;
      return { lines: lines, groups: groups, qty: qty, total: total, old: old, delivery: fee, promo: promo,
               cod: total + fee, label: unit(qty, onlySets) };
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
      if (q >= n) return 'وفّرتي ' + fmt(price(G.old, q) - gprice(g, q)) + ' 🎉 وكل ' + (G.set ? 'طقم' : 'قطعة') + ' زيادة بـ ' + fmt(G.extra);
      var left = n - q, add = gprice(g, n) - gprice(g, q);
      var many = Object.keys(MODELS).filter(function (k) { return MODELS[k].g === g; }).length > 1;
      return 'زيدي ' + (left === 1 ? (G.set ? 'طقم واحد' : 'قطعة وحدة') : unit(left, G.set)) + (many ? ' من أي صنف' : '') + ' بـ ' + fmt(add) + ' بس 🎁';
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
        + '<div><span>القطع (' + T.qty + ')</span><span><s>' + (T.qty ? fmt(T.old) : '') + '</s> ' + fmt(T.total) + '</span></div>'
        + (T.qty && T.old > T.total ? '<div class="save"><span>خصم البلاك فرايدي</span><span>− ' + fmt(T.old - T.total) + '</span></div>' : '')
        + (T.promo
          ? '<div class="save"><span>التوصيل (كود ' + T.promo.code + ')</span><span><s>' + fmt(DELIVERY) + '</s> مجاني 🎁</span></div>'
          : '<div><span>التوصيل' + (T.lines.length > 1 ? ' (مرة وحدة)' : '') + '</span><span>' + fmt(DELIVERY) + '</span></div>')
        + '<div class="tot"><span>المجموع عند الاستلام</span><span>' + fmt(T.total + (T.promo ? 0 : DELIVERY)) + '</span></div>';
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
    var same = Object.keys(MODELS).filter(function (k) { return MODELS[k].g === g && k !== m; });
    if (q && q < n) {
      var left = n - q, add = gprice(g, n) - gprice(g, q);
      return '<div class="upsell"><b>🎁 زيدي ' + (left === 1 ? (G.set ? 'طقم واحد' : 'قطعة وحدة') : unit(left, G.set)) + ' بـ ' + fmt(add) + ' بس</b>'
        + '<small>وبيصير عندك ' + unit(n, G.set) + ' بـ ' + fmt(gprice(g, n)) + '، والتوصيل نفسه.</small>'
        + '<div class="up-row"><a class="up-p up-here" href="#pick"><span>⬆ من نفس الألوان</span></a>' + same.map(card).join('') + '</div></div>';
    }
    var others = ['IQ-PS', 'IQ-TH', 'IQ-SP', 'IQ-CH'].filter(function (k) { return MODELS[k].g !== g && !(T.lines.some(function (l) { return l.model === k; })); }).slice(0, 2);
    if (q >= n) return '<div class="upsell"><b>🎉 كمّلتي العرض! هلا كل ' + (G.set ? 'طقم' : 'قطعة') + ' زيادة بـ ' + fmt(G.extra) + ' بس</b>'
      + '<small>بنفس التوصيل، بدون ما تستني عرض جديد.</small>'
      + '<div class="up-row"><a class="up-p up-here" href="#pick"><span>⬆ من نفس الألوان</span></a>' + same.map(card).concat(others.map(card)).join('') + '</div></div>';
    if (!others.length) return '';
    return '<div class="upsell"><b>🤍 بتحبي تضيفي إشي ثاني على نفس التوصيل؟</b><div class="up-row">' + others.map(card).join('') + '</div></div>';
  };

  /** Promo code: checked by the Order API; the server checks it again when the order is placed. */
  api.promo = getPromo;
  api.clearPromo = function () { setPromo(null); };
  api.applyPromo = function (code) {
    code = String(code || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/\s+/g, '').toUpperCase();
    if (!code) return Promise.resolve({ ok: false, error: 'اكتبي الكود.' });
    return fetch(API + '?action=promo&code=' + encodeURIComponent(code) + '&t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.ok) setPromo({ code: j.code, type: j.type, t: Date.now() }); return j; })
      .catch(function () { return { ok: false, error: 'ما قدرنا نتأكد من الكود، جرّبي كمان مرة.' }; });
  };
  // Influencer / campaign links: pureveiliq.com/?code=SARA applies the code on any page.
  try {
    var qc = new URLSearchParams(location.search).get('code');
    if (qc) api.applyPromo(qc).then(function (j) { api.lastPromo = j; try { window.dispatchEvent(new CustomEvent('pvpromo', { detail: j })); } catch (e) {} });
  } catch (e) {}

  /* ---------- floating cart: button + drawer, on every page that loads this file ---------- */
  var BASE = (function () {
    try { var el = document.currentScript || document.querySelector('script[src*="cart.js"]'); return el.getAttribute('src').replace(/cart\.js.*$/, ''); } catch (e) { return '../'; }
  })();
  var CSS = '.pvc-btn[hidden]{display:none!important}.pvc-btn{position:fixed;top:10px;right:10px;z-index:40;display:flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:8px 14px;'
    + 'background:#2b1426;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}'
    + '.pvc-btn b{background:#d81b2c;border-radius:999px;min-width:22px;height:22px;display:grid;place-items:center;font-size:12.5px;padding:0 6px}'
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
    + '.pvc .go{display:block;width:100%;margin-top:12px;border:0;border-radius:14px;padding:14px;background:#d81b2c;color:#fff;font:800 16px inherit;cursor:pointer}'
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
    h += '<a class="more" href="' + BASE + '">+ أضيفي من أصناف ثانية</a>';
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
    var G = GROUPS[MODELS[m].g], p = el('p', '', 'وبعد العرض: كل ' + (G.set ? 'طقم' : 'قطعة') + ' زيادة بـ <b>' + fmt(G.extra) + '</b> بس');
    p.id = 'pvExtra'; p.style.cssText = 'margin:8px 4px 0;text-align:center;font-size:14px;color:#6e3b5e;font-weight:600';
    lad.parentNode.insertBefore(p, lad.nextSibling);
  }
  function boot() { buildUI(); refreshUI(); ladderNote(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('pageshow', refreshUI);
  window.addEventListener('storage', refreshUI);
  window.addEventListener('pvpromo', refreshUI);
  /* Campaign / staff tag from ?c= — remembered 7 days so it survives moving between pages. */
  var CKEY = 'pv_iq_camp_v1', cmem = '';
  try {
    var qcamp = new URLSearchParams(location.search).get('c');
    if (qcamp) { cmem = qcamp.slice(0, 100); localStorage.setItem(CKEY, JSON.stringify({ c: cmem, t: Date.now() })); }
  } catch (e) {}
  api.campaign = function () {
    try { var o = JSON.parse(localStorage.getItem(CKEY) || 'null'); if (o && o.c && Date.now() - o.t < 7 * 864e5) return o.c; } catch (e) {}
    return cmem;
  };
  window.PVCart = api;
})();
