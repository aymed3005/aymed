(function () {
  "use strict";
  var A = window.AYMED, ui = A.ui.k, X = A.ui.x, lang = A.lang, PAGE = 50;
  var loc = lang === "tr" ? "tr-TR" : "en-GB";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmtN = function (n) { return new Intl.NumberFormat(loc).format(n); };
  var pct = function (a, b) { if (!b) return "–"; var v = (Math.round(1000 * a / b) / 10).toLocaleString(loc); return String(loc).indexOf("tr") === 0 ? "%" + v : v + "%"; };
  var fmtD = function (iso) { if (!iso) return ""; var p = iso.split("-"); return lang === "tr" ? p[2] + "." + p[1] + "." + p[0] : p[2] + "/" + p[1] + "/" + p[0]; };
  var $ = function (id) { return document.getElementById(id); };
  var rows = [], meta = {}, view = [], page = 1, sort = { key: "tarih", dir: -1 }, charts = {}, chartLibReady = false, chartLibLoading = false, pendingDraw = false, skipDom = false;
  var el = {};
  ["y1", "y2", "donem", "sonuc", "bt", "durum", "q", "tbody", "sayac", "sayfa", "onceki", "sonraki", "kaydir", "analiz-n", "analiz-bos", "timeline"].forEach(function (k) { el[k] = $(k); });
  var css = getComputedStyle(document.documentElement);
  var cv = function (n, d) { var v = css.getPropertyValue(n).trim(); return v || d; };
  var col = { bb: cv("--bb", "#263f63"), nrm: cv("--nrm", "#8a6f3d"), spyd: cv("--spyd", "#8b1e2d"), navy: cv("--ink-strong", "#111827"), amber: cv("--accent", "#8a6f3d"), gray: cv("--gray-1", "#7b8794"), muted: cv("--muted", "#5b6473") };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fill(sel, map, order) { order.forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = map[k] || k; sel.appendChild(o); }); }
  // siyasi parti ve Yüce Divan kararları grafiklerde tek seri; Bilgi Bankası bağlantısı yalnız BB ve NRM için
  var SERI = { bb: "bb", nrm: "nrm", sp: "spyd", yd: "spyd" }, TAG = { bb: "BB", nrm: "NRM", sp: "SP", yd: "YD" };
  function kbbUrl(r) { return r.no && (r.tur === "bb" || r.tur === "nrm") ? "https://kararlarbilgibankasi.anayasa.gov.tr/kbb/" + (r.tur === "bb" ? "BB/" : "ND/") + r.no : ""; }
  function noCell(r) { var u = kbbUrl(r); return u ? "<a href='" + u + "' target='_blank' rel='noopener' aria-label='" + esc(r.no) + ", " + ui.kbb_aria + "'>" + esc(r.no) + "</a>" : "<span class='muted'>" + esc(r.no || r.id) + "</span>"; }

  // ---------- filtre durumu ----------
  function state() {
    var tur = [].map.call(document.querySelectorAll("input[name=tur]:checked"), function (c) { return c.value; });
    var qraw = el.q.value.trim(), mdm = qraw.match(/^(?:md|art|m|a)\.?\s*:?\s*(\d{1,3})$/i);
    return { y1: +el.y1.value, y2: +el.y2.value, tur: tur, sonuc: el.sonuc.value, bt: el.bt.value, durum: el.durum.value, q: mdm ? "" : qraw.toLocaleLowerCase(loc), md: mdm ? mdm[1] : "" };
  }
  function syncDonem() {
    var v = el.donem.value;
    if (v === "") { el.y1.value = meta.minYil; el.y2.value = meta.maxYil; }
    else if (v !== "ozel") { var p = v.split("-"); el.y1.value = p[0]; el.y2.value = p[1]; }
  }
  function donemFromYears() {
    var key = el.y1.value + "-" + el.y2.value, opts = [].map.call(el.donem.options, function (o) { return o.value; });
    if (+el.y1.value === meta.minYil && +el.y2.value === meta.maxYil) el.donem.value = "";
    else el.donem.value = opts.indexOf(key) >= 0 ? key : "ozel";
  }
  function apply(fromDonem) {
    if (fromDonem) syncDonem(); else donemFromYears();
    var s = state();
    if (s.y1 > s.y2) { var t = s.y1; s.y1 = s.y2; s.y2 = t; el.y1.value = s.y1; el.y2.value = s.y2; }
    view = rows.filter(function (r) {
      if (r.yil < s.y1 || r.yil > s.y2) return false;
      if (s.tur.indexOf(r.tur) < 0) return false;
      if (s.sonuc && r.sonuc !== s.sonuc) return false;
      if (s.bt && r.bt !== s.bt) return false;
      if (s.durum && r.durum !== s.durum) return false;
      if (s.q && r._q.indexOf(s.q) < 0) return false;
      if (s.md && r._mdl.indexOf(s.md) < 0) return false;
      return true;
    });
    view.sort(function (a, b) { var k = sort.key === "haber" ? "haber" : "tarih"; return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * sort.dir; });
    page = 1; pushUrl(s);
    if (skipDom) { skipDom = false; renderAnaliz(s, true); bindPre(); hintScroll(); return; }
    renderKpi(s); renderAnaliz(s); renderTimeline(); renderTable();
  }
  function pushUrl(s) {
    var p = new URLSearchParams();
    if (s.y1 !== meta.minYil) p.set("y1", s.y1); if (s.y2 !== meta.maxYil) p.set("y2", s.y2);
    if (s.tur.length !== document.querySelectorAll("input[name=tur]").length) p.set("tur", s.tur.join(","));
    if (s.sonuc) p.set("sonuc", s.sonuc); if (s.bt) p.set("bt", s.bt); if (s.durum) p.set("durum", s.durum); var qv = el.q.value.trim(); if (qv) p.set("q", qv);
    var qs = p.toString(); history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  function readUrl() {
    var p = new URLSearchParams(location.search);
    if (p.get("y1")) el.y1.value = p.get("y1"); if (p.get("y2")) el.y2.value = p.get("y2");
    if (p.get("tur")) { var t = p.get("tur").split(","); document.querySelectorAll("input[name=tur]").forEach(function (c) { c.checked = t.indexOf(c.value) >= 0; }); }
    ["sonuc", "bt", "durum", "q"].forEach(function (k) { if (p.get(k)) el[k].value = p.get(k); });
  }

  // ---------- özet ----------
  function renderKpi(s) {
    var n = view.length, bb = 0, nrm = 0, vaka = 0, ymin = Infinity, ymax = -Infinity;
    view.forEach(function (r) { if (r.tur === "bb") bb++; else if (r.tur === "nrm") nrm++; if (r.durum === "vaka") vaka++; if (r.yil < ymin) ymin = r.yil; if (r.yil > ymax) ymax = r.yil; });
    $("kpi-karar").textContent = fmtN(n); $("kpi-bb").textContent = fmtN(bb); $("kpi-nrm").textContent = fmtN(nrm); $("kpi-vaka").textContent = fmtN(vaka);
    $("kpi-yil").textContent = n ? (ymin === ymax ? ymin : ymin + "–" + ymax) : "–";
  }

  // ---------- analiz ----------
  function count(arr, keyFn) { var m = {}; arr.forEach(function (r) { var k = keyFn(r); if (k === null || k === undefined) return; m[k] = (m[k] || 0) + 1; }); return m; }
  function ranks(id, items, total, onClick, labelOf) {
    var ol = $(id), max = items.length ? items[0][1] : 0; ol.innerHTML = "";
    if (!items.length) { ol.innerHTML = "<li class='rank-empty'>" + X.bos + "</li>"; return; }
    items.forEach(function (it) {
      var li = document.createElement("li"); var w = max ? Math.round(100 * it[1] / max) : 0;
      li.innerHTML = "<button type='button' class='rank-btn' data-k='" + esc(it[0]) + "'><span class='rank-l'>" + esc(labelOf(it[0])) + "</span><span class='rank-bar'><i style='width:" + w + "%'></i></span><span class='rank-v'><b>" + fmtN(it[1]) + "</b> <small>(" + pct(it[1], total) + ")</small></span></button>";
      li.firstChild.addEventListener("click", function () { onClick(it[0]); });
      ol.appendChild(li);
    });
  }
  function topN(m, n, order) { var arr = Object.keys(m).map(function (k) { return [k, m[k]]; }); arr.sort(function (a, b) { return b[1] - a[1] || (order ? order.indexOf(a[0]) - order.indexOf(b[0]) : String(a[0]).localeCompare(b[0])); }); return n ? arr.slice(0, n) : arr; }
  function hiddenTable(id, head, rowsArr) { var t = $(id); if (!t) return; t.innerHTML = "<caption>" + esc(head[0]) + "</caption><thead><tr>" + head.map(function (h) { return "<th scope='col'>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" + rowsArr.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody>"; }
  function setYearFilter(y) { el.y1.value = y; el.y2.value = y; apply(); scrollTo("ozet"); }
  function renderAnaliz(s, chartsOnly) {
    var n = view.length;
    if (!chartsOnly) { el["analiz-n"].textContent = X.n.replace("{n}", fmtN(n)); el["analiz-bos"].hidden = n > 0; }
    var bbv = view.filter(function (r) { return r.tur === "bb"; }), nrmv = view.filter(function (r) { return r.tur === "nrm"; });
    $("n-sonuc-bb").textContent = X.n.replace("{n}", fmtN(bbv.length)); $("n-sonuc-nrm").textContent = X.n.replace("{n}", fmtN(nrmv.length)); $("n-bt").textContent = X.n.replace("{n}", fmtN(nrmv.length));
    var onSonuc = function (k) { el.sonuc.value = k; apply(); scrollTo("ozet"); };
    if (!chartsOnly) {
    ranks("r-sonuc-bb", topN(count(bbv, function (r) { return r.sonuc; }), 0, meta.sonuc), bbv.length, onSonuc, function (k) { return ui.sonuc_e[k] || k; });
    ranks("r-sonuc-nrm", topN(count(nrmv, function (r) { return r.sonuc; }), 0, meta.sonuc), nrmv.length, onSonuc, function (k) { return ui.sonuc_e[k] || k; });
    var mdc = {}; view.forEach(function (r) { if (!r.md) return; r.md.split(",").forEach(function (m) { m = m.trim(); if (m) mdc[m] = (mdc[m] || 0) + 1; }); });
    ranks("r-md", topN(mdc, 12), n, function (k) { el.q.value = (lang === "tr" ? "md:" : "art:") + k; apply(); scrollTo("ozet"); }, function (k) { return (lang === "tr" ? "md. " : "art. ") + k; });
    ranks("r-bt", topN(count(nrmv, function (r) { return r.bt; }), 0, meta.bt), nrmv.length, function (k) { el.bt.value = k; apply(); scrollTo("ozet"); }, function (k) { return ui.bt_e[k] || k; });
    }
    // grafik verileri
    var yillar = []; for (var y = s.y1; y <= s.y2; y++) yillar.push(y);
    var yt = {}; yillar.forEach(function (y) { yt[y] = { bb: 0, nrm: 0, spyd: 0 }; });
    view.forEach(function (r) { var t = yt[r.yil], g = SERI[r.tur]; if (!t || !g) return; t[g]++; });
    var vaka = view.filter(function (r) { return r.durum === "vaka"; });
    var hb = [0, 0, 0, 0], gb = [0, 0, 0, 0];
    vaka.forEach(function (r) { var h = r.haber; hb[h <= 1 ? 0 : h <= 3 ? 1 : h <= 9 ? 2 : 3]++; var g = r.gun; if (g === null || g === undefined) return; gb[g <= 7 ? 0 : g <= 30 ? 1 : g <= 90 ? 2 : 3]++; });
    var ay = new Array(12).fill(0); view.forEach(function (r) { ay[+r.tarih.slice(5, 7) - 1]++; });
    var data = { yillar: yillar, yt: yt, hb: hb, gb: gb, ay: ay, nVaka: vaka.length };
    hiddenTable("t-yil", [X.g_yil, "BB", "NRM", ui.tur_e.spyd], yillar.map(function (y) { return [y, yt[y].bb, yt[y].nrm, yt[y].spyd]; }));
    hiddenTable("t-haber", [X.g_haber, ui.sut.haber], X.haber_bins.map(function (b, i) { return [b, hb[i]]; }));
    hiddenTable("t-gun", [X.g_gun, ui.sut.haber], X.gun_bins.map(function (b, i) { return [b, gb[i]]; }));
    hiddenTable("t-ay", [X.g_ay, ui.sut.haber], X.aylar.map(function (b, i) { return [b, ay[i]]; }));
    pendingDraw = data; if (chartLibReady) draw(data); else loadChartLib();
  }
  function loadChartLib() {
    if (chartLibLoading) return; chartLibLoading = true;
    var start = function () { var sc = document.createElement("script"); sc.src = A.root + "assets/vendor/chart.umd.min.js"; sc.onload = function () { chartLibReady = true; Chart.defaults.font.family = css.getPropertyValue("--sans").trim(); Chart.defaults.color = col.muted; if (pendingDraw) draw(pendingDraw); }; document.head.appendChild(sc); };
    if ("IntersectionObserver" in window) { var io = new IntersectionObserver(function (e) { if (e.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); } }, { rootMargin: "0px", threshold: 0.05 }); io.observe($("c-yil")); } else start();
  }
  function mk(id, cfg) { if (charts[id]) { charts[id].data = cfg.data; charts[id].options = cfg.options; charts[id].update(); return; } charts[id] = new Chart($(id), cfg); }
  function draw(d) {
    var common = { responsive: true, maintainAspectRatio: false, animation: reduce ? false : { duration: 400 }, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } };
    var yl = d.yillar.map(String);
    mk("c-yil", { type: "bar", data: { labels: yl, datasets: [{ label: ui.tur_e.bb, data: d.yillar.map(function (y) { return d.yt[y].bb; }), backgroundColor: col.bb, stack: "s" }, { label: ui.tur_e.nrm, data: d.yillar.map(function (y) { return d.yt[y].nrm; }), backgroundColor: col.nrm, stack: "s" }, { label: ui.tur_e.spyd, data: d.yillar.map(function (y) { return d.yt[y].spyd; }), backgroundColor: col.spyd, stack: "s" }] },
      options: Object.assign({}, common, { onClick: function (e, els) { if (els.length) setYearFilter(d.yillar[els[0].index]); }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: fmtN } } }, plugins: Object.assign({}, common.plugins, { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + fmtN(c.raw); } } } }) }) });
    var small = Object.assign({}, common, { plugins: Object.assign({}, common.plugins, { legend: { display: false } }), scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: fmtN } } } });
    mk("c-haber", { type: "bar", data: { labels: X.haber_bins, datasets: [{ data: d.hb, backgroundColor: col.bb, borderRadius: 0 }] }, options: small });
    mk("c-gun", { type: "bar", data: { labels: X.gun_bins, datasets: [{ data: d.gb, backgroundColor: col.nrm, borderRadius: 0 }] }, options: small });
    mk("c-ay", { type: "bar", data: { labels: X.aylar, datasets: [{ data: d.ay, backgroundColor: col.gray, borderRadius: 0 }] }, options: small });
  }

  function bindPre() {
    var map = { "r-sonuc-bb": function (k) { el.sonuc.value = k; apply(); scrollTo("ozet"); }, "r-sonuc-nrm": function (k) { el.sonuc.value = k; apply(); scrollTo("ozet"); }, "r-md": function (k) { el.q.value = (lang === "tr" ? "md:" : "art:") + k; apply(); scrollTo("ozet"); }, "r-bt": function (k) { el.bt.value = k; apply(); scrollTo("ozet"); } };
    Object.keys(map).forEach(function (id) { $(id).querySelectorAll(".rank-btn").forEach(function (b) { b.addEventListener("click", function () { map[id](b.dataset.k); }); }); });
  }
  // ---------- zaman çizgisi ----------
  function renderTimeline() {
    var last = view.filter(function (r) { return r.durum === "vaka"; }).sort(function (a, b) { return a.tarih < b.tarih ? 1 : -1; }).slice(0, 10), ol = el.timeline; ol.innerHTML = "";
    if (!last.length) { ol.innerHTML = "<li class='rank-empty'>" + X.bos + "</li>"; return; }
    last.forEach(function (r) {
      var li = document.createElement("li");
      li.innerHTML = "<time datetime='" + r.tarih + "'>" + fmtD(r.tarih) + "</time><div><span class='tag tag-" + r.tur + "'>" + (TAG[r.tur] || r.tur) + "</span> " + noCell(r) + " · " + esc(ui.sonuc_e[r.sonuc] || r.sonuc) + "<p>" + esc(r.konu) + "</p><small>" + fmtN(r.haber) + " " + (r.haber === 1 && X.zaman_haber_1 ? X.zaman_haber_1 : X.zaman_haber) + (r.gun !== null && r.gun !== undefined ? " · " + X.zaman_gun.replace("{g}", r.gun) : "") + "</small></div>";
      ol.appendChild(li);
    });
  }

  // ---------- tablo ----------
  function renderTable() {
    var total = Math.max(1, Math.ceil(view.length / PAGE)); page = Math.min(page, total);
    var start = (page - 1) * PAGE, part = view.slice(start, start + PAGE), L = ui.sut, html = "";
    part.forEach(function (r) {
      html += "<tr><td data-l='" + L.tarih + "'><time datetime='" + r.tarih + "'>" + fmtD(r.tarih) + "</time></td>" +
        "<td data-l='" + L.tur + "'><span class='tag tag-" + r.tur + "'>" + (TAG[r.tur] || r.tur) + "</span></td>" +
        "<td data-l='" + L.no + "' class='kbb'>" + noCell(r) + "</td>" +
        "<td data-l='" + L.sonuc + "'>" + esc(ui.sonuc_e[r.sonuc] || r.sonuc) + "</td>" +
        "<td data-l='" + L.bt + "'>" + (r.tur === "nrm" ? esc(ui.bt_e[r.bt] || r.bt) : "") + "</td>" +
        "<td data-l='" + L.durum + "'><span class='tag tag-" + r.durum + "'>" + esc(ui.durum_kisa[r.durum]) + "</span></td>" +
        "<td data-l='" + L.haber + "' class='num'>" + (r.durum === "vaka" ? r.haber : "") + "</td>" +
        "<td data-l='" + L.gun + "' class='num'>" + (r.gun === null || r.gun === undefined ? "" : r.gun) + "</td>" +
        "<td data-l='" + L.md + "'>" + esc(r.md) + "</td></tr>" + (r.konu ? "<tr class='konu-row'><td colspan='9' data-l='" + L.konu + "'>" + esc(r.konu) + "</td></tr>" : "");
    });
    el.tbody.innerHTML = html || "<tr><td colspan='9'>" + ui.bos + "</td></tr>";
    el.sayac.textContent = (view.length === 1 && ui.sonuc_sayi_1 ? ui.sonuc_sayi_1 : ui.sonuc_sayi).replace("{n}", fmtN(view.length));
    el.sayfa.textContent = ui.sayfa.replace("{p}", page).replace("{t}", total);
    el.onceki.disabled = page <= 1; el.sonraki.disabled = page >= total;
    document.querySelectorAll("th button[data-sort]").forEach(function (b) { b.parentNode.setAttribute("aria-sort", b.dataset.sort === sort.key ? (sort.dir < 0 ? "descending" : "ascending") : "none"); });
    hintScroll();
  }
  function hintScroll() { var wrap = el.tbody.closest(".table-wrap"); if (wrap && el.kaydir) { var sc = wrap.scrollWidth > wrap.clientWidth + 4; el.kaydir.hidden = !sc; wrap.classList.toggle("has-scroll", sc); } }
  function scrollTo(id) { var fb = $("filterbar"), hd = document.querySelector(".site-header"), sticky = getComputedStyle(fb).position === "sticky", h = (sticky ? fb.offsetHeight : 0) + (hd && getComputedStyle(hd).position === "sticky" ? hd.offsetHeight : 0) + 8; var t = $(id); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - h, behavior: reduce ? "auto" : "smooth" }); }

  // ---------- başlangıç ----------
  function init(data) {
    meta = data.meta; var C = data.cols, idx = {}; C.forEach(function (c, i) { idx[c] = i; });
    rows = data.rows.map(function (a) { var r = { id: a[idx.id], tur: a[idx.tur], tarih: a[idx.tarih], yil: a[idx.yil], no: a[idx.no], sonuc: a[idx.sonuc], bt: a[idx.bt], md: a[idx.md], konu: a[idx.konu], durum: a[idx.durum], haber: a[idx.haber], gun: a[idx.gun] }; r._q = (r.no + " " + r.konu + " " + r.md).toLocaleLowerCase(loc); r._mdl = r.md ? r.md.split(",").map(function (x) { return x.trim(); }) : []; return r; });
    for (var y = meta.minYil; y <= meta.maxYil; y++) { el.y1.add(new Option(y, y)); el.y2.add(new Option(y, y)); }
    el.y1.value = meta.minYil; el.y2.value = meta.maxYil;
    fill(el.sonuc, ui.sonuc_e, meta.sonuc); fill(el.bt, ui.bt_e, meta.bt); fill(el.durum, ui.durum_e, meta.durum);
    readUrl(); skipDom = !location.search; apply();
    $("filtre").addEventListener("input", function (e) { if (e.target.id === "q") { clearTimeout(window._qt); window._qt = setTimeout(function () { apply(); }, 180); } else { apply(e.target.id === "donem"); } });
    $("temizle").addEventListener("click", function () { $("filtre").reset(); el.y1.value = meta.minYil; el.y2.value = meta.maxYil; apply(); });
    el.onceki.addEventListener("click", function () { page--; renderTable(); scrollTo("veri"); });
    el.sonraki.addEventListener("click", function () { page++; renderTable(); scrollTo("veri"); });
    document.querySelectorAll("th button[data-sort]").forEach(function (b) { b.addEventListener("click", function () { if (sort.key === b.dataset.sort) { sort.dir *= -1; } else { sort.key = b.dataset.sort; sort.dir = -1; } apply(); }); });
    document.querySelectorAll(".section-nav a").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); history.replaceState(null, "", location.pathname + location.search + a.getAttribute("href")); scrollTo(a.getAttribute("href").slice(1)); }); });
    if (location.hash) scrollTo(location.hash.slice(1));
    var langA = document.querySelector(".site-nav .lang"); if (langA) { var sync = function () { langA.href = langA.href.split("?")[0].split("#")[0] + location.search + location.hash; }; sync(); window.addEventListener("hashchange", sync); var _ps = history.replaceState.bind(history); history.replaceState = function () { _ps.apply(null, arguments); sync(); }; }
  }
  // Veri, yazı tipleri ve ilk boyama bitince, düşük öncelikle çekilir (LCP'yi bant genişliği yarışından korur).
  function loadData() {
    var opts = {}; try { opts = { priority: "low" }; } catch (e) {}
    fetch(A.root + "data/kararlar.json", opts).then(function (r) { return r.json(); }).then(init).catch(function () { el.sayac.textContent = lang === "tr" ? "Veri yüklenemedi." : "Data could not be loaded."; });
  }
  function afterPaint() { if ("requestIdleCallback" in window) requestIdleCallback(loadData, { timeout: 1500 }); else setTimeout(loadData, 300); }
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  if (document.readyState === "complete") { fontsReady.then(afterPaint); } else { window.addEventListener("load", function () { fontsReady.then(afterPaint); }); }
})();
