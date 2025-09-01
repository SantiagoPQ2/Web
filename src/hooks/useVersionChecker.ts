import { useEffect, useState } from "react";

export function useVersionChecker(interval: number = 60000) {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    let currentVersion: string | null = null;

    const checkVersion = async () => {
      try {
        const response = await fetch("/version.json", {
          cache: "no-cache", // 🔥 así siempre consulta al servidor
        });
        const data = await response.json();

        if (!currentVersion) {
          currentVersion = data.version;
        } else if (currentVersion !== data.version) {
          setHasUpdate(true);
        }
      } catch (err) {
        console.error("Error al verificar versión:", err);
      }
    };

    checkVersion();
    const id = setInterval(checkVersion, interval);

    return () => clearInterval(id);
  }, [interval]);

  return hasUpdate;
}
