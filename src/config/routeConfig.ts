import {
  Search,
  Save,
  FileText,
  MapPin,
  Info,
  MessageSquare,
  Compass,
  Plus,
  Settings as SettingsIcon,
  Wrench,
  BarChart3,
  File,
  ShoppingCart,
  Users,
} from "lucide-react";

import type { ComponentType } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AppRole =
  | "vendedor"
  | "test"
  | "supervisor"
  | "logistica"
  | "admin"
  | "administracion-cordoba";

export interface RouteConfig {
  /** Path de React Router */
  path: string;
  /** Nombre legible para el título del header */
  label: string;
  /** Icono de lucide-react (opcional: solo aparece si está en el menú lateral) */
  icon?: ComponentType<{ className?: string }>;
  /** Descripción corta para el sidebar */
  description?: string;
  /** Roles que pueden acceder a esta ruta */
  roles: AppRole[];
  /** Si es true, aparece en el menú lateral del rol */
  inMenu: boolean;
  /**
   * Ruta de redirección por defecto cuando el rol entra a "/".
   * Solo se usa en la entrada especial path: "/".
   */
  defaultRedirect?: Partial<Record<AppRole, string>>;
}

// ─── Tabla central ────────────────────────────────────────────────────────────
//
// Para agregar una ruta nueva:
//   1. Importá el componente página en App.tsx
//   2. Agregá un objeto acá con path, label, roles, e inMenu
//   3. Listo. El router y el sidebar se actualizan solos.
//
// ──────────────────────────────────────────────────────────────────────────────

