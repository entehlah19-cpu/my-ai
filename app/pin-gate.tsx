"use client";

import { useEffect, useState, type ReactNode } from "react";

const KUNCI_PIN = "myai-pin";

function pinTersimpan(): string {
  try {
    return localStorage.getItem(KUNCI_PIN) || "";
  } catch {
    return "";
  }
}

// Semua permintaan ke /api/chat otomatis membawa PIN yang tersimpan (header x-pin).
// Dipasang sekali saat halaman dimuat, jadi app/page.tsx tidak perlu diubah.
if (typeof window !== "undefined") {
  const w = window as any;
  if (!w.__myaiFetchTerpasang) {
    w.__myaiFetchTerpasang = true;
    const asli = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const alamat = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (alamat.includes("/api/chat")) {
        const pin = pinTersimpan();
        if (pin) {
          const awal = typeof input === "string" || input instanceof URL ? undefined : input.headers;
          const headers = new Headers(init?.headers || awal);
          headers.set("x-pin", pin);
          return asli(input, { ...init, headers });
        }
      }
      return asli(input, init);
    };
  }
}

type Hasil = { status: number; perluPin: boolean };

async function periksa(): Promise<Hasil> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "cek" }),
    });
    let perluPin = false;
    if (res.status === 401 || res.status === 429) {
      try {
        const data = await res.json();
        perluPin = data?.perluPin === true;
      } catch {}
    }
    return { status: res.status, perluPin };
  } catch {
    return { status: 0, perluPin: false };
  }
}

export default function PinGate({ children }: { children: ReactNode }) {
  const [terkunci, setTerkunci] = useState(false);
  const [pin, setPin] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    periksa().then((h) => setTerkunci(h.perluPin));
  }, []);

  const masuk = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const baru = pin.trim();
    if (!baru || sibuk) return;
    setSibuk(true);
    setPesan("");
    try {
      localStorage.setItem(KUNCI_PIN, baru);
    } catch {}
    const h = await periksa();
    if (h.perluPin) {
      try {
        localStorage.removeItem(KUNCI_PIN);
      } catch {}
      setPesan(h.status === 429 ? "Terlalu banyak PIN salah. Coba lagi sekitar 10 menit." : "PIN salah. Coba lagi ya.");
      setPin("");
    } else {
      setTerkunci(false);
      setPin("");
    }
    setSibuk(false);
  };

  return (
    <>
      {children}
      {terkunci && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0a0a0a",
            color: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <form onSubmit={masuk} style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
              <span style={{ color: "#ff7a18" }}>My</span> AI
            </div>
            <div style={{ fontSize: 14, color: "#999999", marginBottom: 18 }}>Masukkan PIN untuk lanjut.</div>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN"
              autoComplete="off"
              autoFocus
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 14,
                border: "none",
                background: "#1a1a1a",
                color: "#f5f5f5",
                fontSize: 16,
                textAlign: "center",
                outline: "none",
              }}
            />
            {pesan && <div style={{ color: "#ff6b6b", fontSize: 13.5, marginTop: 10 }}>{pesan}</div>}
            <button
              type="submit"
              disabled={sibuk}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "13px 16px",
                borderRadius: 14,
                border: "none",
                fontWeight: 700,
                fontSize: 15,
                cursor: sibuk ? "default" : "pointer",
                opacity: sibuk ? 0.6 : 1,
                background: "linear-gradient(135deg, #ff7a18, #ff9d4d)",
                color: "#0a0a0a",
              }}
            >
              {sibuk ? "Memeriksa..." : "Masuk"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
