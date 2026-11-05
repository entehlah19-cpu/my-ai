// Meminta AI membuat judul singkat untuk obrolan baru.
// Memakai jalur "ingat" di /api/chat (jatah latar belakang), jadi tidak memakai jatah chat biasa.

function bersihkanJudul(mentah: string): string {
  const baris = (mentah || "").split("\n")[0] || "";
  const bersih = baris
    .replace(/^["'“”‘’`*#\s]+|["'“”‘’`*\s.!?,;:]+$/g, "")
    .replace(/^judul\s*[:\-]\s*/i, "")
    .trim()
    .slice(0, 40);
  return bersih.length >= 3 ? bersih : "";
}

export async function ambilJudulAI(pesan: string, jawaban: string): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aksi: "ingat",
        mode: "judul",
        pesan: (pesan || "").slice(0, 600),
        jawaban: (jawaban || "").slice(0, 600),
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return bersihkanJudul(typeof data?.judul === "string" ? data.judul : "");
  } catch {
    return "";
  }
}