export const ROUTES: RouteConfig[] = [
  // ── Ruta raíz ──────────────────────────────────────────────────────────────
  {
    path: "/",
    label: "Buscar Cliente",
    icon: Search,
    description: "Consultar información de clientes",
    roles: ["vendedor", "test", "supervisor", "admin"],
    inMenu: true,
    defaultRedirect: {
      "administracion-cordoba": "/pedido-compra",
      logistica: "/posible-rechazos",
    },
  },

  // ── Vendedor / Test ─────────────────────────────────────────────────────────
  {
    path: "/bonificaciones",
    label: "Bonificaciones",
    icon: Save,
    description: "Registrar bonificaciones",
    roles: ["vendedor", "test", "supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/notas-credito",
    label: "Notas de Crédito",
    icon: FileText,
    description: "Registrar notas de crédito",
    roles: ["vendedor", "test", "supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/gps-logger",
    label: "GPS Logger",
    icon: MapPin,
    description: "Registrar y ver coordenadas GPS",
    roles: ["vendedor", "test", "supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/informacion",
    label: "Información",
    icon: Info,
    description: "Resumen y clientes del día",
    roles: ["vendedor", "test", "logistica", "admin"],
    inMenu: true,
  },
  {
    path: "/baja-cliente",
    label: "Baja / Cambio Ruta",
    icon: FileText,
    description: "Solicitar baja o cambio de ruta",
    roles: ["vendedor", "test", "admin"],
    inMenu: true,
  },
  {
    path: "/video-log",
    label: "Videos",
    icon: FileText,
    description: "Ver videos disponibles",
    roles: ["vendedor", "test", "admin"],
    inMenu: true,
  },

  // ── Supervisor ──────────────────────────────────────────────────────────────
  {
    path: "/revisar-bonificaciones",
    label: "Revisar Bonificaciones",
    icon: FileText,
    description: "Aprobar bonificaciones cargadas",
    roles: ["supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/revisar-bajas",
    label: "Revisión de Bajas",
    icon: FileText,
    description: "Aprobar solicitudes de baja",
    roles: ["supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/pdfs",
    label: "Documentos PDF",
    icon: File,
    description: "Documentación interna",
    roles: ["supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/mapa",
    label: "Mapa de Visitas",
    icon: Compass,
    description: "Rutas y visitas",
    roles: ["supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/powerbi",
    label: "Dashboard Power BI",
    icon: BarChart3,
    description: "Indicadores",
    roles: ["supervisor", "admin"],
    inMenu: true,
  },
  {
    path: "/supervisor",
    label: "Supervisor",
    icon: Compass,
    description: "Panel del supervisor",
    roles: ["supervisor", "admin"],
    inMenu: true,
  },

  // ── Logística ───────────────────────────────────────────────────────────────
  {
    path: "/posible-rechazos",
    label: "Posible Rechazos",
    icon: Plus,
    description: "Registrar cliente y monto aproximado",
    roles: ["logistica", "admin"],
    inMenu: true,
  },
  {
    path: "/rechazos/nuevo",
    label: "Nuevo Rechazo",
    icon: Plus,
    description: "Registrar nuevo rechazo",
    roles: ["logistica", "admin"],
    inMenu: true,
  },
  {
    path: "/coordenadas",
    label: "Coordenadas",
    icon: MapPin,
    description: "Consultar coordenadas",
    roles: ["logistica", "admin"],
    inMenu: true,
  },

  // ── Compras (supervisor + admin + administracion-cordoba) ───────────────────
  {
    path: "/pedido-compra",
    label: "Pedido de Compra",
    icon: ShoppingCart,
    description: "Cargar un pedido de compra",
    roles: ["supervisor", "admin", "administracion-cordoba"],
    inMenu: true,
  },
  {
    path: "/revisar-compras",
    label: "Revisar Compras",
    icon: FileText,
    description: "Ver y aprobar pedidos de compra",
    roles: ["supervisor", "admin", "administracion-cordoba"],
    inMenu: true,
  },

  // ── Admin exclusivo ─────────────────────────────────────────────────────────
  {
    path: "/admin-equipo",
    label: "Equipo en Calle",
    icon: Users,
    description: "Ver PDV, visitas y horas del equipo",
    roles: ["admin"],
    inMenu: true,
  },
  {
    path: "/planilla-carga",
    label: "Planilla de Carga",
    icon: FileText,
    description: "Carga de planilla",
    roles: ["admin"],
    inMenu: false, // accesible pero no aparece en el sidebar
  },
  {
    path: "/admin",
    label: "Panel Admin",
    icon: Wrench,
    description: "Herramientas admin",
    roles: ["admin"],
    inMenu: true,
  },

  // ── B2B ─────────────────────────────────────────────────────────────────────
  {
    path: "/b2b/catalogo",
    label: "B2B - Catálogo",
    roles: ["admin"],
    inMenu: false,
  },
  {
    path: "/b2b/carrito",
    label: "B2B - Carrito",
    roles: ["admin"],
    inMenu: false,
  },
  {
    path: "/b2b/pedidos",
    label: "B2B - Pedidos",
    roles: ["admin"],
    inMenu: false,
  },

  // ── Comunes a todos los roles ───────────────────────────────────────────────
  {
    path: "/chat",
    label: "Chat",
    icon: MessageSquare,
    description: "Comunicación interna",
    roles: ["vendedor", "test", "supervisor", "logistica", "admin"],
    inMenu: true,
  },
  {
    path: "/settings",
    label: "Configuración",
    icon: SettingsIcon,
    description: "Configuración del usuario",
    roles: ["vendedor", "test", "supervisor", "logistica", "admin"],
    inMenu: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rutas accesibles para un rol dado */
export function getRoutesForRole(role: AppRole): RouteConfig[] {
  return ROUTES.filter((r) => r.roles.includes(role));
}

/** Items del menú lateral para un rol dado */
export function getMenuItemsForRole(role: AppRole): RouteConfig[] {
  return ROUTES.filter((r) => r.roles.includes(role) && r.inMenu);
}

/** Label del header para un path dado */
export function getLabelForPath(
  path: string,
  role?: AppRole
): string {
  if (path === "/") {
    if (role === "administracion-cordoba") return "Pedido de Compra";
    if (role === "logistica") return "Posible Rechazos";
    return "Buscar Cliente";
  }
  return ROUTES.find((r) => r.path === path)?.label ?? "VaFood SRL - AR";
}

/** Ruta de fallback (redirect) para un rol que entra a "/" */
export function getDefaultPathForRole(role: AppRole): string {
  const root = ROUTES.find((r) => r.path === "/");
  return root?.defaultRedirect?.[role] ?? "/";
}
