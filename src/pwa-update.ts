export function enableAutoUpdate() {
  if ("serviceWorker" in navigator) {
    // Detecta cuando el nuevo SW toma control
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("Nueva versión detectada. Recargando...");
      window.location.reload();
    });

    // Fuerza la actualización inmediata del SW si ya está esperando
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }
}
