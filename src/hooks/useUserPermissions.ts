// src/hooks/useUserPermissions.ts
import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { ROUTES, getRoutesForRole, type AppRole, type RouteConfig } from "../config/routeConfig";

export function useUserPermissions(userId: string | undefined, role: AppRole | undefined) {
  const [overrides, setOverrides] = useState<{ path: string; revocado: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !role) {
      setOverrides([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase
      .from("usuario_permisos_extra")
      .select("path, revocado")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        setOverrides((data ?? []).map((r: any) => ({ path: r.path, revocado: r.revocado === true })));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, role]);

  const allRoutes: RouteConfig[] = (() => {
    if (!role) return [];
    const base = getRoutesForRole(role);
    const basePaths = new Set(base.map((r) => r.path));

    // Rutas extra concedidas (revocado=false, no están en base)
    const extras = ROUTES.filter((r) => {
      const override = overrides.find((o) => o.path === r.path);
      return override && !override.revocado && !basePaths.has(r.path);
    });

    // Rutas base minus las revocadas
    const baseFiltered = base.filter((r) => {
      const override = overrides.find((o) => o.path === r.path);
      return !override || !override.revocado;
    });

    return [...baseFiltered, ...extras];
  })();

  return { allRoutes, loading };
}
