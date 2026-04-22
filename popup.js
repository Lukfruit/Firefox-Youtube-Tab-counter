// popup.js
// Entry point for the popup interface.

document.addEventListener("DOMContentLoaded", () => {
  // Load version
  const manifest = browser.runtime.getManifest();
  if (document.getElementById("ext-version")) {
    document.getElementById("ext-version").textContent = manifest.version;
  }

  // Start the controller
  window.YTA.Popup.Controller.init();
});
