"use client";

import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Sumber = { judul: string; link: string };
type Message = { role: string; content: string; imagePreviews?: string[]; imagePreview?: string; sumber?: Sumber[] };
type PendingImg = { preview: string; mimeType: string; data: string };
const MAX_IMAGES = 3;
type Conversation = { id: string; title: string; messages: Message[]; projectId?: string; pinned?: boolean; incognito?: boolean };
type ProjectT = { id: string; name: string };
type Memori = { id: string; teks: string };

type PendingDoc =
  | { name: string; kind: "text"; text: string }
  | { name: string; kind: "binary"; mimeType: string; data: string };

const MAX_IMAGE_SIZE_MB = 15;
// Kalau sudah punya logo sendiri: taruh di folder public/logo.png lalu isi "/logo.png"
const LOGO_SRC = "";
const MAX_DOC_SIZE_MB = 3;
const DOC_MIME_PDF = "application/pdf";
const DOC_MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EKSTENSI_TEKS = [".txt", ".md", ".csv", ".json", ".log"];

// Pencarian web selalu aktif, tapi dilewati untuk sapaan dan pesan pendek
const SAPAAN = /^(hai|halo|hallo|hello|hi|hey|p|pagi|siang|sore|malam|assalamualaikum|apa kabar|terima kasih|makasih|thanks|ok|oke|sip|ya|iya|tes|test)\b[\s!.?,]*$/i;
function perluCariWeb(teks: string): boolean {
  const baris = (teks || "").split("\n")[0].trim();
  if (baris.length < 12) return false;
  if (SAPAAN.test(baris)) return false;
  if (/https?:\/\//i.test(baris)) return false;
  return true;
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [modeKode, setModeKode] = useState(false);
  const [ukuranTeks, setUkuranTeks] = useState<"kecil" | "sedang" | "besar">("sedang");
  const abortRef = useRef<Record<string, AbortController>>({});
  const [showWebcam, setShowWebcam] = useState(false);
  const [memories, setMemories] = useState<Memori[]>([]);
  const [memoriAktif, setMemoriAktif] = useState(true);
  const [showMemoriSheet, setShowMemoriSheet] = useState(false);
  const [activeNav, setActiveNav] = useState<"obrolan" | "proyek">("obrolan");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const headerMenuWrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Load & save data di localStorage ---
  useEffect(() => {
    let berhasilMuat = false;
    try {
      const savedConv = localStorage.getItem("myai-conversations");
      if (savedConv) {
        const parsed: Conversation[] = JSON.parse(savedConv);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setActiveId(parsed[0].id);
          berhasilMuat = true;
        }
      }
    } catch {
      // data rusak: mulai dari obrolan kosong
    }
    if (!berhasilMuat) buatObrolanBaru();
    try {
      const savedProj = localStorage.getItem("myai-projects");
      if (savedProj) setProjects(JSON.parse(savedProj));
    } catch {}
    try {
      const savedMem = localStorage.getItem("myai-memories");
      if (savedMem) {
        const m = JSON.parse(savedMem);
        if (Array.isArray(m)) setMemories(m.filter((x: any) => x && typeof x.id === "string" && typeof x.teks === "string"));
      }
      if (localStorage.getItem("myai-memori-aktif") === "0") setMemoriAktif(false);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("myai-conversations", JSON.stringify(conversations.filter((c) => !c.incognito)));
    } catch {
      // Penyimpanan browser penuh: simpan tanpa gambar supaya aplikasi tidak crash
      try {
        const tanpaGambar = conversations.filter((c) => !c.incognito).map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({ ...m, imagePreviews: undefined, imagePreview: undefined })),
        }));
        localStorage.setItem("myai-conversations", JSON.stringify(tanpaGambar));
      } catch {}
    }
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem("myai-projects", JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem("myai-memories", JSON.stringify(memories));
    } catch {}
  }, [memories]);

  useEffect(() => {
    try {
      localStorage.setItem("myai-memori-aktif", memoriAktif ? "1" : "0");
    } catch {}
  }, [memoriAktif]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  // Kamera laptop: buka webcam saat modal tampil, matikan saat ditutup
  useEffect(() => {
    if (!showWebcam) return;
    let stream: MediaStream | null = null;
    let batal = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        if (batal) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        alert("Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau pakai tombol Foto.");
        setShowWebcam(false);
      });
    return () => {
      batal = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [showWebcam]);

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

  useEffect(() => {
    try {
      const u = localStorage.getItem("myai-ukuran");
      if (u === "kecil" || u === "sedang" || u === "besar") setUkuranTeks(u);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("myai-ukuran", ukuranTeks);
    } catch {}
  }, [ukuranTeks]);

  const ukuranPx = ukuranTeks === "kecil" ? 14.5 : ukuranTeks === "besar" ? 19 : 16.5;

  const activeConversation = conversations.find((c) => c.id === activeId);

  // --- Obrolan ---
  const buatObrolanBaru = () => {
    const id = Date.now().toString();
    const baru: Conversation = { id, title: "Obrolan Baru", messages: [] };
    setConversations((prev) => [baru, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
  };

  // Obrolan incognito: tidak disimpan di browser, tidak memakai dan tidak menambah memori
  const buatObrolanIncognito = () => {
    const id = `inc-${Date.now()}`;
    const baru: Conversation = { id, title: "Obrolan incognito", messages: [], incognito: true };
    setConversations((prev) => [baru, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
    setShowHeaderMenu(false);
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

  // Bagikan isi obrolan lewat menu share bawaan HP/laptop (tanpa link publik, tanpa server)
  const bagikanObrolan = async () => {
    if (!activeConversation || activeConversation.messages.length === 0) {
      alert("Belum ada isi obrolan untuk dibagikan.");
      return;
    }
    const isi = activeConversation.messages
      .map((m) => `${m.role === "user" ? "Kamu" : "My AI"}: ${m.content}`)
      .join("\n\n");
    const judul = activeConversation.title || "Obrolan My AI";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: judul, text: isi });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // user menutup menu share
      }
    }
    try {
      await navigator.clipboard.writeText(isi);
      alert("Obrolan disalin. Tinggal tempel di WhatsApp atau tempat lain.");
    } catch {
      alert("Tidak bisa membagikan otomatis. Pakai tombol Ekspor ya.");
    }
  };

  const hapusSemuaObrolan = () => {
    setShowHeaderMenu(false);
    if (!confirm("Hapus SEMUA obrolan? Ini tidak bisa dikembalikan kecuali kamu punya file cadangan. Proyek dan memori tidak ikut terhapus.")) return;
    const id = Date.now().toString();
    setConversations([{ id, title: "Obrolan Baru", messages: [] }]);
    setActiveId(id);
    setConfirmDeleteId(null);
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
  const handleFilesPicked = (fileList: FileList | File[]) => {
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
      muatGambar(file)
        .then((img) => {
          const kirim = gambarKeJpeg(img, 1600, 0.85); // dikirim ke AI (sekitar 300-600KB)
          const mini = gambarKeJpeg(img, 240, 0.7); // disimpan di riwayat (sekitar 10-20KB)
          setPendingImages((prev) =>
            prev.length >= MAX_IMAGES
              ? prev
              : [...prev, { preview: mini, mimeType: "image/jpeg", data: kirim.split(",")[1] }]
          );
        })
        .catch(() => alert(`"${file.name}" tidak bisa dibaca sebagai gambar. Coba foto lain.`));
    });
    setShowAttachSheet(false);
  };

  const hapusGambarPending = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Kamera: HP pakai kamera bawaan, laptop pakai webcam lewat jendela kecil ---
  const bukaKamera = () => {
    if (pendingImages.length >= MAX_IMAGES) {
      alert(`Maksimal ${MAX_IMAGES} gambar per pesan.`);
      return;
    }
    const hp = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (!hp && typeof navigator.mediaDevices?.getUserMedia === "function") {
      setShowAttachSheet(false);
      setShowWebcam(true);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const ambilFotoWebcam = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "kamera.jpg", { type: "image/jpeg" });
        setShowWebcam(false);
        handleFilesPicked([file]);
      },
      "image/jpeg",
      0.9
    );
  };

  // --- Upload dokumen (teks langsung dibaca, .pdf/.docx dikirim ke server) ---
  const handleDocPicked = (file: File) => {
    const namaLower = file.name.toLowerCase();
    const isTeks = EKSTENSI_TEKS.some((e) => namaLower.endsWith(e));
    const isPdf = file.type === DOC_MIME_PDF || namaLower.endsWith(".pdf");
    const isDocx = file.type === DOC_MIME_DOCX || namaLower.endsWith(".docx");

    if (!isTeks && !isPdf && !isDocx) {
      alert("Format yang didukung: .txt, .md, .csv, .json, .log, .pdf, atau .docx (Word).");
      return;
    }
    if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
      alert(`Ukuran file maksimal ${MAX_DOC_SIZE_MB}MB.`);
      return;
    }

    if (isTeks) {
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

  // --- Cadangkan & pulihkan riwayat (tanpa akun) ---
  const eksporRiwayat = () => {
    const isi = JSON.stringify({ versi: 1, dibuat: new Date().toISOString(), conversations: conversations.filter((c) => !c.incognito), projects, memories }, null, 2);
    const blob = new Blob([isi], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadangan-my-ai-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowHeaderMenu(false);
  };

  const imporRiwayat = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const convBaru: Conversation[] = Array.isArray(data?.conversations) ? data.conversations : [];
        const projBaru: ProjectT[] = Array.isArray(data?.projects) ? data.projects : [];
        const valid = convBaru
          .filter((c) => c && typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages))
          .map((c) => ({
            ...c,
            messages: c.messages.filter((m) => m && typeof m.role === "string" && typeof m.content === "string"),
          }));
        const projValid = projBaru.filter((p) => p && typeof p.id === "string" && typeof p.name === "string");
        if (valid.length === 0 && projValid.length === 0) {
          alert("File ini bukan cadangan My AI yang valid.");
          return;
        }
        const idAda = new Set(conversations.map((c) => c.id));
        const projAda = new Set(projects.map((p) => p.id));
        const tambahan = valid.filter((c) => !idAda.has(c.id));
        const projTambahan = projValid.filter((p) => !projAda.has(p.id));
        const memBaru: Memori[] = Array.isArray(data?.memories)
          ? data.memories.filter((m: any) => m && typeof m.id === "string" && typeof m.teks === "string")
          : [];
        const teksAda = new Set(memories.map((m) => m.teks.toLowerCase()));
        const memTambahan = memBaru.filter((m) => !teksAda.has(m.teks.toLowerCase()));
        setMemories((prev) => [...prev, ...memTambahan].slice(-60));
        setConversations((prev) => [...prev, ...tambahan]);
        setProjects((prev) => [...prev, ...projTambahan]);
        alert(`Berhasil memulihkan ${tambahan.length} obrolan dan ${projTambahan.length} proyek dan ${memTambahan.length} memori.`);
      } catch {
        alert("File cadangan tidak bisa dibaca.");
      }
    };
    reader.readAsText(file);
    setShowHeaderMenu(false);
  };

  // --- Memori lintas obrolan (disimpan di browser) ---
  const hapusMemori = (id: string) => setMemories((prev) => prev.filter((m) => m.id !== id));

  const ingatDariObrolan = async (pesan: string, jawaban: string, sudahAda: string[]) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "ingat", pesan, jawaban: jawaban.slice(0, 1500), sudahAda }),
      });
      const hasil = await res.json();
      const baru: string[] = Array.isArray(hasil?.fakta) ? hasil.fakta : [];
      if (baru.length === 0) return;
      setMemories((prev) => {
        const ada = new Set(prev.map((m) => m.teks.toLowerCase()));
        const tambahan = baru
          .filter((f) => typeof f === "string" && !ada.has(f.toLowerCase()))
          .map((f, i) => ({ id: `${Date.now()}-${i}`, teks: f }));
        return [...prev, ...tambahan].slice(-60);
      });
    } catch {
      // memori gagal dicatat: abaikan saja, obrolan tetap jalan
    }
  };

  // --- Kirim pesan ---
  // Buat ulang jawaban terakhir (hanya untuk pesan teks biasa)
  const ulangiJawaban = async () => {
    const convId = activeId;
    const conv = conversations.find((c) => c.id === convId);
    if (!conv || loadingIds.includes(convId)) return;
    const pesan = conv.messages;
    if (!bisaDiulang(pesan, pesan.length - 1)) return;
    const teksUser = pesan[pesan.length - 2].content;
    const riwayat = pesan
      .slice(0, -2)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content || "(user mengirim gambar)" }));
    const memoriUntukAI = memoriAktif && !conv.incognito ? memories.slice(-40).map((m) => m.teks) : [];

    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, messages: c.messages.slice(0, -1) } : c)));
    setLoadingIds((prev) => [...prev, convId]);
    const ctrl = new AbortController();
    abortRef.current[convId] = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          userId: "user-1",
          message: teksUser,
          mode: modeKode ? "kode" : "chat",
          memories: memoriUntukAI,
          webSearch: perluCariWeb(teksUser) && !teksUser.includes("🔗"),
          history: riwayat,
        }),
      });
      const data = await res.json();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: data.reply || data.error || "Maaf, terjadi kesalahan.", sumber: bersihkanSumber(data?.sumber) }] }
            : c
        )
      );
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: (err as Error).name === "AbortError" ? "Dihentikan." : "Maaf, terjadi kesalahan. Coba lagi ya." }] }
            : c
        )
      );
    } finally {
      delete abortRef.current[convId];
      setLoadingIds((prev) => prev.filter((id) => id !== convId));
    }
  };

  const hentikanJawaban = () => {
    abortRef.current[activeId]?.abort();
  };

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
    const incognito = !!conversations.find((c) => c.id === convId)?.incognito;
    const memoriUntukAI = memoriAktif && !incognito ? memories.slice(-40).map((m) => m.teks) : [];
    const gambarUntukDikirim = pendingImages;
    const dokUntukDikirim = pendingDoc;
    const linkUntukDikirim = pendingLink;

    // Cari di web otomatis, kecuali sapaan/pesan pendek, atau saat ada file atau link
    const cariWebSekarang = perluCariWeb(teksInput) && !dokUntukDikirim && !linkUntukDikirim;

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
    const ctrl = new AbortController();
    abortRef.current[convId] = ctrl;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 && !c.incognito ? (teksInput || dokUntukDikirim?.name || linkUntukDikirim || "Gambar").slice(0, 30) : c.title,
              messages: [...c.messages, pesanUser],
            }
          : c
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
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
          memories: memoriUntukAI,
          webSearch: cariWebSekarang,
          history: riwayatUntukAI,
        }),
      });
      const data = await res.json();

      // Catat hal penting dari obrolan ini ke memori (diam-diam, tidak menghalangi jawaban)
      if (memoriAktif && !incognito && !modeKode && teksInput.trim().length >= 30 && data?.reply) {
        ingatDariObrolan(teksInput, data.reply, memories.map((m) => m.teks));
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: data.reply || data.error || "Maaf, terjadi kesalahan.", sumber: bersihkanSumber(data?.sumber) }] }
            : c
        )
      );
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, { role: "assistant", content: (err as Error).name === "AbortError" ? "Dihentikan." : "Maaf, terjadi kesalahan. Coba lagi ya." }] }
            : c
        )
      );
    } finally {
      delete abortRef.current[convId];
      setLoadingIds((prev) => prev.filter((id) => id !== convId));
    }
  };

  // --- Tulisan status AI sesuai yang sedang dikerjakan ---
  const pesanTerakhirUser = [...(activeConversation?.messages || [])].reverse().find((m) => m.role === "user");
  const frasaStatus: string[] = [
    ...(pesanTerakhirUser && ((pesanTerakhirUser.imagePreviews?.length ?? 0) > 0 || pesanTerakhirUser.imagePreview) ? ["Melihat gambar"] : []),
    ...(pesanTerakhirUser?.content.includes("🔗") ? ["Membuka link"] : []),
    ...(pesanTerakhirUser?.content.startsWith("📄") ? ["Membaca file"] : []),
    ...(pesanTerakhirUser && !pesanTerakhirUser.content.includes("🔗") && !pesanTerakhirUser.content.startsWith("📄") && perluCariWeb(pesanTerakhirUser.content) ? ["Mencari di web"] : []),
    ...(modeKode ? ["Menyusun kode"] : []),
    "Berpikir",
    "Merangkai jawaban",
    "Menulis",
  ];

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
        .msg-content a { color: #ff9d4d; text-decoration: underline; text-underline-offset: 2px; word-break: break-all; }
        .msg-content a:hover { color: #ffb36b; }
        .aksi-btn {
          width: 32px; height: 32px; border-radius: 8px; border: none; background: none; color: #888;
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .aksi-btn:hover { color: #ff9d4d; background: #1a1a1a; }

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

        .myai-typing { display: flex; align-items: center; gap: 10px; color: #ff9d4d; font-size: 15px; margin: 4px 0 16px 0; }
        .myai-typing .icon { display: inline-flex; }
        .myai-typing .teks { animation: myai-fade 0.4s ease; }
        .myai-typing .dots::after { content: ""; animation: myai-dots 1.2s steps(1) infinite; }
        @keyframes myai-spin {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.12); }
          
        }
        @keyframes myai-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes myai-dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }

        .neuron .ekor { transform-box: view-box; transform-origin: 15.4px 16px; }
        .neuron.animated .ekor { animation: neuron-ekor 1.5s ease-in-out infinite; }
        .neuron.animated .soma { transform-box: fill-box; transform-origin: center; animation: neuron-denyut 1.5s ease-in-out infinite; }
        .neuron .pulse { animation: neuron-pulse 1.2s linear infinite; }
        @keyframes neuron-ekor { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        @keyframes neuron-denyut { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.14); } }
        @keyframes neuron-pulse { from { stroke-dashoffset: 23; } to { stroke-dashoffset: 0; } }

        .logo-img-anim { animation: logo-melayang 1.6s ease-in-out infinite; }
        @keyframes logo-melayang {
          0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 0 rgba(255,157,77,0)); }
          50% { transform: translateY(-3px) scale(1.1); filter: drop-shadow(0 0 6px rgba(255,157,77,0.7)); }
        }

        .memori-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #1a1a1a; border-radius: 10px; margin-bottom: 6px; font-size: 14px; line-height: 1.45; }
        .memori-item button { background: none; border: none; color: #888; cursor: pointer; font-size: 14px; flex-shrink: 0; }
        .memori-item button:hover { color: #ff6b6b; }

        .msg-content .katex { font-size: 1.08em; }
        .msg-content .katex-display { overflow-x: auto; overflow-y: hidden; padding: 4px 0; margin: 10px 0; }
        .msg-content table { border-collapse: collapse; margin: 10px 0; display: block; overflow-x: auto; max-width: 100%; }
        .msg-content th, .msg-content td { border: 1px solid #2f2f2f; padding: 6px 10px; font-size: 14.5px; }
        .msg-content th { background: #1a1a1a; }

        .kartu-hasil { border: 1px solid #2a2a2a; border-radius: 14px; background: #101010; margin: 12px 0; overflow: hidden; }
        .kartu-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #222; font-weight: 700; font-size: 17px; }
        .kartu-item { display: flex; gap: 12px; padding: 12px 16px; }
        .kartu-item-ikon { flex-shrink: 0; margin-top: 1px; display: inline-flex; }
        .kartu-item-judul { font-weight: 700; font-size: 15.5px; }
        .kartu-item-teks { color: #cfcfcf; font-size: 15px; line-height: 1.55; margin-top: 2px; }
        .kartu-ringkasan { padding: 12px 16px 14px; border-top: 1px solid #222; color: #cfcfcf; font-size: 15px; line-height: 1.55; }

        .grafik-box { height: 400px; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; margin: 12px 0; background: #0d0d0d; }
        .grafik-sumber { height: 24px; font-size: 11px; text-align: right; padding: 4px 10px 0 0; }
        .grafik-sumber a { color: #6b7280; text-decoration: none; }

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

        .webcam-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 300;
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .webcam-box {
          background: #161616; border: 1px solid #2a2a2a; border-radius: 18px;
          padding: 14px; width: 100%; max-width: 520px;
        }
        .webcam-box video { width: 100%; border-radius: 12px; background: #000; display: block; }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,59,59,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(255,59,59,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,59,59,0); }
        }
      `}</style>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ padding: "4px 6px 16px 6px", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMyAI size={30} />
          <span><span style={{ color: "#ff7a18" }}>My</span> AI</span>
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
        </div>
        <div className="nav-item" onClick={buatObrolanIncognito}>
          <span style={{ color: "#aaa", display: "inline-flex" }}><IconIncognito /></span>
          <span style={{ color: "#ddd" }}>Incognito</span>
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
                            {c.incognito && "🕶️ "}{c.pinned && "📌 "}{c.title || "Obrolan Baru"}
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
                  {c.incognito && "🕶️ "}{c.pinned && "📌 "}{c.title || "Obrolan Baru"}
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

          {activeConversation?.incognito && (
            <span style={{ fontSize: 11, background: "#1f1f1f", color: "#ff9d4d", padding: "3px 10px", borderRadius: 12 }}>Incognito</span>
          )}

          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <button className="header-icon-btn" onClick={bagikanObrolan} title="Bagikan obrolan">
              <IconShare />
            </button>
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
                  <button className="conv-menu-item" onClick={() => setUkuranTeks((u) => (u === "kecil" ? "sedang" : u === "sedang" ? "besar" : "kecil"))}>
                    <span style={{ width: 15, textAlign: "center", color: "#ccc", fontWeight: 700 }}>Aa</span> Ukuran tulisan: {ukuranTeks}
                  </button>
                  <button className="conv-menu-item" onClick={buatObrolanIncognito}><IconIncognito /> Obrolan incognito</button>
                  <button className="conv-menu-item" onClick={() => { gantiNamaObrolan(activeConversation.id); setShowHeaderMenu(false); }}><IconEdit /> Ganti nama</button>
                  <button className="conv-menu-item" onClick={() => { toggleSematkan(activeConversation.id); setShowHeaderMenu(false); }}><IconPin /> {activeConversation.pinned ? "Lepas sematan" : "Sematkan"}</button>
                  <button className="conv-menu-item" onClick={() => { setShowHeaderMenu(false); tambahKeProyekDari(activeConversation.id); }}><IconFolder /> Tambahkan ke proyek</button>
                  <button className="conv-menu-item" onClick={eksporRiwayat}><IconDownload /> Cadangkan semua obrolan</button>
                  <button className="conv-menu-item" onClick={() => importRef.current?.click()}><IconUpload /> Pulihkan dari cadangan</button>
                  <button className="conv-menu-item danger" onClick={() => { setShowHeaderMenu(false); setConfirmDeleteId(activeConversation.id); }}><IconTrash /> Hapus</button>
                  <button className="conv-menu-item danger" onClick={hapusSemuaObrolan}><IconTrash /> Hapus semua obrolan</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {(activeConversation?.messages.length ?? 0) === 0 && (
            <div style={{ textAlign: "center", marginTop: 70, color: "#777" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><LogoMyAI size={56} animated /></div>
              <div style={{ fontSize: 18, color: "#ddd", fontWeight: 600 }}>Halo, ada yang bisa kubantu?</div>
              <div style={{ fontSize: 13, marginTop: 6, padding: "0 20px" }}>
                {activeConversation?.incognito
                  ? "Mode incognito: obrolan ini tidak disimpan dan tidak masuk memori. Hilang kalau halaman dimuat ulang."
                  : "Ketik pesan, kirim foto, atau tempel link."}
              </div>
            </div>
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
                      maxWidth: "92%", padding: "12px 18px", borderRadius: 16, fontSize: ukuranPx, lineHeight: 1.6,
                      background: "linear-gradient(135deg, #ff7a18, #ff9d4d)", color: "#0a0a0a", wordBreak: "break-word", whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                )}
              </div>
            ) : (
              <div key={i} style={{ marginBottom: 20 }}>
                <div className="msg-content" style={{ fontSize: ukuranPx, lineHeight: 1.65, color: "#f0f0f0", wordBreak: "break-word" }}>
                  <ReactMarkdown remarkPlugins={pluginRemark} rehypePlugins={pluginRehype} components={komponenMarkdown}>{siapkanMatematika(m.content)}</ReactMarkdown>
                </div>
                <BarisAksi
                  teks={m.content}
                  sumber={m.sumber}
                  bisaUlang={!loading && bisaDiulang(activeConversation!.messages, i)}
                  onUlang={ulangiJawaban}
                />
              </div>
            )
          )}
          {loading && <IndikatorMengetik frasa={frasaStatus} />}
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
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) imporRiwayat(f);
              e.target.value = "";
            }}
          />
          <input
            ref={docInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.log,.pdf,.docx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleDocPicked(f);
              e.target.value = "";
            }}
          />

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
                <span
                  className="input-icon-btn"
                  title="Pencarian web selalu aktif"
                  style={{ background: "rgba(77,163,255,0.18)", cursor: "default" }}
                >
                  <IconWeb aktif />
                </span>
                <button
                  onClick={() => setModeKode((v) => !v)}
                  className="input-icon-btn"
                  title={modeKode ? "Mode Kode menyala" : "Nyalakan Mode Kode"}
                  style={{ background: modeKode ? "rgba(255,122,24,0.22)" : "transparent", color: modeKode ? "#ff9d4d" : "#888" }}
                >
                  <IconCode />
                </button>
                <button
                  onClick={mulaiRekamSuara}
                  className="input-icon-btn"
                  style={{ background: isListening ? "#ff3b3b" : "transparent", animation: isListening ? "pulse 1s infinite" : "none" }}
                >
                  <IconMic active={isListening} />
                </button>
                <button
                  onClick={loading ? hentikanJawaban : kirimPesan}
                  title={loading ? "Hentikan" : "Kirim"}
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "linear-gradient(135deg, #ff7a18, #ff9d4d)", color: "#0a0a0a", border: "none",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  {loading ? <IconStop /> : <IconSend />}
                </button>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: 11.5, color: "#666", marginTop: 8 }}>
              My AI adalah AI dan dapat membuat kesalahan. Periksa info penting.
            </div>
          </div>
        </div>
      </main>

      {/* ===== MODAL WEBCAM (laptop) ===== */}
      {showWebcam && (
        <div className="webcam-backdrop" onClick={() => setShowWebcam(false)}>
          <div className="webcam-box" onClick={(e) => e.stopPropagation()}>
            <video ref={videoRef} playsInline muted autoPlay />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="sidebar-btn" style={{ flex: 1 }} onClick={ambilFotoWebcam}>Ambil foto</button>
              <button className="sidebar-btn-secondary" onClick={() => setShowWebcam(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Tambahkan ke chat ===== */}
      <div className={`sheet-backdrop ${showAttachSheet ? "open" : ""}`} onClick={() => setShowAttachSheet(false)}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17, marginBottom: 18 }}>Tambahkan ke chat</div>

          <div className="sheet-grid">
            <button className="sheet-grid-item" onClick={bukaKamera}>
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

          <div className="sheet-row" onClick={() => { setShowAttachSheet(false); setShowMemoriSheet(true); }}>
            <div className="sheet-row-left">
              <div className="icon-circle-sm"><IconBrain /></div>
              <div>
                <div style={{ fontWeight: 500 }}>Memori</div>
                <div style={{ fontSize: 12, color: "#888" }}>{memoriAktif ? `Aktif · ${memories.length} hal diingat` : "Nonaktif"}</div>
              </div>
            </div>
            <button
              className="toggle"
              onClick={(e) => { e.stopPropagation(); setMemoriAktif((v) => !v); }}
              style={{ background: memoriAktif ? "#ff7a18" : "#333" }}
            >
              <span className="knob" style={{ left: memoriAktif ? 21 : 3 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM SHEET: Memori ===== */}
      <div className={`sheet-backdrop ${showMemoriSheet ? "open" : ""}`} onClick={() => setShowMemoriSheet(false)}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Memori My AI</div>
          <div style={{ textAlign: "center", fontSize: 13, color: "#888", marginBottom: 14 }}>
            Hal-hal yang diingat dari obrolanmu supaya jawaban nyambung di obrolan baru. Tersimpan hanya di browser ini, dan bisa kamu hapus kapan saja.
          </div>
          {memories.length === 0 && (
            <div style={{ textAlign: "center", color: "#666", padding: 16, fontSize: 14 }}>Belum ada yang diingat.</div>
          )}
          {memories.map((m) => (
            <div key={m.id} className="memori-item">
              <span>{m.teks}</span>
              <button onClick={() => hapusMemori(m.id)} title="Hapus">✕</button>
            </div>
          ))}
          {memories.length > 0 && (
            <button
              className="sidebar-btn-secondary"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => { if (confirm("Hapus semua memori?")) setMemories([]); }}
            >
              Hapus semua memori
            </button>
          )}
        </div>
      </div>

      {/* ===== BOTTOM SHEET: Konektor link ===== */}
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

      {/* ===== BOTTOM SHEET: Pilih / Buat Proyek ===== */}
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
// Perkecil gambar di browser: versi kirim (ringan) dan versi mini untuk riwayat chat
function muatGambar(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

function gambarKeJpeg(img: HTMLImageElement, sisiMaks: number, kualitas: number): string {
  const skala = Math.min(1, sisiMaks / Math.max(img.width, img.height));
  const lebar = Math.max(1, Math.round(img.width * skala));
  const tinggi = Math.max(1, Math.round(img.height * skala));
  const canvas = document.createElement("canvas");
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas tidak tersedia");
  ctx.fillStyle = "#ffffff"; // latar putih supaya PNG transparan tidak jadi hitam
  ctx.fillRect(0, 0, lebar, tinggi);
  ctx.drawImage(img, 0, 0, lebar, tinggi);
  return canvas.toDataURL("image/jpeg", kualitas);
}

function LogoMyAI({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  if (LOGO_SRC) {
    return (
      <img src={LOGO_SRC} alt="My AI" width={size} height={size} className={animated ? "logo-img-anim" : undefined} style={{ borderRadius: size * 0.28, objectFit: "cover", display: "block" }} />
    );
  }
  // Logo bawaan: cincin oranye berputar + garis miring (ganti dengan logomu sendiri lewat LOGO_SRC)
  const kecepatan = animated ? "2.2s" : "8s";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: "block" }}>
      <defs>
        <radialGradient id="bhGlow" cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#ff7a18" stopOpacity="0" />
          <stop offset="70%" stopColor="#ff9d4d" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff7a18" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bhRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a18" />
          <stop offset="1" stopColor="#ffb36b" />
        </linearGradient>
        <linearGradient id="bhSlash" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff9d4d" />
          <stop offset="1" stopColor="#fff1e0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#050505" stroke="#2a2a2a" strokeWidth="0.6" />
      <circle cx="16" cy="16" r="15" fill="url(#bhGlow)" />
      <circle cx="16" cy="16" r="12.2" fill="none" stroke="#ff9d4d" strokeOpacity="0.4" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="5 11">
        <animateTransform attributeName="transform" type="rotate" from="360 16 16" to="0 16 16" dur={kecepatan} repeatCount="indefinite" />
      </circle>
      <circle cx="16" cy="16" r="8.4" fill="none" stroke="url(#bhRing)" strokeWidth="3" strokeLinecap="round" strokeDasharray="40 12.8">
        <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur={kecepatan} repeatCount="indefinite" />
      </circle>
      <path d="M4.5 27.5 Q12.5 12.5 27.5 4.5 Q19.5 19.5 4.5 27.5 Z" fill="url(#bhSlash)" stroke="#050505" strokeWidth="1.3" strokeLinejoin="round" paintOrder="stroke" />
    </svg>
  );
}

function IconWeb({ aktif }: { aktif?: boolean }) {
  const warna = aktif ? "#4da3ff" : "#ff9d4d";
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={warna} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff9d4d">
      <path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" />
    </svg>
  );
}

// Animasi saat AI bekerja: ikon bergerak + tulisan yang berganti sesuai pekerjaan
function IndikatorMengetik({ frasa }: { frasa: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="myai-typing">
      <span className="icon"><LogoMyAI size={26} animated /></span>
      <span key={idx} className="teks">
        {frasa[idx % frasa.length]}
        <span className="dots" />
      </span>
    </div>
  );
}

// ---- Sumber jawaban (hasil pencarian web atau link), tampil sebagai chip yang bisa dibuka ----
function bersihkanSumber(data: any): Sumber[] | undefined {
  if (!Array.isArray(data)) return undefined;
  const hasil = data
    .filter((s: any) => s && typeof s.link === "string" && /^https?:\/\//i.test(s.link))
    .map((s: any) => ({ judul: String(s.judul || s.link).slice(0, 120), link: String(s.link) }))
    .slice(0, 6);
  return hasil.length > 0 ? hasil : undefined;
}

function domainDari(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

function ChipSumber({ sumber }: { sumber: Sumber[] }) {
  const [buka, setBuka] = useState(false);
  const sisa = sumber.length - 1;
  return (
    <>
      <button
        onClick={() => setBuka((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "#1f1f1f", color: "#bbb",
          border: "1px solid #333", borderRadius: 999, padding: "4px 12px 4px 8px", fontSize: 12.5, cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da3ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z" />
        </svg>
        {domainDari(sumber[0].link)}{sisa > 0 ? ` +${sisa}` : ""}
      </button>
      {buka && (
        <div style={{ flexBasis: "100%", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 6 }}>
          {sumber.map((s, i) => (
            <a
              key={i}
              href={s.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", padding: "8px 10px", borderRadius: 8, textDecoration: "none" }}
            >
              <div style={{ color: "#eee", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.judul}</div>
              <div style={{ color: "#777", fontSize: 12 }}>{domainDari(s.link)}</div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Baris tombol di bawah jawaban AI: salin, bagikan, bacakan, suka, tidak suka, ulangi ----
function bisaDiulang(pesan: Message[], i: number): boolean {
  if (i !== pesan.length - 1) return false;
  const u = pesan[i - 1];
  return !!u && u.role === "user" && !!u.content && !u.content.startsWith("📄") && !(u.imagePreviews && u.imagePreviews.length) && !u.imagePreview;
}

function TombolIkon({ judul, onClick, aktif, children }: { judul: string; onClick: () => void; aktif?: boolean; children: ReactNode }) {
  return (
    <button className="aksi-btn" title={judul} aria-label={judul} onClick={onClick} style={aktif ? { color: "#ff9d4d" } : undefined}>
      {children}
    </button>
  );
}

const ikonProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function BarisAksi({ teks, sumber, bisaUlang, onUlang }: { teks: string; sumber?: Sumber[]; bisaUlang: boolean; onUlang: () => void }) {
  const [tersalin, setTersalin] = useState(false);
  const [membaca, setMembaca] = useState(false);
  const [reaksi, setReaksi] = useState<"suka" | "tidak" | null>(null);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1500);
    } catch {
      alert("Tidak bisa menyalin otomatis. Tahan dan salin manual ya.");
    }
  };

  const bagikan = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: teks });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    salin();
  };

  const bacakan = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Browser kamu belum mendukung baca suara.");
      return;
    }
    if (membaca) {
      window.speechSynthesis.cancel();
      setMembaca(false);
      return;
    }
    const bersih = teks
      .replace(/```[\s\S]*?```/g, " blok kode dilewati. ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[*#_`>$|]/g, "");
    const u = new SpeechSynthesisUtterance(bersih);
    u.lang = "id-ID";
    u.onend = () => setMembaca(false);
    u.onerror = () => setMembaca(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setMembaca(true);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", marginTop: 4 }}>
      {sumber && sumber.length > 0 && (
        <span style={{ marginRight: 8, display: "contents" }}><ChipSumber sumber={sumber} /></span>
      )}
      <TombolIkon judul={tersalin ? "Tersalin" : "Salin"} onClick={salin} aktif={tersalin}>
        {tersalin ? (
          <svg {...ikonProps}><path d="M20 6L9 17l-5-5" /></svg>
        ) : (
          <svg {...ikonProps}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        )}
      </TombolIkon>
      <TombolIkon judul="Bagikan" onClick={bagikan}>
        <svg {...ikonProps}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.9l7.6-4.3M8.2 13.1l7.6 4.3" /></svg>
      </TombolIkon>
      <TombolIkon judul={membaca ? "Berhenti membaca" : "Bacakan"} onClick={bacakan} aktif={membaca}>
        {membaca ? (
          <svg {...ikonProps}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        ) : (
          <svg {...ikonProps}><path d="M6 4l14 8-14 8z" /></svg>
        )}
      </TombolIkon>
      <TombolIkon judul="Suka" onClick={() => setReaksi((r) => (r === "suka" ? null : "suka"))} aktif={reaksi === "suka"}>
        <svg {...ikonProps} fill={reaksi === "suka" ? "currentColor" : "none"}><path d="M7 10v12" /><path d="M15 5.9L14 10h5.8a2 2 0 011.9 2.6l-2.3 8a2 2 0 01-1.9 1.4H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.8a2 2 0 001.8-1.1L12 2a3.1 3.1 0 013 3.9z" /></svg>
      </TombolIkon>
      <TombolIkon judul="Tidak suka" onClick={() => setReaksi((r) => (r === "tidak" ? null : "tidak"))} aktif={reaksi === "tidak"}>
        <svg {...ikonProps} fill={reaksi === "tidak" ? "currentColor" : "none"}><path d="M17 14V2" /><path d="M9 18.1L10 14H4.2a2 2 0 01-1.9-2.6l2.3-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.8a2 2 0 00-1.8 1.1L12 22a3.1 3.1 0 01-3-3.9z" /></svg>
      </TombolIkon>
      {bisaUlang && (
        <TombolIkon judul="Buat ulang jawaban" onClick={onUlang}>
          <svg {...ikonProps}><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        </TombolIkon>
      )}
    </div>
  );
}

// Tombol salin seluruh jawaban AI
function TombolSalin({ teks }: { teks: string }) {
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
    <button
      onClick={salin}
      style={{ background: "none", border: "none", color: tersalin ? "#ff9d4d" : "#777", fontSize: 12.5, cursor: "pointer", padding: "4px 0", marginTop: 4 }}
    >
      {tersalin ? "Tersalin ✓" : "Salin jawaban"}
    </button>
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

// ---- Rumus matematika, kartu hasil, dan grafik di dalam jawaban AI ----
const pluginRemark: any[] = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]];
const pluginRehype: any[] = [rehypeKatex];

// Ubah gaya rumus lama (garis-miring + kurung) jadi $$...$$, kecuali di dalam blok kode
function siapkanMatematika(teks: string): string {
  return teks
    .split(/(```[\s\S]*?```)/g)
    .map((bagian, i) =>
      i % 2 === 1
        ? bagian
        : bagian
            .replace(/\\\[([\s\S]+?)\\\]/g, (_m, rumus) => `\n$$\n${String(rumus).trim()}\n$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_m, rumus) => `$$${String(rumus).trim()}$$`)
    )
    .join("");
}

const INTERVAL_OK = ["1", "3", "5", "15", "30", "60", "120", "240", "D", "W", "M"];
function bacaGrafik(data: any): { simbol: string; interval: string } | null {
  const simbol = typeof data?.simbol === "string" ? data.simbol.trim() : "";
  if (!/^[A-Za-z0-9_.:!-]{2,40}$/.test(simbol)) return null;
  const interval = INTERVAL_OK.includes(String(data?.interval)) ? String(data.interval) : "15";
  return { simbol, interval };
}

// Grafik harga langsung dari TradingView (widget resmi, gratis, tanpa API key)
function GrafikTradingView({ simbol, interval }: { simbol: string; interval: string }) {
  const wadah = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    el.innerHTML = "";
    const isi = document.createElement("div");
    isi.className = "tradingview-widget-container__widget";
    isi.style.height = "100%";
    isi.style.width = "100%";
    el.appendChild(isi);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: simbol,
      interval,
      timezone: "Asia/Jakarta",
      theme: "dark",
      style: "1",
      locale: "id",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, [simbol, interval]);
  return (
    <div className="grafik-box">
      <div className="tradingview-widget-container" ref={wadah} style={{ height: "calc(100% - 24px)", width: "100%" }} />
      <div className="grafik-sumber">
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener nofollow">Grafik oleh TradingView</a>
      </div>
    </div>
  );
}

function IkonKartu({ nama }: { nama?: string }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (nama === "perisai")
    return (
      <svg {...p} stroke="#34d399"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
    );
  if (nama === "target")
    return (
      <svg {...p} stroke="#fb923c"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>
    );
  if (nama === "bintang")
    return (
      <svg {...p} stroke="#fbbf24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
    );
  return (
    <svg {...p} stroke="#34d399">
      <path d="M9 3a3 3 0 00-3 3v1a3 3 0 00-2 2.8V13a3 3 0 002 2.8V17a3 3 0 003 3h1" />
      <path d="M15 3a3 3 0 013 3v1a3 3 0 012 2.8V13a3 3 0 01-2 2.8V17a3 3 0 01-3 3h-1" />
      <path d="M12 3v17" />
    </svg>
  );
}

// Kartu hasil / evaluasi: judul + nilai besar + daftar kriteria berikon
function KartuHasil({ data }: { data: any }) {
  const angka = (v: any): number | null => {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(",", "."));
      return isFinite(n) ? n : null;
    }
    return null;
  };
  const fmt = (n: number) => String(n).replace(".", ",");
  const warna = (n: number, m: number) => {
    const r = n / (m || 10);
    return r >= 0.8 ? "#34d399" : r >= 0.6 ? "#fbbf24" : "#f87171";
  };
  const judul = typeof data?.judul === "string" ? data.judul : "Hasil";
  const maks = angka(data?.maks) ?? 10;
  const nilai = angka(data?.nilai);
  const kriteria: any[] = Array.isArray(data?.kriteria) ? data.kriteria.slice(0, 8) : [];
  const ringkasan = typeof data?.ringkasan === "string" ? data.ringkasan : "";
  return (
    <div className="kartu-hasil">
      <div className="kartu-head">
        <span>{judul}</span>
        {nilai !== null && <span style={{ color: warna(nilai, maks) }}>{fmt(nilai)}/{fmt(maks)}</span>}
      </div>
      {kriteria.map((k, i) => {
        const kn = angka(k?.nilai);
        const km = angka(k?.maks) ?? 10;
        return (
          <div key={i} className="kartu-item">
            <span className="kartu-item-ikon"><IkonKartu nama={k?.ikon} /></span>
            <div>
              <div className="kartu-item-judul">{String(k?.nama ?? "")}{kn !== null ? `: ${fmt(kn)}/${fmt(km)}` : ""}</div>
              {k?.teks && <div className="kartu-item-teks">{String(k.teks)}</div>}
            </div>
          </div>
        );
      })}
      {ringkasan && <div className="kartu-ringkasan">{ringkasan}</div>}
    </div>
  );
}

// ---- Kartu gambar AI: klik "Buat gambar" supaya jatah gratis tidak terbuang ----
const cacheGambar = new Map<string, string>();

function KartuGambar({ prompt }: { prompt: string }) {
  const [src, setSrc] = useState<string>(cacheGambar.get(prompt) || "");
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState("");

  const buat = async () => {
    if (proses) return;
    setProses(true);
    setGalat("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "gambar", pesan: prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data?.image) {
        setGalat(data?.error || "Gambar gagal dibuat. Coba lagi ya.");
      } else {
        const url = `data:image/jpeg;base64,${data.image}`;
        cacheGambar.set(prompt, url);
        setSrc(url);
      }
    } catch {
      setGalat("Gambar gagal dibuat. Cek koneksi lalu coba lagi.");
    } finally {
      setProses(false);
    }
  };

  const tombol: CSSProperties = {
    background: "linear-gradient(135deg, #ff7a18, #ff9d4d)",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: proses ? "not-allowed" : "pointer",
    opacity: proses ? 0.6 : 1,
    textDecoration: "none",
    display: "inline-block",
  };

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 14, background: "#101010", margin: "12px 0", padding: 12, maxWidth: 420 }}>
      {src ? (
        <>
          <img src={src} alt={prompt} style={{ width: "100%", borderRadius: 10, display: "block" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <a href={src} download="gambar-my-ai.jpg" style={tombol}>Simpan</a>
            <button onClick={buat} disabled={proses} style={{ ...tombol, background: "#1f1f1f", color: "#ff9d4d", border: "1px solid #333" }}>
              {proses ? "Membuat..." : "Buat ulang"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5, marginBottom: 10, wordBreak: "break-word" }}>{prompt}</div>
          <button onClick={buat} disabled={proses} style={tombol}>
            {proses ? "Membuat gambar..." : "Buat gambar"}
          </button>
        </>
      )}
      {galat && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{galat}</div>}
    </div>
  );
}

// ---- Kartu animasi: HTML/SVG dari AI dijalankan di kotak terkunci (sandbox), tanpa internet ----
function KartuAnimasi({ kode }: { kode: string }) {
  const [jalan, setJalan] = useState(false);
  const [putaran, setPutaran] = useState(0);

  const dokumen =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:;">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>html,body{margin:0;background:#0d0d0d;color:#f5f5f5;font-family:system-ui,sans-serif}</style>` +
    `</head><body>${kode}</body></html>`;

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(kode);
    } catch {
      alert("Tidak bisa menyalin otomatis. Tahan dan salin manual ya.");
    }
  };

  const tombol: CSSProperties = {
    background: "linear-gradient(135deg, #ff7a18, #ff9d4d)",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };
  const tombolKedua: CSSProperties = { ...tombol, background: "#1f1f1f", color: "#ff9d4d", border: "1px solid #333" };

  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: 14, background: "#101010", margin: "12px 0", padding: 12, maxWidth: 520 }}>
      {jalan ? (
        <iframe
          key={putaran}
          title="Animasi"
          sandbox="allow-scripts"
          srcDoc={dokumen}
          style={{ width: "100%", height: 340, border: "none", borderRadius: 10, background: "#0d0d0d", display: "block" }}
        />
      ) : (
        <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5, marginBottom: 4 }}>
          Animasi siap. Klik Putar untuk menjalankannya.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {!jalan ? (
          <button onClick={() => setJalan(true)} style={tombol}>Putar animasi</button>
        ) : (
          <>
            <button onClick={() => setPutaran((n) => n + 1)} style={tombol}>Ulangi</button>
            <button onClick={() => setJalan(false)} style={tombolKedua}>Berhenti</button>
          </>
        )}
        <button onClick={salin} style={tombolKedua}>Salin kode</button>
      </div>
    </div>
  );
}

const komponenMarkdown: any = {
  pre: ({ children }: any) => <>{children}</>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  code: ({ className, children }: any) => {
    const teks = String(children ?? "").replace(/\n$/, "");
    const bahasa = /language-([\w-]+)/.exec(className || "")?.[1];
    if (!bahasa && !teks.includes("\n")) return <code>{children}</code>;
    if (bahasa === "animasi") {
      return <KartuAnimasi kode={teks} />;
    }
    if (bahasa === "gambar") {
      try {
        const d = JSON.parse(teks);
        if (typeof d?.prompt === "string" && d.prompt.trim()) {
          return <KartuGambar prompt={d.prompt.trim().slice(0, 500)} />;
        }
      } catch {
        // JSON belum valid: tampilkan sebagai blok kode biasa
      }
    }
    if (bahasa === "kartu" || bahasa === "grafik") {
      try {
        const data = JSON.parse(teks);
        if (bahasa === "kartu") return <KartuHasil data={data} />;
        const grafik = bacaGrafik(data);
        if (grafik) return <GrafikTradingView simbol={grafik.simbol} interval={grafik.interval} />;
      } catch {
        // JSON belum valid: tampilkan sebagai blok kode biasa
      }
    }
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
function IconStop() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#0a0a0a">
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
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
function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
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
function IconIncognito() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11h18" />
      <path d="M5 11l1.5-6h11L19 11" />
      <circle cx="8" cy="16.5" r="2.5" />
      <circle cx="16" cy="16.5" r="2.5" />
      <path d="M10.5 16h3" />
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.9l7.6-4.3M8.2 13.1l7.6 4.3" />
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
