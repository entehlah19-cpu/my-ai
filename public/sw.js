// Service worker sederhana untuk My AI: halaman utama tetap bisa dibuka walau sinyal putus.
// Permintaan ke /api/ tidak pernah disimpan, jadi jawaban AI selalu baru.
const VERSI = "myai-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSI)
      .then((c) => c.add("/"))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nama) => Promise.all(nama.filter((n) => n !== VERSI).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Halaman utama: coba jaringan dulu, kalau offline pakai salinan terakhir
  if (req.mode === "navigate" && url.pathname === "/") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const salin = res.clone();
            caches.open(VERSI).then((c) => c.put("/", salin));
          }
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Berkas statis (nama berkasnya berubah tiap versi): simpan dan pakai ulang
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/")) {
    e.respondWith(
      caches.match(req).then(
        (ada) =>
          ada ||
          fetch(req).then((res) => {
            if (res.ok) {
              const salin = res.clone();
              caches.open(VERSI).then((c) => c.put(req, salin));
            }
            return res;
          })
      )
    );
  }
});
