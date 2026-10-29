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
    if (!C.ANALYTICS_ENABLED || !/^[a-z0-9-]+$/.test(C.GOATCOUNTER_CODE || "")) return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl) return; // honour Do Not Track / GPC
    if (/^(localhost|127\.)/.test(location.hostname) || /[?&]test=1/.test(location.search)) return;
    var s = document.createElement("script"); s.async = true;
    s.setAttribute("data-goatcounter", "https://" + C.GOATCOUNTER_CODE + ".goatcounter.com/count");
    s.src = "https://gc.zgo.at/count.js"; document.head.appendChild(s);
  }

  // ---------- small prompt ----------
  function toast(text, btnText, onBtn) {
    var old = document.querySelector(".ps-toast"); if (old) old.remove();
    var t = document.createElement("div"); t.className = "ps-toast"; t.setAttribute("role", "status");
    var sp = document.createElement("span"); sp.textContent = text; t.appendChild(sp);
    var b = document.createElement("button"); b.type = "button"; b.textContent = btnText; b.addEventListener("click", function () { onBtn(); t.remove(); }); t.appendChild(b);
    var x = document.createElement("button"); x.type = "button"; x.className = "x"; x.setAttribute("aria-label", "Not now"); x.textContent = "✕"; x.addEventListener("click", function () { t.remove(); }); t.appendChild(x);
    document.body.appendChild(t); return t;
  }

  // ---------- offline app (service worker) ----------
  // New versions install in the background and WAIT. We then ask "New version ready - Refresh".
  // Pages are fetched network-first, so an online visitor never gets an old page.
  function setupSW() {
    if (!("serviceWorker" in navigator) || /[?&]test=1/.test(location.search) && !/[?&]sw=1/.test(location.search)) return;
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (reloading) return; reloading = true; location.reload(); });
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
  window.addEventListener("appinstalled", function () { deferred = null; showInstall(false); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-install]"); if (!b || !deferred) return;
    deferred.prompt(); deferred.userChoice.then(function () { deferred = null; showInstall(false); }).catch(function () {});
  });

  window.PaneSlideSite = { toast: toast };
  function start() { loadAds(); loadAnalytics(); setupSW(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
