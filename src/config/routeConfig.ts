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
  DollarSign,
} from "lucide-react";

import type { ComponentType } from "react";

export type AppRole =
  | "vendedor"
  | "test"
  | "supervisor"
  | "logistica"
  | "jefe-transporte"
  | "admin"
  | "administracion-cordoba";

export interface RouteConfig {
  path: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  description?: string;
  roles: AppRole[];
  inMenu: boolean;
  defaultRedirect?: Partial<Record<AppRole, string>>;
}

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
      "jefe-transporte": "/cuenta-corriente-jefe",
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
    roles: ["vendedor", "test", "admin"],
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
    path: "/alta-cliente",
    label: "Alta de Clientes",
    icon: Plus,
    description: "Registrar nuevo cliente",
    roles: ["admin"],
    inMenu: true,
  },
  {
    path: "/video-log",
    label: "Videos",
    icon: FileText,
    description: "Ver videos disponibles",
    roles: ["vendedor", "test", "supervisor", "admin"],
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
    roles: ["admin"],
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
  {
    path: "/cuenta-corriente",
    label: "Cuenta Corriente",
    icon: DollarSign,
    description: "Ver deuda en cuenta corriente",
    roles: ["logistica", "admin"],
    inMenu: true,
  },

  // ── Jefe Transporte ─────────────────────────────────────────────────────────
  {
    path: "/cuenta-corriente-jefe",
    label: "Cuenta Corriente",
    icon: DollarSign,
    description: "Ver cuentas corrientes de todos los transportes",
    roles: ["jefe-transporte", "admin"],
    inMenu: true,
  },
  {
    path: "/posible-rechazos",
    label: "Posible Rechazos",
    icon: Plus,
    description: "Registrar cliente y monto aproximado",
    roles: ["jefe-transporte"],
    inMenu: true,
  },
  {
    path: "/coordenadas",
    label: "Coordenadas",
    icon: MapPin,
    description: "Consultar coordenadas",
    roles: ["jefe-transporte"],
    inMenu: true,
  },

  // ── Compras ─────────────────────────────────────────────────────────────────
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
    path: "/vendedores-resumen",
    label: "Resumen Vendedores",
    icon: BarChart3,
    description: "Ventas y actividad de todo el equipo",
    roles: ["admin"],
    inMenu: true,
  },
  {
    path: "/planilla-carga",
    label: "Planilla de Carga",
    icon: FileText,
    description: "Carga de planilla",
    roles: ["admin"],
    inMenu: false,
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

  // ── Comunes ─────────────────────────────────────────────────────────────────
  {
    path: "/chat",
    label: "Chat",
    icon: MessageSquare,
    description: "Comunicación interna",
    roles: ["vendedor", "test", "supervisor", "logistica", "jefe-transporte", "admin"],
    inMenu: true,
  },
  {
    path: "/settings",
    label: "Configuración",
    icon: SettingsIcon,
    description: "Configuración del usuario",
    roles: ["vendedor", "test", "supervisor", "logistica", "jefe-transporte", "admin"],
    inMenu: true,
  },
];

export function getRoutesForRole(role: AppRole): RouteConfig[] {
  return ROUTES.filter((r) => r.roles.includes(role));
}

export function getMenuItemsForRole(role: AppRole): RouteConfig[] {
  return ROUTES.filter((r) => r.roles.includes(role) && r.inMenu);
}

export function getLabelForPath(path: string, role?: AppRole): string {
  if (path === "/") {
    if (role === "administracion-cordoba") return "Pedido de Compra";
    if (role === "logistica") return "Posible Rechazos";
    if (role === "jefe-transporte") return "Cuenta Corriente";
    return "Buscar Cliente";
  }
  return ROUTES.find((r) => r.path === path)?.label ?? "VaFood SRL - AR";
}

export function getDefaultPathForRole(role: AppRole): string {
  const root = ROUTES.find((r) => r.path === "/");
  return root?.defaultRedirect?.[role] ?? "/";
}
