// public/sw.js — كاش للأصول الثابتة + صفحة offline + استقبال Push (بيانات FCM) + فتح الروابط العميقة
const V = "khiyal-logo-2";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(["/offline", "/icons/khiyal-mark-192-v5.png"]))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate") { // محاولة ثانية بعد 700ms قبل اعتبار الاتصال مقطوعاً
    e.respondWith(fetch(r).catch(() => new Promise((ok) => setTimeout(ok, 700)).then(() => fetch(r))).catch(() => caches.match("/offline"))); return; }
  if (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/icons/"))
    e.respondWith(caches.match(r).then((h) => h || fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); return res; })));
});
self.addEventListener("push", (e) => {
  let d = {}; try { const j = e.data.json(); d = j.data || j.notification || j; } catch (_) {}
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    if (cs.some((c) => c.visibilityState === "visible")) return; // التطبيق مفتوح: Realtime يكفي
    return self.registration.showNotification(d.title || "خيال", { body: d.body || "", icon: "/icons/khiyal-mark-192-v5.png", badge: "/icons/khiyal-mark-192-v5.png", dir: "rtl", lang: "ar", data: { link: d.link || "/" } });
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close(); const link = (e.notification.data && e.notification.data.link) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => { const c = cs[0]; if (c) { c.focus(); return c.navigate(link); } return self.clients.openWindow(link); }));
});
