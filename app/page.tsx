"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: string; content: string; imagePreview?: string };
type Conversation = { id: string; title: string; messages: Message[] };

const MAX_SIZE_MB = 4;

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ preview: string; mimeType: string; data: string } | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("myai-conversations");
    if (saved) {
      const parsed: Conversation[] = JSON.parse(saved);
      setConversations(parsed);
      if (parsed.length > 0) setActiveId(parsed[0].id);
    } else {
      buatObrolanBaru();
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("myai-conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId);

  const buatObrolanBaru = () => {
    const id = Date.now().toString();
    const baru: Conversation = { id, title: "Obrolan Baru", messages: [] };
    setConversations((prev) => [baru, ...prev]);
    setActiveId(id);
  };

  const handleFilePicked = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Cuma gambar yang didukung sekarang ya.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Ukuran gambar maksimal ${MAX_SIZE_MB}MB. File kamu terlalu besar.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:image/png;base64,xxxx"
      const [header, base64Data] = result.split(",");
      const mimeType = header.match(/data:(.*);base64/)?.[1] || file.type;
      setPendingImage({ preview: result, mimeType, data: base64Data });
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
  };

  const kirimPesan = async () => {
    if ((!input.trim() && !pendingImage) || !activeId) return;

    const teksInput = input;
    const gambarUntukDikirim = pendingImage;

    const pesanUser: Message = {
      role: "user",
      content: teksInput || "(gambar)",
      imagePreview: gambarUntukDikirim?.preview,
    };

    setInput("");
    setPendingImage(null);
    setLoading(true);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              title: c.messages.length === 0 ? (teksInput || "Gambar").slice(0, 30) : c.title,
              messages: [...c.messages, pesanUser],
            }
          : c
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          message: teksInput,
          image: gambarUntukDikirim
            ? { mimeType: gambarUntukDikirim.mimeType, data: gambarUntukDikirim.data }
            : undefined,
        }),
      });
      const data = await res.json();

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { role: "assistant", content: data.reply || data.error || "Maaf, terjadi kesalahan." },
                ],
              }
            : c
        )
      );
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { role: "assistant", content: "Maaf, terjadi kesalahan. Coba lagi ya." },
                ],
              }
            : c
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 260, background: "#111111", borderRight: "1px solid #262626", display: "flex", flexDirection: "column", padding: 12 }}>
        <button
          onClick={buatObrolanBaru}
          style={{
            background: "linear-gradient(135deg, #ff7a18, #ff9d4d)",
            color: "#0a0a0a",
            border: "none",
            borderRadius: 8,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          + Obrolan Baru
        </button>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 4,
                cursor: "pointer",
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                background: c.id === activeId ? "#1f1f1f" : "transparent",
                borderLeft: c.id === activeId ? "3px solid #ff7a18" : "3px solid transparent",
                color: c.id === activeId ? "#ff9d4d" : "#ccc",
              }}
            >
              {c.title || "Obrolan Baru"}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat utama */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid #262626", fontWeight: 700, fontSize: 18 }}>
          <span style={{ color: "#ff7a18" }}>My</span> AI
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {(activeConversation?.messages.length ?? 0) === 0 && (
            <div style={{ color: "#666", textAlign: "center", marginTop: 60 }}>
              Mulai percakapan dengan mengetik pesan di bawah.
            </div>
          )}

          {activeConversation?.messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div
                style={{
                  maxWidth: "70%",
                  padding: "10px 16px",
                  borderRadius: 14,
                  fontSize: 15,
                  lineHeight: 1.5,
                  background: m.role === "user" ? "linear-gradient(135deg, #ff7a18, #ff9d4d)" : "#1a1a1a",
                  color: m.role === "user" ? "#0a0a0a" : "#f0f0f0",
                  border: m.role === "user" ? "none" : "1px solid #2a2a2a",
                }}
              >
                {m.imagePreview && (
                  <img
                    src={m.imagePreview}
                    alt="lampiran"
                    style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6, display: "block" }}
                  />
                )}
                {m.content}
              </div>
            </div>
          ))}

          {loading && <div style={{ color: "#ff9d4d", fontSize: 14, fontStyle: "italic" }}>Sedang mengetik...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #262626", position: "relative" }}>
          {pendingImage && (
            <div style={{ maxWidth: 800, margin: "0 auto 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <img src={pendingImage.preview} alt="preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
              <span style={{ fontSize: 13, color: "#aaa" }}>Gambar siap dikirim</span>
              <button
                onClick={() => setPendingImage(null)}
                style={{ background: "none", border: "none", color: "#ff7a18", cursor: "pointer", fontSize: 13 }}
              >
                Hapus
              </button>
            </div>
          )}

          {showAttachMenu && (
            <div
              style={{
                position: "absolute",
                bottom: 70,
                left: 16,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 12,
                overflow: "hidden",
                zIndex: 10,
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                style={menuItemStyle}
              >
                🖼️ Pilih dari Galeri
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                style={menuItemStyle}
              >
                📷 Ambil Foto
              </button>
            </div>
          )}

          {/* Input tersembunyi buat galeri */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFilePicked(e.target.files[0])}
          />
          {/* Input tersembunyi buat kamera langsung (capture) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFilePicked(e.target.files[0])}
          />

          <div style={{ display: "flex", gap: 10, maxWidth: 800, margin: "0 auto" }}>
            <button
              onClick={() => setShowAttachMenu((v) => !v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "1px solid #333",
                background: "#161616",
                color: "#ff9d4d",
                fontSize: 22,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              +
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && kirimPesan()}
              placeholder="Ketik pesan..."
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 24,
                border: "1px solid #333",
                background: "#161616",
                color: "#f5f5f5",
                outline: "none",
                fontSize: 15,
              }}
            />
            <button
              onClick={kirimPesan}
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #ff7a18, #ff9d4d)",
                color: "#0a0a0a",
                border: "none",
                borderRadius: 24,
                padding: "0 24px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Kirim
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 20px",
  background: "transparent",
  border: "none",
  color: "#f0f0f0",
  fontSize: 14,
  textAlign: "left",
  cursor: "pointer",
};
