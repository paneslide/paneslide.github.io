/* Archive of past daily puzzles. Each day opens the game with ?date=YYYY-MM-DD.
   Past days are practice: they never change your streak, stats or shards. Future days are locked. */
(function () {
  "use strict";
  var EPOCH = "2026-10-27"; // puzzle #1 (same as js/engine.js)
  function pad(n) { return String(n).padStart(2, "0"); }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var today = key(new Date()), start = parse(EPOCH), end = parse(today);
  var box = document.getElementById("archive"); if (!box) return;
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var html = "", won = 0, total = 0;
  // newest month first
  var m = new Date(end.getFullYear(), end.getMonth(), 1);
  while (m >= new Date(start.getFullYear(), start.getMonth(), 1)) {
    var name = m.toLocaleString("en", { month: "long", year: "numeric" });
    html += "<section class='arc-month' aria-label='" + name + "'><h2>" + name + "</h2><div class='arc-days'>";
    DOW.forEach(function (d) { html += "<div class='arc-dow' aria-hidden='true'>" + d + "</div>"; });
    var lead = (m.getDay() + 6) % 7; for (var i = 0; i < lead; i++) html += "<div aria-hidden='true'></div>";
    var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (var d = 1; d <= days; d++) {
      var dt = new Date(m.getFullYear(), m.getMonth(), d), k = key(dt);
      var num = Math.round((dt - start) / 86400000) + 1;
      if (dt < start) { html += "<div class='arc-day off' aria-hidden='true'>" + d + "</div>"; continue; }
      if (dt > end) { html += "<span class='arc-day off' aria-label='" + k + ", not out yet'>" + d + "<small>🔒</small></span>"; continue; }
      var st = load("ps2:game:" + k), ok = st && st.status === "won"; total++; if (ok) won++;
      var label = "Daily #" + num + ", " + dt.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" }) + (ok ? ", solved" : "") + (k === today ? ", today" : "");
      var href = k === today ? "/?mode=daily" : "/?date=" + k;
      html += "<a class='arc-day" + (ok ? " won" : "") + (k === today ? " today" : "") + "' href='" + href + "' aria-label='" + label + "'>" + d + "<small>" + (ok ? "✔" : "#" + num) + "</small></a>";
    }
    html += "</div></section>";
    m = new Date(m.getFullYear(), m.getMonth() - 1, 1);
  }
  box.innerHTML = html;
  var s = document.getElementById("arcCount");
  if (s) s.textContent = won + " of " + total + " daily puzzles solved on this device.";
})();
