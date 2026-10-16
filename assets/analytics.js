/* Google Ads tag. Loaded on customer pages only (never the dashboard).
   A sent request or quote fires begin_checkout, the Ads conversion; a cleared payment fires purchase. */
(function(){
  var ID = 'AW-18517574264';
  if (location.hostname !== 'rocketcityclubworks.com' && location.hostname !== 'www.rocketcityclubworks.com') { window.RCCWtrack = function(){}; return; }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ID);
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  // RCCWtrack('begin_checkout', {value: 45, currency: 'USD', transaction_id: 'RC-1042'})
  window.RCCWtrack = function(name, params){ try { window.gtag('event', name, params || {}); } catch (e) {} };
})();
