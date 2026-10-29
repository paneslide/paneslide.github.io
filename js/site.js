/* PaneSlide site helper, loaded on every page (the game too).
   - ads and analytics: OFF unless switched on in site.config.js
   - consent hook: ready for Google's consent tool (CMP) once ads are on
   - offline app: service worker with a "new version" prompt, and an install button */
(function () {
  "use strict";
  var C = window.PANESLIDE_CONFIG || {};

  // ---------- consent hook ----------
  // Google's CMP (set up inside AdSense > Privacy & messaging) loads with the AdSense script and
  // calls these queues itself. Other code can wait for a choice with PaneSlideConsent.onReady(fn).
  window.googlefc = window.googlefc || {}; window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  var consentFns = [], consentDone = false;
  window.PaneSlideConsent = {
    onReady: function (fn) { if (consentDone) fn(); else consentFns.push(fn); },
    _ready: function () { if (consentDone) return; consentDone = true; consentFns.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); }
  };
  window.googlefc.callbackQueue.push({ CONSENT_DATA_READY: function () { window.PaneSlideConsent._ready(); } });

  // ---------- ads (off by default) ----------
  function loadAds() {
    if (!C.ADS_ENABLED || !/^ca-pub-\d{10,}$/.test(C.ADSENSE_CLIENT || "")) return;
    var slots = document.querySelectorAll(".ad-slot");
    if (!slots.length) return;
    var s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(C.ADSENSE_CLIENT);
    document.head.appendChild(s);
    slots.forEach(function (el) {
      var id = (C.ADSENSE_SLOTS || {})[el.getAttribute("data-slot")] || "";
      var ins = document.createElement("ins"); ins.className = "adsbygoogle"; ins.style.display = "block";
      ins.setAttribute("data-ad-client", C.ADSENSE_CLIENT); ins.setAttribute("data-ad-format", "auto"); ins.setAttribute("data-full-width-responsive", "true");
      if (id) ins.setAttribute("data-ad-slot", id);
      el.appendChild(ins); el.hidden = false;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  // ---------- analytics (off by default): GoatCounter, no cookies ----------
  function loadAnalytics() {
    decided = true;
    if (!allowed()) { flush(); return; }
    var s = document.createElement("script"); s.async = true;
    s.setAttribute("data-goatcounter", "https://" + C.GOATCOUNTER_CODE + ".goatcounter.com/count");
    s.src = "https://gc.zgo.at/count.js"; document.head.appendChild(s);
    tracking = true; flush(); watchGuideReading();
  }
  function allowed() {
    if (!C.ANALYTICS_ENABLED || !/^[a-z0-9-]+$/.test(C.GOATCOUNTER_CODE || "")) return false;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl) return false; // honour Do Not Track / GPC
    if (/^(localhost|127\.)/.test(location.hostname) || /[?&]test=1/.test(location.search)) return false;
    return true;
  }

  // ---------- anonymous events (GoatCounter custom events) ----------
  // The game pushes [path, title] pairs into window.psq. They are only sent when analytics is on and allowed
  // (not under Do Not Track / Global Privacy Control, not on localhost, not in ?test=1). No cookies, no IDs:
  // each event is just a path like "level/012/start", counted by GoatCounter like a page view.
  // To stay well inside GoatCounter's free plan: the same event path is sent at most once per browser tab
  // session, at most 60 events per session, and sends are batched: queued for 4 seconds, then sent together
  // (or straight away when the tab is hidden or closed).
  var tracking = false, decided = false, sent = {}, sentN = 0, timer = null, MAX_EVENTS = 60;
  try { sent = JSON.parse(sessionStorage.getItem("ps-ev") || "{}") || {}; sentN = Object.keys(sent).length; } catch (e) { sent = {}; }
  function sendNow() {
    clearTimeout(timer); timer = null;
    var q = window.psq || []; if (!tracking) { q.length = 0; return; }
    var gc = window.goatcounter; if (!gc || !gc.count) { timer = setTimeout(sendNow, 1500); return; } // count.js still loading
    while (q.length) {
      var ev = q.shift(), p = String(ev[0]).replace(/[^a-z0-9\/+\-]/gi, "-").slice(0, 120);
      if (sent[p] || sentN >= MAX_EVENTS) continue;
      sent[p] = 1; sentN++;
      try { gc.count({ path: "event/" + p, title: String(ev[1] || p).slice(0, 120), event: true }); } catch (e) {}
    }
    try { sessionStorage.setItem("ps-ev", JSON.stringify(sent)); } catch (e) {}
  }
  var TESTLOG = /[?&]test=1/.test(location.search); // tests can read window.psLog; nothing is ever sent in test mode
  function flush() { if (!decided) return; if (!tracking) { if (window.psq) { if (TESTLOG) (window.psLog = window.psLog || []).push.apply(window.psLog, window.psq); window.psq.length = 0; } return; } if (!timer) timer = setTimeout(sendNow, 4000); }
  document.addEventListener("visibilitychange", function () { if (document.hidden && tracking) sendNow(); });
  window.addEventListener("pagehide", function () { if (tracking) sendNow(); });
  function track(p, t) { (window.psq = window.psq || []).push([p, t || p]); flush(); }
  // Guide pages are already counted as page views; this adds one "read most of it" event per guide.
  function watchGuideReading() {
    var m = location.pathname.match(/^\/guides\/([a-z0-9-]+)\/$/); if (!m) return;
    function onScroll() {
      var h = document.documentElement, seen = (h.scrollTop + innerHeight) / Math.max(1, h.scrollHeight);
      if (seen >= 0.75) { removeEventListener("scroll", onScroll); track("guide/" + m[1] + "/read-75", "Guide read to 75%: " + m[1]); }
    }
    addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------- small prompt ----------
  function toast(text, btnText, onBtn) {
    var old = document.querySelector(".ps-toast"); if (old) old.remove();
    var t = document.createElement("div"); t.className = "ps-toast"; t.setAttribute("role", "status");
    var sp = document.createElement("span"); sp.textContent = text; t.appendChild(sp);
    var b = document.createElement("button"); b.type = "button"; b.textContent = btnText; b.addEventListener("click", function () { onBtn(); t.remove(); }); t.appendChild(b);
    var x = document.createElement("button"); x.type = "button"; x.className = "ps-x"; x.setAttribute("aria-label", "Not now"); x.textContent = "✕"; x.addEventListener("click", function () { t.remove(); }); t.appendChild(x);
    document.body.appendChild(t); return t;
  }

  // ---------- offline app (service worker) ----------
  // New versions install in the background and WAIT. We then ask "New version ready - Refresh".
  // Pages are fetched network-first, so an online visitor never gets an old page.
  function setupSW() {
    if (!("serviceWorker" in navigator) || /[?&]test=1/.test(location.search) && !/[?&]sw=1/.test(location.search)) return;
    var reloading = false, hadController = !!navigator.serviceWorker.controller; // first install claims the page: no reload (avoids a double page view)
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (reloading || !hadController) return; reloading = true; location.reload(); });
    navigator.serviceWorker.register("/sw.js").then(function (reg) {
      function ask(w) {
        if (!w || !navigator.serviceWorker.controller) return; // first install: nothing to replace
        toast("✨ A new version of PaneSlide is ready", "Refresh", function () { w.postMessage({ type: "SKIP_WAITING" }); });
      }
      if (reg.waiting) ask(reg.waiting);
      reg.addEventListener("updatefound", function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener("statechange", function () { if (w.state === "installed") ask(w); });
      });
      document.addEventListener("visibilitychange", function () { if (!document.hidden) reg.update().catch(function () {}); });
    }).catch(function () {});
  }

  // ---------- install button ----------
  var deferred = null;
  function showInstall(on) { document.querySelectorAll("[data-install]").forEach(function (b) { b.hidden = !on; }); }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; showInstall(true); });
  window.addEventListener("appinstalled", function () { deferred = null; showInstall(false); track("app/installed", "App installed"); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-install]"); if (!b || !deferred) return;
    track("app/install-button", "Install button pressed"); deferred.prompt(); deferred.userChoice.then(function () { deferred = null; showInstall(false); }).catch(function () {});
  });

  window.PaneSlideSite = { toast: toast, flush: flush, track: track };
  function start() { loadAds(); loadAnalytics(); setupSW(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
