"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: string; content: string };
type Conversation = { id: string; title: string; messages: Message[] };

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load riwayat dari localStorage saat pertama buka
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

  // Simpan ke localStorage setiap kali ada perubahan
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("myai-conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  // Auto-scroll ke bawah saat ada pesan baru
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

  const kirimPesan = async () => {
    if (!input.trim() || !activeId) return;

    const pesanUser: Message = { role: "user", content: input };
    const teksInput = input;
    setInput("");
    setLoading(true);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              title: c.messages.length === 0 ? teksInput.slice(0, 30) : c.title,
              messages: [...c.messages, pesanUser],
            }
          : c
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1", message: teksInput }),
      });
      const data = await res.json();

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: data.reply }] }
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
      <aside
        style={{
          width: 260,
          background: "#111111",
          borderRight: "1px solid #262626",
          display: "flex",
          flexDirection: "column",
          padding: 12,
        }}
      >
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
        <header
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #262626",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: 0.5,
          }}
        >
          <span style={{ color: "#ff7a18" }}>My</span> AI
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {(activeConversation?.messages.length ?? 0) === 0 && (
            <div style={{ color: "#666", textAlign: "center", marginTop: 60 }}>
              Mulai percakapan dengan mengetik pesan di bawah.
            </div>
          )}

          {activeConversation?.messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  padding: "10px 16px",
                  borderRadius: 14,
                  fontSize: 15,
                  lineHeight: 1.5,
                  background:
                    m.role === "user"
                      ? "linear-gradient(135deg, #ff7a18, #ff9d4d)"
                      : "#1a1a1a",
                  color: m.role === "user" ? "#0a0a0a" : "#f0f0f0",
                  border: m.role === "user" ? "none" : "1px solid #2a2a2a",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ color: "#ff9d4d", fontSize: 14, fontStyle: "italic" }}>
              Sedang mengetik...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #262626" }}>
          <div style={{ display: "flex", gap: 10, maxWidth: 800, margin: "0 auto" }}>
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
