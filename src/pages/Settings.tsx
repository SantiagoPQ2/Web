import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, EyeOff, Save, LogOut, Moon, Sun, CheckCircle2, AlertCircle, Loader2, Camera, X, ZoomIn } from "lucide-react";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";

type Toast = { msg: string; ok: boolean } | null;

// ── ImageCropper ──────────────────────────────────────────────────────────────
// Cropper circular puro con Canvas, sin dependencias externas.
// El usuario arrastra para mover la imagen y usa el slider para hacer zoom.

interface CropperProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<CropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Tamaño del canvas de preview (cuadrado)
  const CANVAS_SIZE = 320;
  const CIRCLE_R = CANVAS_SIZE / 2 - 4;

  // Cargar imagen
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      // Centrar imagen inicialmente con zoom que la llena el círculo
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const initialZoom = (CIRCLE_R * 2) / minDim;
      setZoom(initialZoom);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redibujar canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    // Fondo
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Imagen transformada
    const scaledW = img.naturalWidth * zoom;
    const scaledH = img.naturalHeight * zoom;
    const drawX = cx - scaledW / 2 + offset.x;
    const drawY = cy - scaledH / 2 + offset.y;

    ctx.save();
    ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
    ctx.restore();

    // Overlay oscuro fuera del círculo
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2, true); // cut-out
    ctx.fill("evenodd");
    ctx.restore();

    // Borde del círculo
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [zoom, offset, imgLoaded]);

  useEffect(() => { draw(); }, [draw]);

  // ── Drag mouse ──
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const onMouseUp = () => setDragging(false);

  // ── Drag touch ──
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };
  const onTouchEnd = () => setDragging(false);

  // ── Confirmar → exportar círculo recortado ──
  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img) return;
    setProcessing(true);

    try {
      const OUTPUT_SIZE = 512; // resolución final del avatar
      const offscreen = document.createElement("canvas");
      offscreen.width = OUTPUT_SIZE;
      offscreen.height = OUTPUT_SIZE;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;

      const scale = OUTPUT_SIZE / CANVAS_SIZE;
      const cx = CANVAS_SIZE / 2;
      const cy = CANVAS_SIZE / 2;

      // Clip circular
      ctx.save();
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();

      const scaledW = img.naturalWidth * zoom;
      const scaledH = img.naturalHeight * zoom;
      const drawX = cx - scaledW / 2 + offset.x;
      const drawY = cy - scaledH / 2 + offset.y;

      ctx.drawImage(
        img,
        drawX * scale,
        drawY * scale,
        scaledW * scale,
        scaledH * scale
      );
      ctx.restore();

      offscreen.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
          setProcessing(false);
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("Error exportando crop:", err);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-base">Ajustar foto</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex items-center justify-center bg-gray-900 py-4 select-none"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="rounded-lg"
            style={{ touchAction: "none" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 shrink-0">−</span>
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#8B0000]"
            />
            <span className="text-xs text-gray-400 shrink-0">+</span>
          </div>
          <p className="text-[11px] text-center text-gray-400 mt-1">
            Arrastrá para mover · Deslizá para hacer zoom
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 px-5 py-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imgLoaded || processing}
            className="flex-1 py-2.5 rounded-xl bg-[#8B0000] hover:bg-[#6b0000] text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {processing && <Loader2 size={15} className="animate-spin" />}
            {processing ? "Procesando..." : "Usar esta foto"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Settings ──────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, logout, updateAvatar } = useAuth();

  const [profile, setProfile] = useState({ name: "", age: "", phone: "", mail: "" });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Cropper
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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

  // ── Seleccionar archivo → abrir cropper ────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Sin límite de tamaño — se acepta cualquier imagen
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setCropSrc(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    // Reset input para permitir subir la misma foto de nuevo
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Confirmar crop → subir a Supabase ─────────────────────────────────────
  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setUploadingAvatar(true);

    try {
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const urlFinal = `${pub.publicUrl}?t=${Date.now()}`;

      await supabase
        .from("usuarios_app")
        .update({ avatar_url: urlFinal })
        .eq("id", user.id);

      setAvatarUrl(urlFinal);
      updateAvatar(urlFinal);
      showToast("Foto actualizada correctamente");
    } catch (err: any) {
      console.error("Error subiendo avatar:", err);
      showToast("No se pudo subir la foto", false);
    } finally {
      setUploadingAvatar(false);
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
          {/* Avatar grande — click para ampliar si tiene foto */}
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
              {uploadingAvatar
                ? <Loader2 size={14} className="animate-spin" />
                : <Camera size={14} />
              }
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">
              {user?.name || user?.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
              @{user?.username} · {user?.role}
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-sm font-medium text-[#8B0000] hover:text-[#6b0000] disabled:opacity-50 text-left transition"
              >
                {uploadingAvatar ? "Subiendo..." : avatarUrl ? "Cambiar foto" : "Subir foto"}
              </button>
              {avatarUrl && !uploadingAvatar && (
                <button
                  onClick={handleRemoveAvatar}
                  className="text-sm font-medium text-gray-400 hover:text-red-500 text-left transition"
                >
                  Eliminar foto
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* ── Cropper modal ───────────────────────────────────────────────────── */}
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightboxOpen && avatarUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
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
