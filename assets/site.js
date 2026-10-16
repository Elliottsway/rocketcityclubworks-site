/* Shared behavior: text links that carry where the visitor came from, and prices pulled from prices.js. */
(function(){
  var D = window.RCCW, R = D.rules;

  function money(n){ return typeof n === "number" ? "$" + (n % 1 ? n.toFixed(2) : String(n)) : n; }
  function grip(name){ for (var i = 0; i < D.grips.length; i++) if (D.grips[i].name === name) return D.grips[i]; }

  // ?ref=card / course / flyer is added to the pre-filled text so you can tell which piece brought someone in.
  // Also picks up ad and QR links: ?utm_source=facebook&utm_campaign=launch → FACEBOOK-LAUNCH. Kept for the visit and 30 days after.
  var qp = new URLSearchParams(location.search);
  var ref = (qp.get("ref") || [qp.get("utm_source"), qp.get("utm_campaign")].filter(Boolean).join("-") || "web").replace(/[^a-z0-9_-]/gi, "").toUpperCase().slice(0, 24) || "WEB";
  try {
    if (ref !== "WEB") { sessionStorage.setItem("rccw-ref", ref); localStorage.setItem("rccw-ref", JSON.stringify({ ref: ref, at: Date.now() })); }
    else { var keep = JSON.parse(localStorage.getItem("rccw-ref") || "null"); ref = sessionStorage.getItem("rccw-ref") || (keep && Date.now() - keep.at < 30 * 864e5 ? keep.ref : "") || ref; }
  } catch (e) {}

  function smsHref(body){ return "sms:" + D.phone + "?&body=" + encodeURIComponent(body); }

  // Fill <span data-p="regripOwn"> from rules, <span data-p="installed:Golf Pride Tour Velvet"> as grip + labor.
  document.querySelectorAll("[data-p]").forEach(function(el){
    var k = el.getAttribute("data-p"), v;
    if (k.indexOf("installed:") === 0) { var g = grip(k.slice(10)); if (g) v = Math.round((g.price + R.regripOurs) * 100) / 100; }
    else if (k.indexOf("grip:") === 0) { var g2 = grip(k.slice(5)); if (g2) v = g2.price; }
    else v = R[k];
    if (v != null) el.textContent = money(v);
  });
  document.querySelectorAll("[data-asof]").forEach(function(el){ el.textContent = D.asOf; });

  // Launch bundle: shown until its end date, then those elements remove themselves.
  var launchLive = new Date() < new Date(D.bundles.launchBag.endsISO + "T00:00:00");
  document.querySelectorAll("[data-launch]").forEach(function(el){ if (!launchLive) el.remove(); });
  document.querySelectorAll("[data-launch-price]").forEach(function(el){ el.textContent = money(D.bundles.launchBag.price); });
  document.querySelectorAll("[data-launch-ends]").forEach(function(el){ el.textContent = D.bundles.launchBag.ends; });
  document.querySelectorAll("[data-tuneup]").forEach(function(el){ el.textContent = money(D.bundles.tuneUpOff); });

  // Fade sections in as they scroll into view
  var rv = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(function(el){ io.observe(el); });
  } else rv.forEach(function(el){ el.classList.add("in"); });

  document.querySelectorAll(".js-text").forEach(function(a){
    a.href = smsHref("Hi Jackson! I'd like info on ClubWorks services. (" + ref + ")");
  });

  window.RCCWsite = { money: money, smsHref: smsHref, ref: ref, grip: grip, launchLive: launchLive };
})();
