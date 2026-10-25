/* Pure Veil Iraq — one cart shared by every product page.
 * Pieces from models in the same price group count together (4 hijabs from any of
 * thai / sponge / mukassar / chiffon / cotton = 25,000) and delivery is charged once.
 * The server (Order API) recomputes every price; this file only displays them. */
(function () {
  var KEY = 'pv_iq_cart_v1', TTL = 3 * 864e5, DELIVERY = 5000, PKEY = 'pv_iq_promo_v1';
  var API = 'https://script.google.com/macros/s/AKfycbwFJvS4Nuj4LngAdzz7IRjU_oWzLVXXDatn6sL6XHJN3eukFP-7qdKCgLGwGI6j2gK3KA/exec';
  var GROUPS = {
    A:  { tiers: [0, 8000, 14000, 20000, 25000], old: [0, 10000, 18000, 25000, 35000] },
    CH: { tiers: [0, 10000, 18000, 25000],       old: [0, 15000, 25000, 30000] },
    PS: { tiers: [0, 20000, 35000, 50000],       old: [0, 30000, 50000, 70000], set: true }
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
  function price(t, q) { var n = t.length - 1; return Math.floor(q / n) * t[n] + t[q % n]; }
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
      Object.keys(groups).forEach(function (g) { total += price(GROUPS[g].tiers, groups[g]); old += price(GROUPS[g].old, groups[g]); });
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
      if (!(q % n)) return 'وفّرتي ' + fmt(price(G.old, q) - price(G.tiers, q)) + ' 🎉';
      var left = n - (q % n), add = price(G.tiers, q + left) - price(G.tiers, q);
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
    if (q % n) {
      var left = n - (q % n), add = price(G.tiers, q + left) - price(G.tiers, q);
      return '<div class="upsell"><b>🎁 زيدي ' + (left === 1 ? (G.set ? 'طقم واحد' : 'قطعة وحدة') : unit(left, G.set)) + ' بـ ' + fmt(add) + ' بس</b>'
        + '<small>وبيصير عندك ' + unit(q + left, G.set) + ' بـ ' + fmt(price(G.tiers, q + left)) + '، والتوصيل نفسه.</small>'
        + '<div class="up-row"><a class="up-p up-here" href="#pick"><span>⬆ من نفس الألوان</span></a>' + same.map(card).join('') + '</div></div>';
    }
    var others = ['IQ-PS', 'IQ-TH', 'IQ-SP', 'IQ-CH'].filter(function (k) { return k !== m && !(T.lines.some(function (l) { return l.model === k; })); }).slice(0, 3);
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
  window.PVCart = api;
})();
