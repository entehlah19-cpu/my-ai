"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

type Message = { role: string; content: string; imagePreview?: string };
type Conversation = { id: string; title: string; messages: Message[] };

const MAX_SIZE_MB = 4;

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ preview: string; mimeType: string; data: string } | null>(null);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    localStorage.setItem("myai-conversations", JSON.stringify(conversations));
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
    setSidebarOpen(false);
  };

  const pilihObrolan = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const hapusObrolan = (id: string) => {
    setConversations((prev) => {
      const sisa = prev.filter((c) => c.id !== id);
      // Kalau yang dihapus itu yang lagi aktif, pindah ke obrolan lain (atau buat baru kalau kosong)
      if (id === activeId) {
        if (sisa.length > 0) {
          setActiveId(sisa[0].id);
        } else {
          const baruId = Date.now().toString();
          setActiveId(baruId);
          setConfirmDeleteId(null);
          return [{ id: baruId, title: "Obrolan Baru", messages: [] }];
        }
      }
      return sisa;
    });
    setConfirmDeleteId(null);
  };

  const handleFilePicked = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Cuma gambar yang didukung sekarang ya. Dukungan file lain (PDF, dokumen) segera menyusul.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Ukuran gambar maksimal ${MAX_SIZE_MB}MB. File kamu terlalu besar.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64Data] = result.split(",");
      const mimeType = header.match(/data:(.*);base64/)?.[1] || file.type;
      setPendingImage({ preview: result, mimeType, data: base64Data });
    };
    reader.readAsDataURL(file);
    setShowAttachSheet(false);
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
          webSearch: webSearchOn,
          history: (activeConversation?.messages || []).slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
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
    <div style={{ display: "flex", height: "100dvh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      <style>{`
        .sidebar {
          width: 260px; background: #111111; border-right: 1px solid #262626;
          display: flex; flex-direction: column; padding: 12px; flex-shrink: 0;
          transition: transform 0.25s ease;
        }
        .overlay { display: none; }
        .conv-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; border-radius: 8px; margin-bottom: 4px; cursor: pointer; font-size: 14px;
        }
        .conv-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .conv-delete-btn {
          background: none; border: none; color: #666; cursor: pointer; font-size: 15px;
          padding: 4px 6px; flex-shrink: 0; border-radius: 6px;
        }
        .conv-delete-btn:hover { color: #ff5555; background: #2a1515; }
        .confirm-box {
          background: #1f1f1f; border: 1px solid #ff5555; border-radius: 8px;
          padding: 8px; margin-bottom: 4px; font-size: 13px;
        }
        .confirm-actions { display: flex; gap: 8px; margin-top: 6px; }
        .confirm-actions button {
          flex: 1; padding: 5px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
        }
        .sheet-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          z-index: 200; display: flex; align-items: flex-end; justify-content: center;
          opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
        }
        .sheet-backdrop.open { opacity: 1; pointer-events: auto; }
        .sheet {
          background: #161616; width: 100%; max-width: 480px;
          border-radius: 20px 20px 0 0; padding: 20px;
          transform: translateY(100%); transition: transform 0.25s ease;
          border: 1px solid #2a2a2a; border-bottom: none;
        }
        .sheet-backdrop.open .sheet { transform: translateY(0); }
        .sheet-grid { display: flex; gap: 12px; margin-bottom: 8px; }
        .sheet-grid-item {
          flex: 1; background: #1f1f1f; border-radius: 16px; padding: 16px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer; border: none; color: #f5f5f5;
        }
        .sheet-grid-item .icon-circle {
          width: 44px; height: 44px; border-radius: 50%; background: #2a2a2a;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .sheet-handle {
          width: 40px; height: 4px; background: #333; border-radius: 2px;
          margin: 0 auto 14px auto;
        }
        .sheet-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 6px; border-top: 1px solid #262626; border-radius: 10px;
          transition: background 0.15s ease; cursor: pointer;
        }
        .sheet-row:hover { background: #1c1c1c; }
        .sheet-grid-item { transition: background 0.15s ease, transform 0.1s ease; }
        .sheet-grid-item:active { transform: scale(0.96); }
        .sheet-row-left { display: flex; align-items: center; gap: 12px; }
        .sheet-row .icon-circle-sm {
          width: 36px; height: 36px; border-radius: 50%; background: #2a2a2a;
          display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
        }
        .toggle {
          width: 44px; height: 26px; border-radius: 13px; position: relative;
          border: none; cursor: pointer; transition: background 0.2s;
        }
        .toggle .knob {
          position: absolute; top: 3px; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; transition: left 0.2s;
        }
        .msg-content p { margin: 0 0 8px 0; }
        .msg-content p:last-child { margin-bottom: 0; }
        .msg-content strong { color: inherit; font-weight: 700; }
        .msg-content ul, .msg-content ol { margin: 4px 0; padding-left: 20px; }
        .msg-content li { margin-bottom: 4px; }
        .msg-content code {
          background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; font-size: 0.9em;
        }
        .msg-content pre {
          background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; overflow-x: auto; margin: 8px 0;
        }
        .msg-content pre code { background: none; padding: 0; }
        .msg-content h1, .msg-content h2, .msg-content h3 { margin: 8px 0 4px 0; }
        @media (max-width: 768px) {
          .sidebar { position: fixed; top: 0; left: 0; height: 100dvh; z-index: 100; transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .overlay.show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
          .hamburger { display: inline-flex !important; }
        }
        .hamburger { display: none; }
      `}</style>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button
          onClick={buatObrolanBaru}
          style={{
            background: "linear-gradient(135deg, #ff7a18, #ff9d4d)", color: "#0a0a0a", border: "none",
            borderRadius: 8, padding: "10px 14px", fontWeight: 600, cursor: "pointer", marginBottom: 16,
          }}
        >
          + Obrolan Baru
        </button>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {conversations.map((c) =>
            confirmDeleteId === c.id ? (
              <div key={c.id} className="confirm-box">
                <div>Hapus obrolan ini?</div>
                <div className="confirm-actions">
                  <button onClick={() => hapusObrolan(c.id)} style={{ background: "#ff5555", color: "#fff" }}>
                    Hapus
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ background: "#333", color: "#fff" }}>
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={c.id}
                className="conv-item"
                style={{
                  background: c.id === activeId ? "#1f1f1f" : "transparent",
                  borderLeft: c.id === activeId ? "3px solid #ff7a18" : "3px solid transparent",
                }}
              >
                <span
                  className="conv-title"
                  onClick={() => pilihObrolan(c.id)}
                  style={{ color: c.id === activeId ? "#ff9d4d" : "#ccc" }}
                >
                  {c.title || "Obrolan Baru"}
                </span>
                <button
                  className="conv-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(c.id);
                  }}
                  title="Hapus obrolan"
                >
                  🗑️
                </button>
              </div>
            )
          )}
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "16px 20px", borderBottom: "1px solid #262626", fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(true)}
            style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#f5f5f5", width: 36, height: 36, fontSize: 18, cursor: "pointer" }}
          >
            ☰
          </button>
          <span><span style={{ color: "#ff7a18" }}>My</span> AI</span>
          {webSearchOn && (
            <span style={{ fontSize: 11, background: "#1f1f1f", color: "#ff9d4d", padding: "3px 8px", borderRadius: 12, marginLeft: "auto" }}>
              🌐 Pencarian web aktif
            </span>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {(activeConversation?.messages.length ?? 0) === 0 && (
            <div style={{ color: "#666", textAlign: "center", marginTop: 60 }}>
              Mulai percakapan dengan mengetik pesan di bawah.
            </div>
          )}
          {activeConversation?.messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div
                className="msg-content"
                style={{
                  maxWidth: "85%", padding: "10px 16px", borderRadius: 14, fontSize: 15, lineHeight: 1.5,
                  background: m.role === "user" ? "linear-gradient(135deg, #ff7a18, #ff9d4d)" : "#1a1a1a",
                  color: m.role === "user" ? "#0a0a0a" : "#f0f0f0",
                  border: m.role === "user" ? "none" : "1px solid #2a2a2a", wordBreak: "break-word",
                }}
              >
                {m.imagePreview && (
                  <img src={m.imagePreview} alt="lampiran" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6, display: "block" }} />
                )}
                {m.role === "assistant" ? (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: "#ff9d4d", fontSize: 14, fontStyle: "italic" }}>Sedang mengetik...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #262626", position: "relative", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          {pendingImage && (
            <div style={{ maxWidth: 800, margin: "0 auto 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <img src={pendingImage.preview} alt="preview" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
              <span style={{ fontSize: 13, color: "#aaa" }}>Gambar siap dikirim</span>
              <button onClick={() => setPendingImage(null)} style={{ background: "none", border: "none", color: "#ff7a18", cursor: "pointer", fontSize: 13 }}>
                Hapus
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFilePicked(e.target.files[0])} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && handleFilePicked(e.target.files[0])} />

          <div style={{ display: "flex", gap: 8, maxWidth: 800, margin: "0 auto" }}>
            <button
              onClick={() => setShowAttachSheet(true)}
              style={{
                width: 42, height: 42, borderRadius: "50%", border: "1px solid #333", background: "#161616",
                color: "#ff9d4d", fontSize: 20, cursor: "pointer", flexShrink: 0,
              }}
            >
              +
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && kirimPesan()}
              placeholder="Ketik pesan..."
              style={{ flex: 1, minWidth: 0, padding: "10px 14px", borderRadius: 24, border: "1px solid #333", background: "#161616", color: "#f5f5f5", outline: "none", fontSize: 15 }}
            />
            <button
              onClick={kirimPesan}
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #ff7a18, #ff9d4d)", color: "#0a0a0a", border: "none",
                borderRadius: 24, padding: "0 18px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1, flexShrink: 0,
              }}
            >
              Kirim
            </button>
          </div>
        </div>
      </main>

      <div className={`sheet-backdrop ${showAttachSheet ? "open" : ""}`} onClick={() => setShowAttachSheet(false)}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17, marginBottom: 18 }}>
            Tambahkan ke chat
          </div>

          <div className="sheet-grid">
            <button className="sheet-grid-item" onClick={() => cameraInputRef.current?.click()}>
              <div className="icon-circle">
                <IconCamera />
              </div>
              Kamera
            </button>
            <button className="sheet-grid-item" onClick={() => fileInputRef.current?.click()}>
              <div className="icon-circle">
                <IconImage />
              </div>
              Foto
            </button>
            <button
              className="sheet-grid-item"
              onClick={() => alert("Dukungan upload dokumen (PDF, Word) segera hadir!")}
            >
              <div className="icon-circle">
                <IconFile />
              </div>
              File
            </button>
          </div>

          <div className="sheet-row" onClick={() => alert("Fitur proyek segera hadir!")}>
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconFolder /></div>
              <div>
                <div style={{ fontWeight: 500 }}>Tambahkan ke proyek</div>
                <div style={{ fontSize: 12, color: "#888" }}>Segera hadir</div>
              </div>
            </div>
            <IconChevron />
          </div>

          <div className="sheet-row">
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconGlobe /></div>
              <div style={{ fontWeight: 500 }}>Pencarian web</div>
            </div>
            <button
              className="toggle"
              onClick={() => setWebSearchOn((v) => !v)}
              style={{ background: webSearchOn ? "#ff7a18" : "#333" }}
            >
              <span className="knob" style={{ left: webSearchOn ? 21 : 3 }} />
            </button>
          </div>

          <div className="sheet-row" onClick={() => alert("Fitur konektor segera hadir!")}>
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconLink /></div>
              <div style={{ fontWeight: 500 }}>Konektor</div>
            </div>
            <IconChevron />
          </div>

          <div className="sheet-row">
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconBrain /></div>
              <div>
                <div style={{ fontWeight: 500 }}>Memori</div>
                <div style={{ fontSize: 12, color: "#888" }}>Aktif untuk obrolan ini</div>
              </div>
            </div>
            <button className="toggle" style={{ background: "#ff7a18" }}>
              <span className="knob" style={{ left: 21 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Ikon SVG (biar lebih rapi daripada emoji) ---- */
const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "#ff9d4d", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconCamera() {
  return (
    <svg {...iconProps}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-4 4-3-3-5 5" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z" />
    </svg>
  );
}
function IconLink() {
  return (
    <svg {...iconProps}>
      <path d="M9 15l6-6" />
      <path d="M13 6l1-1a3.5 3.5 0 015 5l-1 1" />
      <path d="M11 18l-1 1a3.5 3.5 0 01-5-5l1-1" />
    </svg>
  );
}
function IconBrain() {
  return (
    <svg {...iconProps}>
      <path d="M9 3a3 3 0 00-3 3v1a3 3 0 00-2 2.8V13a3 3 0 002 2.8V17a3 3 0 003 3h1" />
      <path d="M15 3a3 3 0 013 3v1a3 3 0 012 2.8V13a3 3 0 01-2 2.8V17a3 3 0 01-3 3h-1" />
      <path d="M12 3v17" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
