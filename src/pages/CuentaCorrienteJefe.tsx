import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import {
  AlertCircle,
  TrendingDown,
  FileText,
  DollarSign,
  ChevronDown,
  Clock,
} from "lucide-react";

type Transporte = {
  username: string;
};

type SaldoRow = {
  cliente: string;
  razon_social: string;
  comprobante: string;
  descripcion_comprobante: string;
  letra: string;
  serie: string;
  numero: string;
  fecha: string;
  fecha_vencido: string;
  vencido: string;
  dias_de_mora: number;
  importe_total: number;
  saldo: number;
};

type PosibleRechazoRow = {
  id: number;
  numero_cliente: string;
  monto_aproximado: number;
  creado_por_username: string;
  created_at: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-AR");
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CuentaCorrienteJefe() {
  const [transportes, setTransportes] = useState<string[]>([]);
  const [selectedTransporte, setSelectedTransporte] = useState<string>("");
  const [saldos, setSaldos] = useState<SaldoRow[]>([]);
  const [rechazos, setRechazos] = useState<PosibleRechazoRow[]>([]);
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [loadingRechazos, setLoadingRechazos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Cargar lista de transportes únicos
  useEffect(() => {
    const fetchTransportes = async () => {
      const { data, error } = await supabase
        .from("cod_transportes")
        .select("username");

      if (error) {
        console.error("Error cargando transportes:", error);
        return;
      }

      const unicos = Array.from(
        new Set((data || []).map((r: Transporte) => r.username))
      ).sort();

      setTransportes(unicos);
      if (unicos.length > 0) setSelectedTransporte(unicos[0]);
    };

    fetchTransportes();
  }, []);

  // 2. Cargar saldos cuando cambia el transporte seleccionado
  useEffect(() => {
    if (!selectedTransporte) return;

    const fetchSaldos = async () => {
      setLoadingSaldos(true);
      setError(null);
      setSaldos([]);

      try {
        const { data: codData, error: codError } = await supabase
          .from("cod_transportes")
          .select("cliente")
          .eq("username", selectedTransporte);

        if (codError) throw codError;

        if (!codData || codData.length === 0) {
          setSaldos([]);
          setLoadingSaldos(false);
          return;
        }

        const codigosCliente = codData.map((r) => r.cliente);

        const { data: saldosData, error: saldosError } = await supabase
          .from("chess_saldos_totales")
          .select(
            "cliente, razon_social, comprobante, descripcion_comprobante, letra, serie, numero, fecha, fecha_vencido, vencido, dias_de_mora, importe_total, saldo"
          )
          .in("cliente", codigosCliente)
          .order("fecha_vencido", { ascending: true });

        if (saldosError) throw saldosError;

        setSaldos((saldosData || []) as SaldoRow[]);
      } catch (err: any) {
        console.error("Error cargando saldos:", err);
        setError(err?.message || "Error al cargar los datos");
      } finally {
        setLoadingSaldos(false);
      }
    };

    fetchSaldos();
  }, [selectedTransporte]);

  // 3. Cargar posibles rechazos en tiempo real
  useEffect(() => {
    const fetchRechazos = async () => {
      setLoadingRechazos(true);
      const { data, error } = await supabase
        .from("posibles_rechazos")
        .select("id, numero_cliente, monto_aproximado, creado_por_username, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error) setRechazos((data || []) as PosibleRechazoRow[]);
      setLoadingRechazos(false);
    };

    fetchRechazos();

    // Suscripción realtime
    const channel = supabase
      .channel("posibles_rechazos_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posibles_rechazos" },
        (payload) => {
          const nuevo = payload.new as PosibleRechazoRow;
          setRechazos((prev) => [nuevo, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const vencidos = saldos.filter((s) => s.vencido === "SI");
  const noVencidos = saldos.filter((s) => s.vencido !== "SI");
  const totalSaldo = saldos.reduce((acc, r) => acc + (r.saldo || 0), 0);
  const totalVencido = vencidos.reduce((acc, r) => acc + (r.saldo || 0), 0);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Panel izquierdo: Cuenta Corriente ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 min-w-0">

        {/* Header + selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <DollarSign className="h-6 w-6 text-red-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Cuenta Corriente</h1>
                <p className="text-gray-500 text-sm">Vista general por transporte</p>
              </div>
            </div>

            {/* Selector de transporte */}
            <div className="relative">
              <select
                value={selectedTransporte}
                onChange={(e) => setSelectedTransporte(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                {transportes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Resumen */}
          {!loadingSaldos && saldos.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Saldo Total</p>
                <p className={`text-xl font-bold ${totalSaldo < 0 ? "text-green-600" : "text-red-700"}`}>
                  {formatCurrency(totalSaldo)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs text-red-500 uppercase font-medium mb-1 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Vencido
                </p>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency(totalVencido)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingSaldos && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Sin datos */}
        {!loadingSaldos && !error && saldos.length === 0 && selectedTransporte && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Sin movimientos para {selectedTransporte}.</p>
          </div>
        )}

        {/* Vencidos */}
        {!loadingSaldos && vencidos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-100">
            <div className="px-5 py-3 border-b border-red-100 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <h2 className="font-semibold text-red-700">
                Vencidos ({vencidos.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 text-red-700">
                  <tr>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-left px-4 py-2">Razón Social</th>
                    <th className="text-left px-4 py-2">Comprobante</th>
                    <th className="text-left px-4 py-2">Vencimiento</th>
                    <th className="text-right px-4 py-2">Mora</th>
                    <th className="text-right px-4 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {vencidos.map((row, i) => (
                    <tr key={i} className="hover:bg-red-50 transition-colors">
                      <td className="px-4 py-2 font-mono text-gray-600">{row.cliente}</td>
                      <td className="px-4 py-2 text-gray-800">{row.razon_social}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {row.descripcion_comprobante} {row.letra} {row.serie}-{row.numero}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(row.fecha_vencido)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {row.dias_de_mora}d
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-red-700">
                        {formatCurrency(row.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Al día */}
        {!loadingSaldos && noVencidos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-700">Al Día ({noVencidos.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-left px-4 py-2">Razón Social</th>
                    <th className="text-left px-4 py-2">Comprobante</th>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Vencimiento</th>
                    <th className="text-right px-4 py-2">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {noVencidos.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-mono text-gray-600">{row.cliente}</td>
                      <td className="px-4 py-2 text-gray-800">{row.razon_social}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {row.descripcion_comprobante} {row.letra} {row.serie}-{row.numero}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(row.fecha)}</td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(row.fecha_vencido)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">
                        {formatCurrency(row.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Divisor vertical ── */}
      <div className="w-px bg-gray-200 flex-shrink-0" />

      {/* ── Panel derecho: Posibles Rechazos en tiempo real ── */}
      <div className="w-80 flex-shrink-0 overflow-y-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-red-600" />
          <h2 className="font-bold text-gray-800">Posibles Rechazos</h2>
          <span className="ml-auto bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
            En vivo
          </span>
        </div>

        {loadingRechazos && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-700" />
          </div>
        )}

        {!loadingRechazos && rechazos.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            Sin rechazos cargados aún.
          </div>
        )}

        {rechazos.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                {r.creado_por_username}
              </span>
              <span className="text-xs text-gray-400">{formatDateTime(r.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Cliente <span className="font-mono font-medium text-gray-800">{r.numero_cliente}</span>
              </span>
              <span className="text-sm font-bold text-red-700">
                {formatCurrency(r.monto_aproximado)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
