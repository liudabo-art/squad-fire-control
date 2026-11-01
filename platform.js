(function () {
  'use strict';
  window.Platform = {
    async savePlan(content) {
      if (window.DesktopApp) return window.DesktopApp.savePlan(content);
      if (window.AndroidApp) { window.AndroidApp.savePlan(content); return true; }
      var url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      var link = document.createElement('a');
      link.href = url; link.download = 'sqd-fire-plan.json'; link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    },
    async copyText(text) {
      if (window.DesktopApp) return window.DesktopApp.copyText(text);
      if (window.AndroidApp) { window.AndroidApp.copyText(text); return; }
      try { await navigator.clipboard.writeText(text); }
      catch (_) { window.prompt('复制射击口令', text); }
    }
  };
})();
