// src/pages/ResetPassword.tsx
// Página a la que llega el usuario desde el link del mail
// URL: /reset-password?token=xxxx

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { supabase } from "../config/supabase";

type Estado = "validando" | "valido" | "usado" | "expirado" | "guardado" | "error";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [estado, setEstado] = useState<Estado>("validando");
  const [userId, setUserId] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Validar token al montar ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setEstado("error");
      return;
    }

    const validar = async () => {
      const { data, error: err } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, used, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (err || !data) {
        setEstado("error");
        return;
      }

      if (data.used) {
        setEstado("usado");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setEstado("expirado");
        return;
      }

      setUserId(data.user_id);
      setEstado("valido");
    };

    validar();
  }, [token]);

  // ── Guardar nueva contraseña ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    try {
      // 1. Actualizar contraseña
      const { error: updateErr } = await supabase
        .from("usuarios_app")
        .update({ password: newPassword })
        .eq("id", userId);

      if (updateErr) throw updateErr;

      // 2. Marcar token como usado
      await supabase
        .from("password_reset_tokens")
        .update({ used: true })
        .eq("token", token);

      setEstado("guardado");
    } catch (err: any) {
      setError("Error al guardar la contraseña. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border-t-4 border-[#8B0000] overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <img src="/image.png" alt="VaFood Logo" className="mx-auto h-14 w-14 rounded-full shadow-lg mb-4" />
          <h1 className="text-xl font-bold text-[#8B0000]">VaFood</h1>
        </div>

        <div className="px-8 pb-8">

          {/* Validando */}
          {estado === "validando" && (
            <div className="flex flex-col items-center gap-3 py-6 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
              <p className="text-sm">Validando link...</p>
            </div>
          )}

          {/* Token inválido / error genérico */}
          {(estado === "error") && (
            <div className="text-center space-y-4 py-2">
              <div className="flex justify-center">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Link inválido</p>
                <p className="text-sm text-gray-500">Este link de recuperación no es válido. Solicitá uno nuevo.</p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-[#8B0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] transition"
              >
                Volver al login
              </button>
            </div>
          )}

          {/* Token ya usado */}
          {estado === "usado" && (
            <div className="text-center space-y-4 py-2">
              <div className="flex justify-center">
                <XCircle className="w-12 h-12 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Link ya utilizado</p>
                <p className="text-sm text-gray-500">Este link ya fue usado para cambiar la contraseña. Si necesitás cambiarlo de nuevo, solicitá uno nuevo.</p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-[#8B0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] transition"
              >
                Volver al login
              </button>
            </div>
          )}

          {/* Token expirado */}
          {estado === "expirado" && (
            <div className="text-center space-y-4 py-2">
              <div className="flex justify-center">
                <XCircle className="w-12 h-12 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Link expirado</p>
                <p className="text-sm text-gray-500">Este link de recuperación expiró (tenía 1 hora de validez). Solicitá uno nuevo desde el login.</p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-[#8B0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] transition"
              >
                Volver al login
              </button>
            </div>
          )}

          {/* Formulario — token válido */}
          {estado === "valido" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nueva contraseña</p>
                <p className="text-xs text-gray-400 mt-0.5">Mínimo 6 caracteres</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Nueva contraseña */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 focus:border-[#8B0000] transition"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 transition ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-red-300 focus:ring-red-300/30 focus:border-red-400"
                        : confirmPassword && confirmPassword === newPassword
                        ? "border-emerald-300 focus:ring-emerald-300/30 focus:border-emerald-400"
                        : "border-gray-200 dark:border-gray-600 focus:ring-[#8B0000]/30 focus:border-[#8B0000]"
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] text-white py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 mt-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : "Guardar nueva contraseña"}
              </button>
            </form>
          )}

          {/* Éxito */}
          {estado === "guardado" && (
            <div className="text-center space-y-5 py-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">¡Contraseña actualizada!</p>
                <p className="text-sm text-gray-500">Ya podés ingresar con tu nueva contraseña.</p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-[#8B0000] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#6b0000] transition"
              >
                Ir al login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
