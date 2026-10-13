/* Shared behavior: text links that carry where the visitor came from, and prices pulled from prices.js. */
(function(){
  var D = window.RCCW, R = D.rules;

  function money(n){ return typeof n === "number" ? "$" + (n % 1 ? n.toFixed(2) : String(n)) : n; }
  function grip(name){ for (var i = 0; i < D.grips.length; i++) if (D.grips[i].name === name) return D.grips[i]; }

  // ?ref=card / course / flyer is added to the pre-filled text so you can tell which piece brought someone in.
  var ref = (new URLSearchParams(location.search).get("ref") || "web").replace(/[^a-z0-9-]/gi, "").toUpperCase().slice(0, 12) || "WEB";
  try { if (ref !== "WEB") sessionStorage.setItem("rccw-ref", ref); else ref = sessionStorage.getItem("rccw-ref") || ref; } catch (e) {}

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

  document.querySelectorAll(".js-text").forEach(function(a){
    a.href = smsHref("Hi Jackson! I'd like info on ClubWorks services. (" + ref + ")");
  });

  window.RCCWsite = { money: money, smsHref: smsHref, ref: ref, grip: grip };
})();
