import React, { useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, TrendingDown, FileText, DollarSign } from "lucide-react";

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

export default function CuentaCorriente() {
  const { user } = useAuth();

  const [saldos, setSaldos] = useState<SaldoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSaldo, setTotalSaldo] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.username) return;

      setLoading(true);
      setError(null);

      try {
        // 1. Buscar los códigos de cliente del transporte logueado
        const { data: codData, error: codError } = await supabase
          .from("cod_transportes")
          .select("cliente")
          .eq("username", user.username);

        if (codError) throw codError;

        if (!codData || codData.length === 0) {
          setSaldos([]);
          setLoading(false);
          return;
        }

        const codigosCliente = codData.map((r) => r.cliente);

        // 2. Buscar en chess_saldos_totales con esos códigos
        const { data: saldosData, error: saldosError } = await supabase
          .from("chess_saldos_totales")
          .select(
            "cliente, razon_social, comprobante, descripcion_comprobante, letra, serie, numero, fecha, fecha_vencido, vencido, dias_de_mora, importe_total, saldo"
          )
          .in("cliente", codigosCliente)
          .order("fecha_vencido", { ascending: true });

        if (saldosError) throw saldosError;

        const rows = (saldosData || []) as SaldoRow[];
        setSaldos(rows);
        setTotalSaldo(rows.reduce((acc, r) => acc + (r.saldo || 0), 0));
      } catch (err: any) {
        console.error("Error cargando cuenta corriente:", err);
        setError(err?.message || "Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.username]);

  const vencidos = saldos.filter((s) => s.vencido === "SI");
  const noVencidos = saldos.filter((s) => s.vencido !== "SI");
  const totalVencido = vencidos.reduce((acc, r) => acc + (r.saldo || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  if (saldos.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron movimientos en cuenta corriente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center mb-4">
          <div className="bg-red-100 rounded-full p-2 mr-3">
            <DollarSign className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuenta Corriente</h1>
            <p className="text-gray-500 text-sm">Detalle de deuda asignada a tu transporte</p>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-4 mt-2">
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
      </div>

      {/* Vencidos */}
      {vencidos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100">
          <div className="px-5 py-3 border-b border-red-100 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <h2 className="font-semibold text-red-700">Comprobantes Vencidos ({vencidos.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-red-700">
                <tr>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-left px-4 py-2">Razón Social</th>
                  <th className="text-left px-4 py-2">Comprobante</th>
                  <th className="text-left px-4 py-2">Vencimiento</th>
                  <th className="text-right px-4 py-2">Días mora</th>
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

      {/* No vencidos */}
      {noVencidos.length > 0 && (
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
  );
}
