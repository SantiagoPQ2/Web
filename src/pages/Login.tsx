import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "recover" | "success";

export default function Login() {
  const { login } = useAuth();

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Recover
  const [mail, setMail] = useState("");
  const [recoverError, setRecoverError] = useState("");
  const [loadingRecover, setLoadingRecover] = useState(false);

  const [mode, setMode] = useState<Mode>("login");

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError("Completá usuario y contraseña");
      return;
    }
    setLoadingLogin(true);
    setLoginError("");
    const ok = await login(username.trim(), password);
    if (!ok) {
      setLoginError("Usuario o contraseña incorrectos");
      setLoadingLogin(false);
    }
    // Si ok=true, App.tsx se re-renderiza y muestra el contenido protegido
  };

  // ── Recuperar ──────────────────────────────────────────────────────────────
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mail.trim()) {
      setRecoverError("Ingresá tu correo electrónico");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(mail.trim())) {
      setRecoverError("El formato del correo no es válido");
      return;
    }

    setLoadingRecover(true);
    setRecoverError("");

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/send-reset-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ mail: mail.trim().toLowerCase() }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error enviando el correo");
      }

      // Siempre mostrar success para no revelar si el mail existe
      setMode("success");
    } catch (err: any) {
      setRecoverError(err.message ?? "Error al enviar el correo. Intentá de nuevo.");
    } finally {
      setLoadingRecover(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border-t-4 border-[#8B0000] overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <img
            src="/image.png"
            alt="VaFood Logo"
            className="mx-auto h-16 w-16 rounded-full shadow-lg mb-4"
          />
          <h1 className="text-2xl font-bold text-[#8B0000]">
            {mode === "login" && "Iniciar Sesión"}
            {mode === "recover" && "Recuperar Contraseña"}
            {mode === "success" && "¡Correo enviado!"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mode === "login" && "Sistema de distribución VaFood"}
            {mode === "recover" && "Te mandamos un link para restablecer tu contraseña"}
            {mode === "success" && "Revisá tu bandeja de entrada"}
          </p>
        </div>

        <div className="px-8 pb-8">

          {/* ── MODO LOGIN ─────────────────────────────────────────────────── */}
          {mode === "login" && (
            <form onSubmit={handleSubmit} className="space-y-4">

              {loginError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {loginError}
                </div>
              )}

              {/* Usuario */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setLoginError(""); }}
                  placeholder="tu.usuario"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 focus:border-[#8B0000] transition"
                />
              </div>

              {/* Contraseña */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 focus:border-[#8B0000] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={loadingLogin}
                className="w-full flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] text-white py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60 mt-2"
              >
                {loadingLogin ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando...</>
                ) : (
                  "Entrar"
                )}
              </button>

              {/* Link recuperar */}
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                ¿Olvidaste tu contraseña?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("recover"); setLoginError(""); }}
                  className="text-[#8B0000] font-semibold hover:underline"
                >
                  Recuperar
                </button>
              </p>
            </form>
          )}

          {/* ── MODO RECOVER ───────────────────────────────────────────────── */}
          {mode === "recover" && (
            <form onSubmit={handleRecover} className="space-y-4">

              {recoverError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {recoverError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={mail}
                  onChange={(e) => { setMail(e.target.value); setRecoverError(""); }}
                  placeholder="tu@correo.com"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 focus:border-[#8B0000] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loadingRecover}
                className="w-full flex items-center justify-center gap-2 bg-[#8B0000] hover:bg-[#6b0000] text-white py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-60"
              >
                {loadingRecover ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  "Enviar link de recuperación"
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode("login"); setRecoverError(""); setMail(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </form>
          )}

          {/* ── MODO SUCCESS ────────────────────────────────────────────────── */}
          {mode === "success" && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Si existe una cuenta asociada a{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{mail}</span>,
                  vas a recibir un correo con el link para restablecer tu contraseña.
                </p>
                <p className="text-xs text-gray-400">
                  El link expira en 1 hora. Revisá también la carpeta de spam.
                </p>
              </div>

              <button
                onClick={() => { setMode("login"); setMail(""); }}
                className="w-full bg-[#8B0000] hover:bg-[#6b0000] text-white py-2.5 rounded-xl font-semibold text-sm transition"
              >
                Volver al inicio de sesión
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
