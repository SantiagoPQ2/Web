// src/hooks/useUserPermissions.ts
// Carga los permisos extra del usuario logueado desde Supabase
// y los combina con las rutas base de su rol.

import { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { ROUTES, getRoutesForRole, type AppRole, type RouteConfig } from "../config/routeConfig";

export function useUserPermissions(userId: string | undefined, role: AppRole | undefined) {
  const [extraPaths, setExtraPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !role) {
      setExtraPaths([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase
      .from("usuario_permisos_extra")
      .select("path")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        setExtraPaths((data ?? []).map((r: any) => r.path));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, role]);

  // Rutas base del rol + rutas extra del usuario
  const allRoutes: RouteConfig[] = (() => {
    if (!role) return [];
    const base = getRoutesForRole(role);
    const basePaths = new Set(base.map((r) => r.path));

    const extras = ROUTES.filter(
      (r) => extraPaths.includes(r.path) && !basePaths.has(r.path)
    );

    return [...base, ...extras];
  })();

  return { allRoutes, loading };
}
