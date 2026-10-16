(function () {
  "use strict";
  var A = window.AYMED, ui = A.ui, lang = A.lang;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmt = function (n) { return new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-GB").format(n); };
  var css = getComputedStyle(document.documentElement);
  var cv = function (n, d) { var v = css.getPropertyValue(n).trim(); return v || d; };
  var col = { bb: cv("--bb", "#263f63"), nrm: cv("--nrm", "#8a6f3d"), spyd: cv("--spyd", "#8b1e2d"), covered: cv("--bb", "#263f63"), not: cv("--not", "#c9c2b5"), muted: cv("--muted", "#5b6473") };
  function ready() {
    if (typeof Chart === "undefined") { return; }
    Chart.defaults.font.family = css.getPropertyValue("--sans").trim();
    Chart.defaults.color = col.muted;
    fetch(A.root + "data/ozet.json").then(function (r) { return r.json(); }).then(draw).catch(function () {});
  }
  function draw(oz) {
    var yillar = oz.yillar;
    var common = { responsive: true, maintainAspectRatio: false, animation: reduce ? false : { duration: 600 }, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } };
    new Chart(document.getElementById("grafik-yil-tur"), {
      type: "bar",
      data: { labels: yillar, datasets: [
        { label: ui.k.tur_e.bb, data: yillar.map(function (y) { return oz.yil_tur[y].bb; }), backgroundColor: col.bb, stack: "s" },
        { label: ui.k.tur_e.nrm, data: yillar.map(function (y) { return oz.yil_tur[y].nrm; }), backgroundColor: col.nrm, stack: "s" },
        { label: ui.k.tur_e.spyd, data: yillar.map(function (y) { return oz.yil_tur[y].spyd; }), backgroundColor: col.spyd, stack: "s" }
      ] },
      options: Object.assign({}, common, { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: fmt } } }, plugins: Object.assign({}, common.plugins, { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + fmt(c.raw); } } } }) })
    });
  }
  if (document.readyState === "complete") { ready(); } else { window.addEventListener("load", ready); }
})();
