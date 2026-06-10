import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Save, LogOut, Moon, Sun, CheckCircle2, AlertCircle, Loader2, Camera, X, ZoomIn } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Toast = { msg: string; ok: boolean } | null;
const MAX_AVATAR_MB = 5;

export default function Settings() {
  const { user, logout, updateAvatar } = useAuth();

  const [profile, setProfile] = useState({ name: "", age: "", phone: "", mail: "" });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Cargar perfil ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("usuarios_app")
        .select("name, age, phone, mail, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          name: data.name ?? "",
          age: data.age?.toString() ?? "",
          phone: data.phone ?? "",
          mail: data.mail ?? "",
        });
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
      setLoadingProfile(false);
    };
    load();
    if (user?.avatar_url) setAvatarUrl(user.avatar_url);
  }, [user]);

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = saved === "dark" || (!saved && prefersDark);
    setDarkMode(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // ── Upload avatar ──────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      showToast(`La imagen no puede superar los ${MAX_AVATAR_MB} MB`, false);
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "3600", upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const urlFinal = `${pub.publicUrl}?t=${Date.now()}`;

      await supabase.from("usuarios_app").update({ avatar_url: urlFinal }).eq("id", user.id);

      setAvatarUrl(urlFinal);
      updateAvatar(urlFinal);
      showToast("Foto actualizada correctamente");
    } catch (err: any) {
      showToast("No se pudo subir la foto", false);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      await supabase.from("usuarios_app").update({ avatar_url: null }).eq("id", user.id);
      setAvatarUrl(null);
      updateAvatar(null);
      showToast("Foto eliminada");
    } catch {
      showToast("Error al eliminar la foto", false);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Guardar perfil ─────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("usuarios_app")
      .update({
        name: profile.name,
        age: profile.age ? parseInt(profile.age) : null,
        phone: profile.phone,
        mail: profile.mail,
      })
      .eq("id", user.id);
    if (error) showToast("Error al guardar perfil", false);
    else showToast("Perfil actualizado");
    setSavingProfile(false);
  };

  // ── Cambiar contraseña ─────────────────────────────────────────────────────
  const changePassword = async () => {
    if (!user) return;
    if (!newPassword) { showToast("Ingresá la nueva contraseña", false); return; }
    if (newPassword.length < 6) { showToast("Mínimo 6 caracteres", false); return; }
    if (newPassword !== confirmPassword) { showToast("Las contraseñas no coinciden", false); return; }

    setSavingPwd(true);
    const { error } = await supabase
      .from("usuarios_app")
      .update({ password: newPassword })
      .eq("id", user.id);
    if (error) showToast("Error al cambiar contraseña", false);
    else {
      showToast("Contraseña actualizada");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPwd(false);
  };

  const handleLogout = () => { logout(); window.location.href = "/"; };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 focus:border-[#8B0000] transition";
  const labelClass = "block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1";
  const initial = (user?.name?.[0] || user?.username?.[0] || "?").toUpperCase();

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B0000]" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 space-y-5">

      {/* ── Foto de perfil ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#8B0000]" />
          Foto de perfil
        </h2>

        <div className="flex items-center gap-5">
          {/* Avatar grande clickeable para ampliar */}
          <div className="relative shrink-0 group">
            <button
              onClick={() => avatarUrl && setLightboxOpen(true)}
              className="block h-24 w-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 shadow-sm focus:outline-none"
              disabled={!avatarUrl}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] text-3xl font-bold">
                  {initial}
                </div>
              )}
            </button>
            {avatarUrl && (
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition pointer-events-none flex items-center justify-center">
                <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition" />
              </div>
            )}
            {/* Botón cámara */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#8B0000] text-white flex items-center justify-center shadow-md hover:bg-[#6b0000] transition disabled:opacity-60"
            >
              {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{user?.name || user?.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">@{user?.username} · {user?.role}</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-sm font-medium text-[#8B0000] hover:text-[#6b0000] disabled:opacity-50 text-left transition"
              >
                {uploadingAvatar ? "Subiendo..." : avatarUrl ? "Cambiar foto" : "Subir foto"}
              </button>
              {avatarUrl && !uploadingAvatar && (
                <button onClick={handleRemoveAvatar} className="text-sm font-medium text-gray-400 hover:text-red-500 text-left transition">
                  Eliminar foto
                </button>
              )}
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightboxOpen && avatarUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white transition" onClick={() => setLightboxOpen(false)}>
            <X size={30} />
          </button>
          <img
            src={avatarUrl}
            alt="Foto de perfil"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Datos personales ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#8B0000] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : initial
            }
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100">{user?.name || user?.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
          </div>
        </div>

        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">Datos personales</h2>

        <div className="space-y-3">
          {[
            { label: "Nombre", field: "name", placeholder: "Tu nombre", type: "text" },
            { label: "Edad", field: "age", placeholder: "Tu edad", type: "number" },
            { label: "Teléfono", field: "phone", placeholder: "+54 9 11...", type: "tel" },
            { label: "Correo electrónico", field: "mail", placeholder: "tu@correo.com", type: "email" },
          ].map(({ label, field, placeholder, type }) => (
            <div key={field}>
              <label className={labelClass}>{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={(profile as any)[field]}
                onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="w-full flex items-center justify-center gap-2 mt-4 bg-[#8B0000] hover:bg-[#6b0000] text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60"
        >
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar perfil
        </button>
      </div>

      {/* ── Contraseña ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">Cambiar contraseña</h2>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputClass} pr-10`}
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Repetí la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 transition ${
                  confirmPassword && confirmPassword !== newPassword
                    ? "border-red-300 focus:ring-red-300/30"
                    : confirmPassword && confirmPassword === newPassword
                    ? "border-emerald-300 focus:ring-emerald-300/30"
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
        </div>

        <button
          onClick={changePassword}
          disabled={savingPwd}
          className="w-full flex items-center justify-center gap-2 mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60"
        >
          {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Cambiar contraseña
        </button>
      </div>

      {/* ── Preferencias ────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">Preferencias</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Modo oscuro</p>
              <p className="text-xs text-gray-400">{darkMode ? "Activado" : "Desactivado"}</p>
            </div>
          </div>
          <button onClick={toggleDarkMode} className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? "bg-indigo-500" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      {/* ── Cerrar sesión ────────────────────────────────────────────────────── */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:border-red-800 dark:text-red-400 transition"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
