import { supabase } from "../config/supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function registerPushForUser(username: string): Promise<void> {
  // por ahora dejamos la prueba solo para admin1
  if (username !== "admin1") return;

  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker no soportado en este navegador");
    return;
  }

  if (!("PushManager" in window)) {
    console.warn("Push API no soportada en este navegador");
    return;
  }

  if (!("Notification" in window)) {
    console.warn("Notifications API no soportada en este navegador");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.warn("Permiso de notificaciones denegado");
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Falta VITE_VAPID_PUBLIC_KEY");
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const payload = {
    username,
    endpoint: subscription.endpoint,
    subscription_json: subscription.toJSON(),
    user_agent: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
    is_active: true,
  };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });

  if (error) {
    console.error("Error guardando push subscription:", error);
    throw error;
  }

  console.log("Push registrado correctamente para", username);
}

/**
 * Prueba manual para disparar una Edge Function de Supabase.
 * La dejamos lista para usar cuando crees la function "send-push".
 */
export async function triggerTestPush(username: string) {
  const { data, error } = await supabase.functions.invoke("send-push", {
    body: {
      username,
      title: "Prueba VaFood",
      body: "Push de prueba desde Edge Function",
      url: "/chat",
      tag: "test-push",
    },
  });

  if (error) {
    console.error("Error invocando Edge Function send-push:", error);
    throw error;
  }

  return data;
}
