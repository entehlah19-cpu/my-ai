"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

type Message = { role: string; content: string; imagePreviews?: string[]; imagePreview?: string };
type PendingImg = { preview: string; mimeType: string; data: string };
const MAX_IMAGES = 3;
type Conversation = { id: string; title: string; messages: Message[]; projectId?: string; pinned?: boolean };
type ProjectT = { id: string; name: string };

type PendingDoc =
  | { name: string; kind: "text"; text: string }
  | { name: string; kind: "binary"; mimeType: string; data: string };

const MAX_IMAGE_SIZE_MB = 4;
const MAX_DOC_SIZE_MB = 5;
const DOC_MIME_PDF = "application/pdf";
const DOC_MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<ProjectT[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const loading = loadingIds.includes(activeId);
  const [pendingImages, setPendingImages] = useState<PendingImg[]>([]);
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [showLinkSheet, setShowLinkSheet] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [modeKode, setModeKode] = useState(false);
  const [activeNav, setActiveNav] = useState<"obrolan" | "proyek">("obrolan");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const headerMenuWrapRef = useRef<HTMLDivElement>(null);

  // --- Load & save data di localStorage ---
  useEffect(() => {
    const savedConv = localStorage.getItem("myai-conversations");
    if (savedConv) {
      const parsed: Conversation[] = JSON.parse(savedConv);
      setConversations(parsed);
      if (parsed.length > 0) setActiveId(parsed[0].id);
    } else {
      buatObrolanBaru();
    }
    const savedProj = localStorage.getItem("myai-projects");
    if (savedProj) setProjects(JSON.parse(savedProj));
  }, []);

  useEffect(() => {
    localStorage.setItem("myai-conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem("myai-projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  // Tutup popup (emoji, menu titik-tiga, menu header) otomatis kalau klik di luar area-nya
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (showEmojiPicker && emojiWrapRef.current && !emojiWrapRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
      if (showHeaderMenu && headerMenuWrapRef.current && !headerMenuWrapRef.current.contains(target)) {
        setShowHeaderMenu(false);
      }
      if (openMenuId && !target.closest(".conv-menu-wrap")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker, showHeaderMenu, openMenuId]);

  const activeConversation = conversations.find((c) => c.id === activeId);

  // --- Obrolan ---
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

  const gantiNamaObrolan = (id: string) => {
    const current = conversations.find((c) => c.id === id);
    const nama = prompt("Nama baru untuk obrolan ini:", current?.title || "");
    if (nama && nama.trim()) {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: nama.trim() } : c)));
    }
    setOpenMenuId(null);
  };

  const toggleSematkan = (id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
    setOpenMenuId(null);
  };

  const eksporObrolan = () => {
    if (!activeConversation) return;
    const isi = activeConversation.messages
      .map((m) => `${m.role === "user" ? "Kamu" : "My AI"}: ${m.content}`)
      .join("\n\n");
    const blob = new Blob([isi], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeConversation.title || "obrolan"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tambahKeProyekDari = (id: string) => {
    setActiveId(id);
    setOpenMenuId(null);
    setShowProjectPicker(true);
  };

  const hapusObrolan = (id: string) => {
    setConversations((prev) => {
      const sisa = prev.filter((c) => c.id !== id);
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

  // --- Proyek ---
  const buatProyekBaru = () => {
    const nama = newProjectName.trim();
    if (!nama) return;
    const id = Date.now().toString();
    setProjects((prev) => [...prev, { id, name: nama }]);
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, projectId: id } : c)));
    setNewProjectName("");
    setShowProjectPicker(false);
  };

  const pindahKeProyek = (projectId: string | undefined) => {
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, projectId } : c)));
    setShowProjectPicker(false);
  };

  const hapusProyek = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setConversations((prev) => prev.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)));
  };

  const toggleCollapseProject = (id: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Upload gambar ---
  const handleFilesPicked = (fileList: FileList) => {
    const files = Array.from(fileList);
    const sisaSlot = MAX_IMAGES - pendingImages.length;

    if (sisaSlot <= 0) {
      alert(`Maksimal ${MAX_IMAGES} gambar per pesan.`);
      return;
    }
    if (files.length > sisaSlot) {
      alert(`Maksimal ${MAX_IMAGES} gambar per pesan. Hanya ${sisaSlot} gambar pertama yang diambil.`);
    }

    files.slice(0, sisaSlot).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert(`"${file.name}" bukan gambar. Gunakan tombol 'File' untuk dokumen.`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        alert(`"${file.name}" terlalu besar. Maksimal ${MAX_IMAGE_SIZE_MB}MB per gambar.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const [header, base64Data] = result.split(",");
        const mimeType = header.match(/data:(.*);base64/)?.[1] || file.type;
        setPendingImages((prev) =>
          prev.length >= MAX_IMAGES ? prev : [...prev, { preview: result, mimeType, data: base64Data }]
        );
      };
      reader.readAsDataURL(file);
    });
    setShowAttachSheet(false);
  };

  const hapusGambarPending = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Upload dokumen (.txt langsung dibaca, .pdf/.docx dikirim ke server) ---
  const handleDocPicked = (file: File) => {
    const namaLower = file.name.toLowerCase();
    const isTxt = namaLower.endsWith(".txt");
    const isPdf = file.type === DOC_MIME_PDF || namaLower.endsWith(".pdf");
    const isDocx = file.type === DOC_MIME_DOCX || namaLower.endsWith(".docx");

    if (!isTxt && !isPdf && !isDocx) {
      alert("Format yang didukung: .txt, .pdf, atau .docx (Word).");
      return;
    }
    if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
      alert(`Ukuran file maksimal ${MAX_DOC_SIZE_MB}MB.`);
      return;
    }

    if (isTxt) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingDoc({ name: file.name, kind: "text", text: reader.result as string });
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const [, base64Data] = result.split(",");
        setPendingDoc({ name: file.name, kind: "binary", mimeType: isPdf ? DOC_MIME_PDF : DOC_MIME_DOCX, data: base64Data });
      };
      reader.readAsDataURL(file);
    }
    setShowAttachSheet(false);
  };

  const EMOJI_LIST = [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉",
    "😊", "😇", "🥰", "😍", "😘", "😋", "😜", "🤗", "🤔", "😎",
    "🥳", "😭", "😢", "😤", "😡", "🥺", "😴", "🤯", "👍", "👎",
    "🙏", "👏", "🔥", "✨", "🎉", "❤️", "💡", "✅", "❌", "🤖",
  ];

  const tambahEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const mulaiRekamSuara = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Browser kamu belum mendukung input suara. Coba pakai Chrome ya.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const teks = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + teks : teks));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const simpanLink = () => {
    let url = linkInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      new URL(url);
    } catch {
      alert("Link tidak valid. Contoh: https://contoh.com/artikel");
      return;
    }
    setPendingLink(url);
    setLinkInput("");
    setShowLinkSheet(false);
  };

  // --- Kirim pesan ---
  const kirimPesan = async () => {
    if ((!input.trim() && pendingImages.length === 0 && !pendingDoc && !pendingLink) || !activeId) return;
    // Jangan kirim lagi kalau obrolan ini masih menunggu jawaban
    if (loadingIds.includes(activeId)) return;

    // Simpan ID obrolan SAAT pesan dikirim, supaya jawaban masuk ke obrolan yang benar
    // walaupun user pindah ke obrolan lain selagi menunggu
    const convId = activeId;
    const riwayatUntukAI = (conversations.find((c) => c.id === convId)?.messages || [])
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content || "(user mengirim gambar)" }));

    const teksInput = input;
    const gambarUntukDikirim = pendingImages;
    const dokUntukDikirim = pendingDoc;
    const linkUntukDikirim = pendingLink;

    const pesanUntukAI =
      dokUntukDikirim?.kind === "text"
        ? `${teksInput}\n\n[Isi file "${dokUntukDikirim.name}"]:\n${dokUntukDikirim.text.slice(0, 8000)}`
        : teksInput;

    const pesanUser: Message = {
      role: "user",
      content:
        [teksInput, linkUntukDikirim ? `🔗 ${linkUntukDikirim}` : ""].filter(Boolean).join("\n") ||
        (gambarUntukDikirim.length > 0 ? "" : `📄 ${dokUntukDikirim?.name}`),
      imagePreviews: gambarUntukDikirim.length > 0 ? gambarUntukDikirim.map((g) => g.preview) : undefined,
    };

    setInput("");
    setPendingImages([]);
    setPendingDoc(null);
    setPendingLink(null);
    setLoadingIds((prev) => [...prev, convId]);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 ? (teksInput || dokUntukDikirim?.name || linkUntukDikirim || "Gambar").slice(0, 30) : c.title,
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
          message: pesanUntukAI,
          images: gambarUntukDikirim.length > 0
            ? gambarUntukDikirim.map((g) => ({ mimeType: g.mimeType, data: g.data }))
            : undefined,
          document:
            dokUntukDikirim?.kind === "binary"
              ? { name: dokUntukDikirim.name, mimeType: dokUntukDikirim.mimeType, data: dokUntukDikirim.data }
              : undefined,
          link: linkUntukDikirim || undefined,
          mode: modeKode ? "kode" : "chat",
          webSearch: webSearchOn,
          history: riwayatUntukAI,
        }),
      });
      const data = await res.json();

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: data.reply || data.error || "Maaf, terjadi kesalahan." }] }
            : c
        )
      );
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: "Maaf, terjadi kesalahan. Coba lagi ya." }] }
            : c
        )
      );
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== convId));
    }
  };

  // --- Filter berdasarkan pencarian, lalu urutkan: yang disematkan dulu ---
  const cocokPencarian = (c: Conversation) => c.title.toLowerCase().includes(searchQuery.toLowerCase());
  const urutkanPinned = (list: Conversation[]) =>
    [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const conversationsTerfilter = conversations.filter(cocokPencarian);
  const obrolanTanpaProyek = urutkanPinned(conversationsTerfilter.filter((c) => !c.projectId));

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#0a0a0a", color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        input, button, textarea { outline: none; -webkit-tap-highlight-color: transparent; }
        input:focus, button:focus, textarea:focus { outline: none; box-shadow: none; }
        html, body { background: #0a0a0a; margin: 0; padding: 0; }

        .sidebar {
          width: 260px; background: #111111; border-right: 1px solid #262626;
          display: flex; flex-direction: column; padding: 12px; flex-shrink: 0;
          transition: transform 0.25s ease;
        }
        .overlay { display: none; }

        .sidebar-btn {
          background: linear-gradient(135deg, #ff7a18, #ff9d4d); color: #0a0a0a; border: none;
          border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; font-size: 14px;
        }
        .header-icon-btn {
          width: 34px; height: 34px; border-radius: 8px; border: none; background: transparent;
          color: #aaa; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .header-icon-btn:hover { background: #1a1a1a; color: #ff9d4d; }
        .nav-item {
          display: flex; align-items: center; gap: 12px; padding: 9px 8px;
          border-radius: 8px; cursor: pointer; font-size: 14.5px; color: #ddd;
        }
        .nav-item:hover { background: #1a1a1a; }
        .sidebar-btn-secondary {
          background: #1a1a1a; color: #ff9d4d; border: 1px solid #333;
          border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; font-size: 13px;
        }

        .project-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 8px; cursor: pointer; border-radius: 8px; margin-top: 6px;
        }
        .project-header:hover { background: #1a1a1a; }
        .project-header-left { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #eee; }
        .project-children { padding-left: 14px; border-left: 1px solid #262626; margin-left: 10px; }
        .project-delete-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 12px; padding: 2px 4px; }
        .project-delete-btn:hover { color: #ff5555; }

        .conv-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 10px; border-radius: 8px; margin-bottom: 2px; cursor: pointer; font-size: 13.5px;
        }
        .conv-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .conv-delete-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; padding: 3px 5px; flex-shrink: 0; border-radius: 6px; }
        .conv-delete-btn:hover { color: #ff5555; background: #2a1515; }

        .confirm-box { background: #1f1f1f; border: 1px solid #ff5555; border-radius: 8px; padding: 8px; margin-bottom: 4px; font-size: 13px; }
        .confirm-actions { display: flex; gap: 8px; margin-top: 6px; }
        .confirm-actions button { flex: 1; padding: 5px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }

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
          max-height: 80dvh; overflow-y: auto;
        }
        .sheet-backdrop.open .sheet { transform: translateY(0); }
        .sheet-handle { width: 40px; height: 4px; background: #333; border-radius: 2px; margin: 0 auto 14px auto; }
        .sheet-grid { display: flex; gap: 12px; margin-bottom: 8px; }
        .sheet-grid-item {
          flex: 1; background: #1f1f1f; border-radius: 16px; padding: 16px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer; border: none; color: #f5f5f5; transition: background 0.15s ease, transform 0.1s ease;
        }
        .sheet-grid-item:active { transform: scale(0.96); }
        .sheet-grid-item .icon-circle {
          width: 44px; height: 44px; border-radius: 50%; background: #2a2a2a;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .sheet-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 6px; border-top: 1px solid #262626; border-radius: 10px;
          transition: background 0.15s ease; cursor: pointer;
        }
        .sheet-row:hover { background: #1c1c1c; }
        .sheet-row-left { display: flex; align-items: center; gap: 12px; }
        .sheet-row .icon-circle-sm {
          width: 36px; height: 36px; border-radius: 50%; background: #2a2a2a;
          display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
        }
        .toggle { width: 44px; height: 26px; border-radius: 13px; position: relative; border: none; cursor: pointer; transition: background 0.2s; }
        .toggle .knob { position: absolute; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left 0.2s; }

        .conv-menu-wrap { position: relative; }
        .conv-menu-dropdown {
          position: absolute; right: 0; top: 28px; z-index: 50;
          background: #1f1f1f; border: 1px solid #333; border-radius: 10px;
          min-width: 170px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }
        .conv-menu-item {
          display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px;
          background: none; border: none; color: #eee; font-size: 13px; cursor: pointer; text-align: left;
        }
        .conv-menu-item:hover { background: #2a2a2a; }
        .conv-menu-item.danger { color: #ff6b6b; }

        .project-picker-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 10px; border-radius: 10px; cursor: pointer; margin-bottom: 4px; background: #1a1a1a;
        }
        .project-picker-item:hover { background: #222; }
        .project-picker-input {
          flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #333;
          background: #1a1a1a; color: #fff; font-size: 14px;
        }

        .msg-content p { margin: 0 0 8px 0; }
        .msg-content p:last-child { margin-bottom: 0; }
        .msg-content strong { color: inherit; font-weight: 700; }
        .msg-content ul, .msg-content ol { margin: 4px 0; padding-left: 20px; }
        .msg-content li { margin-bottom: 4px; }
        .msg-content code { background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; font-size: 0.9em; }
        .msg-content pre { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
        .msg-content pre code { background: none; padding: 0; }
        .msg-content h1, .msg-content h2, .msg-content h3 { margin: 8px 0 4px 0; }

        @media (max-width: 768px) {
          .sidebar { position: fixed; top: 0; left: 0; height: 100dvh; z-index: 100; transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); }
          .overlay.show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
          .hamburger { display: inline-flex !important; }
        }
        .hamburger { display: none; }

        .input-card {
          max-width: 800px; margin: 0 auto; background: #161616;
          border: 1px solid #333; border-radius: 20px; padding: 10px 12px 8px 12px;
        }
        .input-icon-btn {
          width: 34px; height: 34px; border-radius: "50%"; border: none;
          color: #ff9d4d; font-size: 16px; cursor: pointer; display: flex;
          align-items: center; justify-content: center; border-radius: 50%;
        }
        .input-icon-btn:hover { background: #222 !important; }

        .code-block { background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 12px; margin: 10px 0; overflow: hidden; }
        .code-head { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #161616; font-size: 12px; color: #888; }
        .code-head button { background: none; border: 1px solid #333; color: #ff9d4d; border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
        .msg-content .code-block pre { margin: 0; background: transparent; padding: 12px; overflow-x: auto; font-size: 13.5px; line-height: 1.5; }

        .emoji-picker {
          max-width: 800px; margin: 0 auto 8px auto; background: #161616;
          border: 1px solid #333; border-radius: 14px; padding: 10px;
          display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;
          max-height: 160px; overflow-y: auto;
        }
        .emoji-item {
          background: none; border: none; font-size: 20px; padding: 6px;
          cursor: pointer; border-radius: 8px;
        }
        .emoji-item:hover { background: #262626; }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,59,59,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(255,59,59,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,59,59,0); }
        }
      `}</style>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ padding: "4px 6px 16px 6px", fontSize: 22, fontWeight: 800 }}>
          <span style={{ color: "#ff7a18" }}>My</span> AI
        </div>

        <div
          className="nav-item"
          style={{ background: activeNav === "obrolan" ? "#1f1f1f" : "transparent" }}
          onClick={() => {
            setActiveNav("obrolan");
            setCollapsedProjects({});
            setSearchQuery("");
          }}
        >
          <span style={{ color: activeNav === "obrolan" ? "#ff9d4d" : "#aaa", display: "inline-flex" }}><IconChatBubble /></span>
          <span style={{ color: activeNav === "obrolan" ? "#ff9d4d" : "#ddd" }}>Obrolan</span>
        </div>
        <div
          className="nav-item"
          style={{ background: activeNav === "proyek" ? "#1f1f1f" : "transparent" }}
          onClick={() => {
            setActiveNav("proyek");
            setShowProjectPicker(true);
          }}
        >
          <span style={{ color: activeNav === "proyek" ? "#ff9d4d" : "#aaa", display: "inline-flex" }}><IconFolder /></span>
          <span style={{ color: activeNav === "proyek" ? "#ff9d4d" : "#ddd" }}>Proyek</span>
        </div>
        <div
          className="nav-item"
          style={{ background: modeKode ? "#1f1f1f" : "transparent" }}
          onClick={() => { setModeKode((v) => !v); setSidebarOpen(false); }}
        >
          <span style={{ color: modeKode ? "#ff9d4d" : "#aaa", display: "inline-flex" }}><IconCode /></span>
          <span style={{ color: modeKode ? "#ff9d4d" : "#ddd" }}>Kode</span>
          {modeKode && <span style={{ marginLeft: "auto", fontSize: 11, color: "#ff9d4d" }}>Aktif</span>}
        </div>

        <div style={{ position: "relative", margin: "6px 2px 4px 2px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#777" }}>
            <IconSearch />
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari obrolan..."
            style={{
              width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: "1px solid #262626",
              background: "#161616", color: "#f5f5f5", fontSize: 13, outline: "none",
            }}
          />
        </div>

        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, padding: "14px 6px 8px 6px" }}>
          Terbaru
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Daftar proyek */}
          {projects.map((proj) => {
            const obrolanProyek = urutkanPinned(conversationsTerfilter.filter((c) => c.projectId === proj.id));
            const tertutup = collapsedProjects[proj.id];
            return (
              <div key={proj.id}>
                <div className="project-header" onClick={() => toggleCollapseProject(proj.id)}>
                  <div className="project-header-left">
                    <span>{tertutup ? "▸" : "▾"}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconFolderMini /> {proj.name}</span>
                  </div>
                  <button
                    className="project-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Hapus proyek "${proj.name}"? Obrolan di dalamnya tidak akan terhapus.`)) hapusProyek(proj.id);
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
                {!tertutup && (
                  <div className="project-children">
                    {obrolanProyek.length === 0 && (
                      <div style={{ fontSize: 12, color: "#555", padding: "6px 10px" }}>Belum ada obrolan</div>
                    )}
                    {obrolanProyek.map((c) =>
                      confirmDeleteId === c.id ? (
                        <div key={c.id} className="confirm-box">
                          <div>Hapus obrolan ini?</div>
                          <div className="confirm-actions">
                            <button onClick={() => hapusObrolan(c.id)} style={{ background: "#ff5555", color: "#fff" }}>Hapus</button>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ background: "#333", color: "#fff" }}>Batal</button>
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
                          <span className="conv-title" onClick={() => pilihObrolan(c.id)} style={{ color: c.id === activeId ? "#ff9d4d" : "#ccc" }}>
                            {c.pinned && "📌 "}{c.title || "Obrolan Baru"}
                          </span>
                          <div className="conv-menu-wrap">
                            <button className="conv-delete-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}>
                              ⋯
                            </button>
                            {openMenuId === c.id && (
                              <div className="conv-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                                <button className="conv-menu-item" onClick={() => gantiNamaObrolan(c.id)}><IconEdit /> Ganti nama</button>
                                <button className="conv-menu-item" onClick={() => toggleSematkan(c.id)}><IconPin /> {c.pinned ? "Lepas sematan" : "Sematkan"}</button>
                                <button className="conv-menu-item" onClick={() => tambahKeProyekDari(c.id)}><IconFolder /> Tambahkan ke proyek</button>
                                <button className="conv-menu-item danger" onClick={() => { setOpenMenuId(null); setConfirmDeleteId(c.id); }}><IconTrash /> Hapus</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Obrolan tanpa proyek */}
          {projects.length > 0 && obrolanTanpaProyek.length > 0 && (
            <div style={{ fontSize: 12, color: "#555", margin: "14px 0 6px 6px" }}>Obrolan lainnya</div>
          )}
          {obrolanTanpaProyek.map((c) =>
            confirmDeleteId === c.id ? (
              <div key={c.id} className="confirm-box">
                <div>Hapus obrolan ini?</div>
                <div className="confirm-actions">
                  <button onClick={() => hapusObrolan(c.id)} style={{ background: "#ff5555", color: "#fff" }}>Hapus</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ background: "#333", color: "#fff" }}>Batal</button>
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
                <span className="conv-title" onClick={() => pilihObrolan(c.id)} style={{ color: c.id === activeId ? "#ff9d4d" : "#ccc" }}>
                  {c.pinned && "📌 "}{c.title || "Obrolan Baru"}
                </span>
                <div className="conv-menu-wrap">
                  <button className="conv-delete-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}>
                    ⋯
                  </button>
                  {openMenuId === c.id && (
                    <div className="conv-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button className="conv-menu-item" onClick={() => gantiNamaObrolan(c.id)}><IconEdit /> Ganti nama</button>
                      <button className="conv-menu-item" onClick={() => toggleSematkan(c.id)}><IconPin /> {c.pinned ? "Lepas sematan" : "Sematkan"}</button>
                      <button className="conv-menu-item" onClick={() => tambahKeProyekDari(c.id)}><IconFolder /> Tambahkan ke proyek</button>
                      <button className="conv-menu-item danger" onClick={() => { setOpenMenuId(null); setConfirmDeleteId(c.id); }}><IconTrash /> Hapus</button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <button
          className="sidebar-btn"
          onClick={buatObrolanBaru}
          style={{ marginTop: 10, borderRadius: 24, padding: "12px 16px" }}
        >
          + Chat baru
        </button>
      </aside>

      {/* ===== CHAT UTAMA ===== */}
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
          {activeConversation?.projectId && (
            <span style={{ fontSize: 11, background: "#1f1f1f", color: "#aaa", padding: "3px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <IconFolderMini /> {projects.find((p) => p.id === activeConversation.projectId)?.name}
            </span>
          )}
          {modeKode && (
            <span style={{ fontSize: 11, background: "#1f1f1f", color: "#ff9d4d", padding: "3px 8px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconCode /> Mode Kode
            </span>
          )}
          {webSearchOn && (
            <span style={{ fontSize: 11, background: "#1f1f1f", color: "#ff9d4d", padding: "3px 8px", borderRadius: 12, marginLeft: "auto" }}>
              🌐 Pencarian web aktif
            </span>
          )}

          <div style={{ display: "flex", gap: 4, marginLeft: webSearchOn ? 8 : "auto" }}>
            <button className="header-icon-btn" onClick={eksporObrolan} title="Ekspor obrolan">
              <IconDocument />
            </button>
            <button className="header-icon-btn" onClick={buatObrolanBaru} title="Obrolan baru">
              <IconChatPlus />
            </button>
            <div style={{ position: "relative" }} ref={headerMenuWrapRef}>
              <button className="header-icon-btn" onClick={() => setShowHeaderMenu((v) => !v)} title="Opsi">
                <IconDots />
              </button>
              {showHeaderMenu && activeConversation && (
                <div className="conv-menu-dropdown" style={{ top: 38 }} onClick={(e) => e.stopPropagation()}>
                  <button className="conv-menu-item" onClick={() => { gantiNamaObrolan(activeConversation.id); setShowHeaderMenu(false); }}><IconEdit /> Ganti nama</button>
                  <button className="conv-menu-item" onClick={() => { toggleSematkan(activeConversation.id); setShowHeaderMenu(false); }}><IconPin /> {activeConversation.pinned ? "Lepas sematan" : "Sematkan"}</button>
                  <button className="conv-menu-item" onClick={() => { setShowHeaderMenu(false); tambahKeProyekDari(activeConversation.id); }}><IconFolder /> Tambahkan ke proyek</button>
                  <button className="conv-menu-item danger" onClick={() => { setShowHeaderMenu(false); setConfirmDeleteId(activeConversation.id); }}><IconTrash /> Hapus</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {(activeConversation?.messages.length ?? 0) === 0 && (
            <div style={{ color: "#666", textAlign: "center", marginTop: 60 }}>Mulai percakapan dengan mengetik pesan di bawah.</div>
          )}
          {activeConversation?.messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginBottom: 16 }}>
                {(() => {
                  const daftar = m.imagePreviews ?? (m.imagePreview ? [m.imagePreview] : []);
                  if (daftar.length === 0) return null;
                  const tunggal = daftar.length === 1;
                  return (
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, maxWidth: "92%" }}>
                      {daftar.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`lampiran ${idx + 1}`}
                          style={{
                            width: tunggal ? 220 : 100,
                            height: tunggal ? 220 : 100,
                            maxWidth: "100%",
                            objectFit: "cover",
                            borderRadius: 14,
                            border: "1px solid #2a2a2a",
                            display: "block",
                          }}
                        />
                      ))}
                    </div>
                  );
                })()}
                {m.content && !/^\(\d*\s*gambar\)$/.test(m.content) && (
                  <div
                    className="msg-content"
                    style={{
                      maxWidth: "92%", padding: "12px 18px", borderRadius: 16, fontSize: 16.5, lineHeight: 1.6,
                      background: "linear-gradient(135deg, #ff7a18, #ff9d4d)", color: "#0a0a0a", wordBreak: "break-word", whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                )}
              </div>
            ) : (
              <div key={i} style={{ marginBottom: 20 }}>
                <div className="msg-content" style={{ fontSize: 16.5, lineHeight: 1.65, color: "#f0f0f0", wordBreak: "break-word" }}>
                  <ReactMarkdown components={komponenMarkdown}>{m.content}</ReactMarkdown>
                </div>
              </div>
            )
          )}
          {loading && <div style={{ color: "#ff9d4d", fontSize: 14, fontStyle: "italic" }}>Sedang mengetik...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #262626", position: "relative", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          {pendingImages.length > 0 && (
            <div style={{ maxWidth: 800, margin: "0 auto 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {pendingImages.map((img, idx) => (
                <div key={idx} style={{ position: "relative" }}>
                  <img src={img.preview} alt={`preview ${idx + 1}`} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 10, display: "block" }} />
                  <button
                    onClick={() => hapusGambarPending(idx)}
                    style={{
                      position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                      background: "#333", color: "#fff", border: "1px solid #555", fontSize: 11, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}
                    title="Hapus gambar"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <span style={{ fontSize: 12, color: "#888" }}>{pendingImages.length}/{MAX_IMAGES} gambar</span>
            </div>
          )}
          {pendingLink && (
            <div style={{ maxWidth: 800, margin: "0 auto 10px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", color: "#ff9d4d" }}><IconLink /></span>
              <span style={{ fontSize: 13, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{pendingLink}</span>
              <button onClick={() => setPendingLink(null)} style={{ background: "none", border: "none", color: "#ff7a18", cursor: "pointer", fontSize: 13 }}>Hapus</button>
            </div>
          )}
          {pendingDoc && (
            <div style={{ maxWidth: 800, margin: "0 auto 10px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <span style={{ fontSize: 13, color: "#aaa" }}>{pendingDoc.name} siap dikirim</span>
              <button onClick={() => setPendingDoc(null)} style={{ background: "none", border: "none", color: "#ff7a18", cursor: "pointer", fontSize: 13 }}>Hapus</button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFilesPicked(e.target.files); e.target.value = ""; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFilesPicked(e.target.files); e.target.value = ""; }} />
          <input ref={docInputRef} type="file" accept=".txt,.pdf,.docx" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleDocPicked(e.target.files[0])} />

          <div ref={emojiWrapRef}>
            {showEmojiPicker && (
              <div className="emoji-picker">
                {EMOJI_LIST.map((em) => (
                  <button key={em} className="emoji-item" onClick={() => tambahEmoji(em)}>
                    {em}
                  </button>
                ))}
              </div>
            )}

            <div className="input-card">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && kirimPesan()}
                placeholder="Ketik pesan..."
                style={{ width: "100%", padding: "4px 4px 10px 4px", border: "none", background: "transparent", color: "#f5f5f5", outline: "none", fontSize: 16 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setShowEmojiPicker((v) => !v)} className="input-icon-btn" style={{ background: showEmojiPicker ? "#2a2015" : "transparent" }}>
                  😊
                </button>
                <button onClick={() => setShowAttachSheet(true)} className="input-icon-btn" style={{ fontSize: 20 }}>
                  +
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={mulaiRekamSuara}
                className="input-icon-btn"
                style={{ background: isListening ? "#ff3b3b" : "transparent", animation: isListening ? "pulse 1s infinite" : "none" }}
              >
                <IconMic active={isListening} />
              </button>
              <button
                onClick={kirimPesan}
                disabled={loading}
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "linear-gradient(135deg, #ff7a18, #ff9d4d)", color: "#0a0a0a", border: "none",
                  cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <IconSend />
              </button>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* ===== BOTTOM SHEET: Tambahkan ke chat ===== */}
      <div className={`sheet-backdrop ${showAttachSheet ? "open" : ""}`} onClick={() => setShowAttachSheet(false)}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17, marginBottom: 18 }}>Tambahkan ke chat</div>

          <div className="sheet-grid">
            <button className="sheet-grid-item" onClick={() => cameraInputRef.current?.click()}>
              <div className="icon-circle"><IconCamera /></div>
              Kamera
            </button>
            <button className="sheet-grid-item" onClick={() => fileInputRef.current?.click()}>
              <div className="icon-circle"><IconImage /></div>
              Foto
            </button>
            <button className="sheet-grid-item" onClick={() => docInputRef.current?.click()}>
              <div className="icon-circle"><IconFile /></div>
              File
            </button>
          </div>

          <div
            className="sheet-row"
            onClick={() => {
              setShowAttachSheet(false);
              setShowProjectPicker(true);
            }}
          >
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconFolder /></div>
              <div>
                <div style={{ fontWeight: 500 }}>Tambahkan ke proyek</div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {activeConversation?.projectId ? projects.find((p) => p.id === activeConversation.projectId)?.name : "Tidak ada"}
                </div>
              </div>
            </div>
            <IconChevron />
          </div>

          <div className="sheet-row">
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconGlobe /></div>
              <div style={{ fontWeight: 500 }}>Pencarian web</div>
            </div>
            <button className="toggle" onClick={() => setWebSearchOn((v) => !v)} style={{ background: webSearchOn ? "#ff7a18" : "#333" }}>
              <span className="knob" style={{ left: webSearchOn ? 21 : 3 }} />
            </button>
          </div>

          <div className="sheet-row" onClick={() => { setShowAttachSheet(false); setShowLinkSheet(true); }}>
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconLink /></div>
              <div>
                <div style={{ fontWeight: 500 }}>Konektor</div>
                <div style={{ fontSize: 12, color: "#888" }}>Baca isi halaman dari link</div>
              </div>
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

      {/* ===== BOTTOM SHEET: Pilih / Buat Proyek ===== */}
      <div className={`sheet-backdrop ${showLinkSheet ? "open" : ""}`} onClick={() => setShowLinkSheet(false)}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Konektor link</div>
          <div style={{ textAlign: "center", fontSize: 13, color: "#888", marginBottom: 16 }}>
            Tempel link artikel atau halaman web, lalu tanya apa saja soal isinya.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="project-picker-input"
              placeholder="https://..."
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && simpanLink()}
            />
            <button className="sidebar-btn" onClick={simpanLink}>Tambah</button>
          </div>
        </div>
      </div>

      <div className={`sheet-backdrop ${showProjectPicker ? "open" : ""}`} onClick={() => setShowProjectPicker(false)}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17, marginBottom: 18 }}>Tambahkan ke proyek</div>

          {activeConversation?.projectId && (
            <div className="project-picker-item" onClick={() => pindahKeProyek(undefined)}>
              <span>❌ Keluarkan dari proyek</span>
            </div>
          )}

          {projects.map((p) => (
            <div key={p.id} className="project-picker-item" onClick={() => pindahKeProyek(p.id)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconFolderMini /> {p.name}</span>
              {activeConversation?.projectId === p.id && <span style={{ color: "#ff9d4d" }}>✓</span>}
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              className="project-picker-input"
              placeholder="Nama proyek baru..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buatProyekBaru()}
            />
            <button className="sidebar-btn" onClick={buatProyekBaru}>Buat</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Ikon SVG ---- */
const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "#ff9d4d", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconFolderMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconChatBubble() {
  return (
    <svg {...iconProps} stroke="#aaa">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}
function BlokKode({ bahasa, teks }: { bahasa?: string; teks: string }) {
  const [tersalin, setTersalin] = useState(false);
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1500);
    } catch {
      alert("Tidak bisa menyalin otomatis. Tahan dan salin manual ya.");
    }
  };
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{bahasa || "kode"}</span>
        <button onClick={salin}>{tersalin ? "Tersalin ✓" : "Salin"}</button>
      </div>
      <pre><code>{teks}</code></pre>
    </div>
  );
}

const komponenMarkdown: any = {
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children }: any) => {
    const teks = String(children ?? "").replace(/\n$/, "");
    const bahasa = /language-([\w-]+)/.exec(className || "")?.[1];
    if (!bahasa && !teks.includes("\n")) return <code>{children}</code>;
    return <BlokKode bahasa={bahasa} teks={teks} />;
  },
};

function IconCode() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 7l-5 5 5 5" />
      <path d="M16 7l5 5-5 5" />
      <path d="M14 4l-4 16" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}
function IconDocument() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function IconChatPlus() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      <path d="M12 8v5M9.5 10.5h5" />
    </svg>
  );
}
function IconDots() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
function IconMic({ active }: { active?: boolean }) {
  const color = active ? "#fff" : "#ff9d4d";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0014 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l1.5 5.5L19 9l-4 3 1 6-4-3-4 3 1-6-4-3 5.5-1.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
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
