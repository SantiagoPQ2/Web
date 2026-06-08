import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Users,
  Grid3X3,
  UserPlus,
  Edit3,
  Key,
  Power,
  Check,
  X,
  Save,
  RefreshCw,
  Shield,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Minus,
} from "lucide-react";
import { supabase } from "../config/supabase";
import { ROUTES, type AppRole } from "../config/routeConfig";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Usuario {
  id: string;
  username: string;
  name: string;
  role: AppRole;
  password?: string;
  mail?: string;
  active: boolean;
  FFVV?: string;
  ffvv?: string;
  supervisor?: string;
  phone?: string;
}

interface PermisoExtra {
  id: string;
  user_id: string;
  path: string;
  revocado: boolean;
}

type Tab = "permisos" | "usuarios";

// Estado de un checkbox: true=acceso, false=sin acceso, "base"=acceso por rol (sin override)
type CheckState = true | false | "base";

const ALL_ROLES: AppRole[] = [
  "vendedor",
  "test",
  "supervisor",
  "logistica",
  "jefe-transporte",
  "admin",
  "administracion-cordoba",
];

const ROLE_COLORS: Record<AppRole, string> = {
  vendedor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  test: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  supervisor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  logistica: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "jefe-transporte": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  admin: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "administracion-cordoba": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

const PAGES_FOR_GRID = ROUTES.filter(
  (r) => r.path !== "/b2b/catalogo" && r.path !== "/b2b/carrito" && r.path !== "/b2b/pedidos"
);

function roleHasPath(role: AppRole, path: string): boolean {
  return ROUTES.some((r) => r.path === path && r.roles.includes(role));
}

export default function AdminUsuarios() {
  const [tab, setTab] = useState<Tab>("permisos");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisos, setPermisos] = useState<PermisoExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Grilla ─────────────────────────────────────────────────────────────────
  // pendientes: clave = "userId||path", valor = true | false | null (null = volver al estado base/borrar override)
  const [permisosPendientes, setPermisosPendientes] = useState<
    Record<string, boolean | null>
  >({});
  const [savingPermisos, setSavingPermisos] = useState(false);
  const [filtroGrilla, setFiltroGrilla] = useState("");
  const [scrollPage, setScrollPage] = useState(0);
  const COLS_PER_PAGE = 8;

  // ── Usuarios ───────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [modalUsuario, setModalUsuario] = useState<{
    modo: "crear" | "editar";
    usuario?: Usuario;
  } | null>(null);
  const [modalPassword, setModalPassword] = useState<Usuario | null>(null);
  const [savingUsuario, setSavingUsuario] = useState(false);
  const [form, setForm] = useState<Partial<Usuario> & { password?: string }>({});
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u, error: uErr } = await supabase
        .from("usuarios_app")
        .select("id, username, name, role, mail, active, FFVV, supervisor, phone");

      if (uErr) {
        console.error("Error cargando usuarios_app:", uErr);
        showToast("Error cargando usuarios: " + uErr.message, false);
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("usuario_permisos_extra")
        .select("*");

      if (pErr) {
        console.warn("usuario_permisos_extra no disponible aún:", pErr.message);
      }

      const sorted = (u ?? []).sort((a: any, b: any) =>
        (a.name ?? "").localeCompare(b.name ?? "", "es")
      );

      setUsuarios(
        sorted.map((x: any) => ({
          ...x,
          active: x.active !== false,
        }))
      );
      setPermisos(
        (p ?? []).map((x: any) => ({
          ...x,
          revocado: x.revocado === true,
        }))
      );
    } catch (e: any) {
      console.error("Error general en AdminUsuarios:", e);
      showToast("Error cargando datos: " + (e?.message ?? ""), false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ─── GRILLA ────────────────────────────────────────────────────────────────

  const usuariosFiltradosGrilla = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          !filtroGrilla ||
          u.name?.toLowerCase().includes(filtroGrilla.toLowerCase()) ||
          u.username?.toLowerCase().includes(filtroGrilla.toLowerCase())
      ),
    [usuarios, filtroGrilla]
  );

  const totalColPages = Math.ceil(PAGES_FOR_GRID.length / COLS_PER_PAGE);
  const visibleCols = PAGES_FOR_GRID.slice(
    scrollPage * COLS_PER_PAGE,
    scrollPage * COLS_PER_PAGE + COLS_PER_PAGE
  );

  const key = (userId: string, path: string) => `${userId}||${path}`;

  // Devuelve el estado efectivo de un checkbox considerando pendientes
  // "base" = acceso por rol sin override guardado ni pendiente
  // true = acceso (extra concedido o base sin revocar)
  // false = sin acceso (base revocado o extra no concedido)
  const getEstado = (userId: string, role: AppRole, path: string): CheckState => {
    const k = key(userId, path);
    const esBase = roleHasPath(role, path);
    const permisoGuardado = permisos.find((p) => p.user_id === userId && p.path === path);

    // Si hay cambio pendiente, ese manda
    if (k in permisosPendientes) {
      const pend = permisosPendientes[k];
      if (pend === null) return esBase ? "base" : false;
      return pend ? true : false;
    }

    // Si hay override guardado
    if (permisoGuardado) {
      return permisoGuardado.revocado ? false : true;
    }

    // Sin override: estado base del rol
    return esBase ? "base" : false;
  };

  // Ciclo al hacer click:
  // - Si es "base" (acceso por rol, sin override) → revocar (false)
  // - Si es false y era base → volver a base (null = borrar override)
  // - Si es false y NO era base → dar acceso extra (true)
  // - Si es true (acceso extra) → quitar (false)
  const togglePermiso = (userId: string, role: AppRole, path: string) => {
    const k = key(userId, path);
    const esBase = roleHasPath(role, path);
    const estado = getEstado(userId, role, path);
    const permisoGuardado = permisos.find((p) => p.user_id === userId && p.path === path);

    if (estado === "base") {
      // Revocar acceso base
      setPermisosPendientes((prev) => ({ ...prev, [k]: false }));
    } else if (estado === false && esBase) {
      // Tenía base revocado → restaurar (null = borrar override)
      setPermisosPendientes((prev) => {
        const next = { ...prev };
        if (permisoGuardado) {
          next[k] = null; // marcar para borrar
        } else {
          delete next[k]; // nunca se guardó, simplemente sacar del pendiente
        }
        return next;
      });
    } else if (estado === false && !esBase) {
      // No tiene acceso y no es base → dar acceso extra
      setPermisosPendientes((prev) => ({ ...prev, [k]: true }));
    } else if (estado === true) {
      // Tiene acceso extra → quitarlo
      setPermisosPendientes((prev) => {
        const next = { ...prev };
        if (permisoGuardado && !permisoGuardado.revocado) {
          next[k] = null; // marcar para borrar
        } else {
          next[k] = false;
        }
        return next;
      });
    }
  };

  const cambiosCount = Object.keys(permisosPendientes).length;

  const guardarPermisos = async () => {
    setSavingPermisos(true);
    try {
      const toInsert: { user_id: string; path: string; revocado: boolean }[] = [];
      const toUpdate: { id: string; revocado: boolean }[] = [];
      const toDelete: string[] = [];

      for (const [k, valor] of Object.entries(permisosPendientes)) {
        const [userId, path] = k.split("||");
        const existente = permisos.find((p) => p.user_id === userId && p.path === path);

        if (valor === null) {
          // Borrar override existente
          if (existente) toDelete.push(existente.id);
        } else if (existente) {
          // Actualizar override existente
          toUpdate.push({ id: existente.id, revocado: !valor });
        } else {
          // Insertar nuevo override
          toInsert.push({ user_id: userId, path, revocado: !valor });
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("usuario_permisos_extra").insert(toInsert);
        if (error) throw error;
      }
      for (const upd of toUpdate) {
        const { error } = await supabase
          .from("usuario_permisos_extra")
          .update({ revocado: upd.revocado })
          .eq("id", upd.id);
        if (error) throw error;
      }
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("usuario_permisos_extra")
          .delete()
          .in("id", toDelete);
        if (error) throw error;
      }

      setPermisosPendientes({});
      await cargar();
      showToast(
        `Guardado: ${toInsert.length} nuevos, ${toUpdate.length} actualizados, ${toDelete.length} eliminados`
      );
    } catch (e: any) {
      showToast("Error guardando permisos: " + (e.message ?? ""), false);
    } finally {
      setSavingPermisos(false);
    }
  };

  const descartarCambios = () => setPermisosPendientes({});

  // ─── GESTIÓN USUARIOS ──────────────────────────────────────────────────────

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          !busqueda ||
          u.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
          u.username?.toLowerCase().includes(busqueda.toLowerCase()) ||
          u.role?.toLowerCase().includes(busqueda.toLowerCase())
      ),
    [usuarios, busqueda]
  );

  const abrirCrear = () => {
    setForm({ active: true, role: "vendedor" });
    setModalUsuario({ modo: "crear" });
  };

  const abrirEditar = (u: Usuario) => {
    setForm({ ...u });
    setModalUsuario({ modo: "editar", usuario: u });
  };

  const guardarUsuario = async () => {
    if (!form.username || !form.name || !form.role) {
      showToast("Completá usuario, nombre y rol", false);
      return;
    }
    setSavingUsuario(true);
    try {
      if (modalUsuario?.modo === "crear") {
        if (!form.password) {
          showToast("Ingresá una contraseña", false);
          setSavingUsuario(false);
          return;
        }
        const { error } = await supabase.from("usuarios_app").insert({
          username: form.username,
          name: form.name,
          role: form.role,
          password: form.password,
          mail: form.mail ?? null,
          active: form.active ?? true,
          FFVV: form.FFVV ?? null,
          supervisor: form.supervisor ?? null,
          phone: form.phone ?? null,
        });
        if (error) throw error;
        showToast("Usuario creado");
      } else {
        const { error } = await supabase
          .from("usuarios_app")
          .update({
            name: form.name,
            role: form.role,
            mail: form.mail ?? null,
            active: form.active ?? true,
            FFVV: form.FFVV ?? null,
            supervisor: form.supervisor ?? null,
            phone: form.phone ?? null,
          })
          .eq("id", modalUsuario!.usuario!.id);
        if (error) throw error;
        showToast("Usuario actualizado");
      }
      setModalUsuario(null);
      await cargar();
    } catch (e: any) {
      showToast("Error: " + (e.message ?? ""), false);
    } finally {
      setSavingUsuario(false);
    }
  };

  const cambiarPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      showToast("La contraseña debe tener al menos 4 caracteres", false);
      return;
    }
    setSavingUsuario(true);
    try {
      const { error } = await supabase
        .from("usuarios_app")
        .update({ password: newPassword })
        .eq("id", modalPassword!.id);
      if (error) throw error;
      showToast("Contraseña actualizada");
      setModalPassword(null);
      setNewPassword("");
    } catch (e: any) {
      showToast("Error: " + (e.message ?? ""), false);
    } finally {
      setSavingUsuario(false);
    }
  };

  const toggleActivo = async (u: Usuario) => {
    try {
      const { error } = await supabase
        .from("usuarios_app")
        .update({ active: !u.active })
        .eq("id", u.id);
      if (error) throw error;
      showToast(u.active ? `${u.name} desactivado` : `${u.name} activado`);
      await cargar();
    } catch (e: any) {
      showToast("Error: " + (e.message ?? ""), false);
    }
  };

  // ─── Render checkbox ───────────────────────────────────────────────────────

  const renderCheckbox = (userId: string, role: AppRole, path: string) => {
    const k = key(userId, path);
    const hayPendiente = k in permisosPendientes;
    const estado = getEstado(userId, role, path);
    const esBase = roleHasPath(role, path);

    // Colores y ícono según estado
    let bgClass = "";
    let borderClass = "";
    let icon: React.ReactNode = null;
    let title = "";

    if (estado === "base") {
      // Acceso por rol, sin override — gris con check
      bgClass = "bg-gray-200 dark:bg-gray-600";
      borderClass = "border border-gray-300 dark:border-gray-500";
      icon = <Check className="w-3 h-3 text-gray-500 dark:text-gray-300" />;
      title = "Acceso por rol — click para revocar";
    } else if (estado === true) {
      // Acceso extra concedido — verde
      bgClass = "bg-emerald-500 hover:bg-emerald-600";
      borderClass = "";
      icon = <Check className="w-3 h-3 text-white" />;
      title = "Acceso extra — click para quitar";
    } else {
      // Sin acceso (revocado o nunca tuvo) — vacío con borde rojo si era base, gris si no
      bgClass = esBase
        ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100"
        : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20";
      borderClass = esBase
        ? "border-2 border-red-300 dark:border-red-700"
        : "border-2 border-gray-300 dark:border-gray-500 hover:border-emerald-400";
      icon = esBase ? <Minus className="w-3 h-3 text-red-400" /> : null;
      title = esBase
        ? "Revocado — click para restaurar acceso base"
        : "Sin acceso — click para dar acceso extra";
    }

    return (
      <button
        onClick={() => togglePermiso(userId, role, path)}
        className={`
          w-5 h-5 rounded flex items-center justify-center transition-all
          ${bgClass} ${borderClass}
          ${hayPendiente ? "ring-2 ring-amber-400 ring-offset-1" : ""}
        `}
        title={title}
      >
        {icon}
      </button>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#8B0000]" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {usuarios.length} usuarios · {permisos.filter(p => !p.revocado).length} permisos extra activos
          </p>
        </div>
        <button
          onClick={cargar}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          title="Recargar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("permisos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "permisos"
              ? "bg-white dark:bg-gray-700 text-[#8B0000] shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
          Grilla de Permisos
          {cambiosCount > 0 && (
            <span className="bg-[#8B0000] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {cambiosCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("usuarios")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "usuarios"
              ? "bg-white dark:bg-gray-700 text-[#8B0000] shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Usuarios
        </button>
      </div>

      {/* ── TAB: GRILLA ──────────────────────────────────────────────────────── */}
      {tab === "permisos" && (
        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar usuario..."
                value={filtroGrilla}
                onChange={(e) => setFiltroGrilla(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>
                Páginas {scrollPage * COLS_PER_PAGE + 1}–
                {Math.min((scrollPage + 1) * COLS_PER_PAGE, PAGES_FOR_GRID.length)} de{" "}
                {PAGES_FOR_GRID.length}
              </span>
              <button
                disabled={scrollPage === 0}
                onClick={() => setScrollPage((p) => p - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={scrollPage >= totalColPages - 1}
                onClick={() => setScrollPage((p) => p + 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {cambiosCount > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={descartarCambios}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                  Descartar ({cambiosCount})
                </button>
                <button
                  onClick={guardarPermisos}
                  disabled={savingPermisos}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-[#8B0000] text-white rounded-lg hover:bg-[#6b0000] disabled:opacity-60"
                >
                  {savingPermisos ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar cambios
                </button>
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-gray-400" />
              </span>
              Acceso por rol
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </span>
              Acceso extra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 flex items-center justify-center">
                <Minus className="w-3 h-3 text-red-400" />
              </span>
              Acceso revocado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded border-2 border-gray-300 ring-2 ring-amber-400" />
              Cambio pendiente
            </span>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[180px]">
                    Usuario
                  </th>
                  {visibleCols.map((page) => (
                    <th
                      key={page.path}
                      className="px-2 py-2 text-center border-b border-gray-200 dark:border-gray-700 min-w-[90px] max-w-[90px]"
                    >
                      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight break-words">
                        {page.label}
                      </div>
                      <div className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">
                        {page.path}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuariosFiltradosGrilla.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={`
                      border-b border-gray-100 dark:border-gray-700/50 last:border-0
                      ${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/30"}
                      hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors
                    `}
                  >
                    <td
                      className={`sticky left-0 z-10 px-4 py-2.5 border-r border-gray-200 dark:border-gray-700 ${
                        idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                          {u.name || u.username}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {u.role}
                          </span>
                          {!u.active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 font-medium">
                              inactivo
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {visibleCols.map((page) => (
                      <td key={page.path} className="px-2 py-2 text-center">
                        <div className="flex justify-center">
                          {renderCheckbox(u.id, u.role, page.path)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usuariosFiltradosGrilla.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No hay usuarios que coincidan
            </div>
          )}
        </div>
      )}

      {/* ── TAB: USUARIOS ────────────────────────────────────────────────────── */}
      {tab === "usuarios" && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, usuario, rol..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
              />
            </div>
            <button
              onClick={abrirCrear}
              className="flex items-center gap-2 px-4 py-2 bg-[#8B0000] text-white text-sm rounded-lg hover:bg-[#6b0000] transition-colors ml-auto"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo usuario
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Rol</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Mail</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">FFVV</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={`
                      border-b border-gray-100 dark:border-gray-700/50 last:border-0
                      ${idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/30 dark:bg-gray-800/30"}
                      ${!u.active ? "opacity-50" : ""}
                    `}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.mail || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{u.FFVV || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                        u.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-red-500"}`} />
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                          title="Editar usuario"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setModalPassword(u); setNewPassword(""); setShowPwd(false); }}
                          className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 transition-colors"
                          title="Cambiar contraseña"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.active
                              ? "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                              : "hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"
                          }`}
                          title={u.active ? "Desactivar usuario" : "Activar usuario"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usuariosFiltrados.length === 0 && (
            <div className="text-center py-12 text-gray-400">No hay usuarios que coincidan</div>
          )}
        </div>
      )}

      {/* ── MODAL: Crear / Editar ───────────────────────────────────────────── */}
      {modalUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {modalUsuario.modo === "crear" ? "Nuevo usuario" : "Editar usuario"}
              </h2>
              <button onClick={() => setModalUsuario(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: "Nombre completo *", field: "name", placeholder: "Juan Pérez", type: "text" },
                { label: "Username *", field: "username", placeholder: "juan.perez", type: "text", disabled: modalUsuario.modo === "editar" },
                { label: "Mail", field: "mail", placeholder: "juan@empresa.com", type: "email" },
                { label: "FFVV", field: "FFVV", placeholder: "EUSCKOR / VAFOOD...", type: "text" },
                { label: "Supervisor (username)", field: "supervisor", placeholder: "supervisor.username", type: "text" },
                { label: "Teléfono", field: "phone", placeholder: "+54 9 11...", type: "text" },
              ].map(({ label, field, placeholder, type, disabled }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[field] ?? ""}
                    disabled={disabled}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={placeholder}
                  />
                  {field === "username" && disabled && (
                    <p className="text-[10px] text-gray-400 mt-0.5">El username no se puede cambiar</p>
                  )}
                </div>
              ))}

              {modalUsuario.modo === "crear" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contraseña *</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={form.password ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                      placeholder="Mínimo 4 caracteres"
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Rol *</label>
                <select
                  value={form.role ?? "vendedor"}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                >
                  {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuario activo</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalUsuario(null)} className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button
                onClick={guardarUsuario}
                disabled={savingUsuario}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-[#8B0000] text-white rounded-xl hover:bg-[#6b0000] disabled:opacity-60"
              >
                {savingUsuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {modalUsuario.modo === "crear" ? "Crear usuario" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Cambiar contraseña ───────────────────────────────────────── */}
      {modalPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Cambiar contraseña</h2>
              <button onClick={() => setModalPassword(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Usuario: <span className="font-semibold text-gray-800 dark:text-gray-100">{modalPassword.name} ({modalPassword.username})</span>
            </p>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                placeholder="Nueva contraseña"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalPassword(null)} className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button
                onClick={cambiarPassword}
                disabled={savingUsuario}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-[#8B0000] text-white rounded-xl hover:bg-[#6b0000] disabled:opacity-60"
              >
                {savingUsuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
