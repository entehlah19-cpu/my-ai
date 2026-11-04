// Ekspor obrolan: TXT, PDF, Word (.docx), dan ZIP berisi semua file kode.
// Semuanya dibuat di browser kamu, tanpa paket tambahan dan tanpa server.

type Pesan = { role: string; content: string };

const EKSTENSI: Record<string, string> = {
  typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js", jsx: "jsx", python: "py", py: "py",
  html: "html", css: "css", json: "json", markdown: "md", md: "md", bash: "sh", sh: "sh", shell: "sh",
  java: "java", c: "c", cpp: "cpp", csharp: "cs", cs: "cs", go: "go", rust: "rs", rs: "rs", php: "php",
  sql: "sql", yaml: "yml", yml: "yml", svg: "svg", kotlin: "kt", swift: "swift", ruby: "rb", dart: "dart", lua: "lua",
};

function namaAman(s: string, cadangan = "obrolan"): string {
  const bersih = (s || "").replace(/[^\w.\- ]+/g, "_").trim().slice(0, 60);
  return bersih || cadangan;
}

function unduhBlob(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function peran(p: Pesan): string {
  return p.role === "user" ? "Kamu" : "My AI";
}

// Memecah teks menjadi bagian biasa dan bagian kode (blok dengan tiga tanda kutip terbalik)
type Bagian = { kode: boolean; bahasa: string; teks: string };
function pecahBagian(teks: string): Bagian[] {
  const hasil: Bagian[] = [];
  const re = /```([^\n]*)\n([\s\S]*?)(?:```|$)/g;
  let akhir = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(teks)) !== null) {
    if (m.index > akhir) hasil.push({ kode: false, bahasa: "", teks: teks.slice(akhir, m.index) });
    hasil.push({ kode: true, bahasa: (m[1] || "").trim(), teks: m[2].replace(/\n$/, "") });
    akhir = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (akhir < teks.length) hasil.push({ kode: false, bahasa: "", teks: teks.slice(akhir) });
  return hasil;
}

// ---------- TXT ----------
function eksporTxt(judul: string, pesan: Pesan[]) {
  const isi = pesan.map((m) => `${peran(m)}: ${m.content}`).join("\n\n");
  unduhBlob(new Blob([isi], { type: "text/plain;charset=utf-8" }), `${namaAman(judul)}.txt`);
}

// ---------- PDF (lewat jendela cetak, pilih "Simpan sebagai PDF") ----------
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function teksKeHtml(teks: string): string {
  return escHtml(teks)
    .replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function eksporPdf(judul: string, pesan: Pesan[]) {
  const badan = pesan
    .map((m) => {
      const isi = pecahBagian(m.content)
        .map((b) => (b.kode ? `<pre>${escHtml(b.teks)}</pre>` : `<div class="t">${teksKeHtml(b.teks.trim())}</div>`))
        .join("");
      return `<div class="p ${m.role === "user" ? "u" : "a"}"><div class="n">${peran(m)}</div>${isi}</div>`;
    })
    .join("");
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(judul)}</title><style>` +
    `body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#111;margin:24px;line-height:1.55;font-size:14px}` +
    `h1{font-size:20px;margin:0 0 16px}.p{margin:0 0 16px;page-break-inside:auto}.n{font-weight:700;color:#d9540b;margin-bottom:4px}` +
    `.u .n{color:#444}.t{white-space:pre-wrap;word-break:break-word}` +
    `pre{background:#f3f3f3;border:1px solid #ddd;border-radius:6px;padding:10px;white-space:pre-wrap;word-break:break-word;font-size:12px;font-family:Consolas,Menlo,monospace}` +
    `code{background:#f3f3f3;padding:1px 4px;border-radius:3px;font-family:Consolas,Menlo,monospace;font-size:12.5px}` +
    `</style></head><body><h1>${escHtml(judul)}</h1>${badan}</body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    alert("Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}

// ---------- ZIP (tanpa kompresi, cukup untuk file teks) ----------
const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABEL_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buatZip(berkas: { nama: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const kini = new Date();
  const jam = (kini.getHours() << 11) | (kini.getMinutes() << 5) | (kini.getSeconds() >> 1);
  const tgl = ((kini.getFullYear() - 1980) << 9) | ((kini.getMonth() + 1) << 5) | kini.getDate();

  const bagian: Uint8Array[] = [];
  const pusat: Uint8Array[] = [];
  let offset = 0;

  for (const b of berkas) {
    const nama = enc.encode(b.nama);
    const crc = crc32(b.data);

    const lokal = new Uint8Array(30 + nama.length);
    const dl = new DataView(lokal.buffer);
    dl.setUint32(0, 0x04034b50, true);
    dl.setUint16(4, 20, true);
    dl.setUint16(6, 0x0800, true); // nama file UTF-8
    dl.setUint16(8, 0, true); // tanpa kompresi
    dl.setUint16(10, jam, true);
    dl.setUint16(12, tgl, true);
    dl.setUint32(14, crc, true);
    dl.setUint32(18, b.data.length, true);
    dl.setUint32(22, b.data.length, true);
    dl.setUint16(26, nama.length, true);
    dl.setUint16(28, 0, true);
    lokal.set(nama, 30);

    const entri = new Uint8Array(46 + nama.length);
    const de = new DataView(entri.buffer);
    de.setUint32(0, 0x02014b50, true);
    de.setUint16(4, 20, true);
    de.setUint16(6, 20, true);
    de.setUint16(8, 0x0800, true);
    de.setUint16(10, 0, true);
    de.setUint16(12, jam, true);
    de.setUint16(14, tgl, true);
    de.setUint32(16, crc, true);
    de.setUint32(20, b.data.length, true);
    de.setUint32(24, b.data.length, true);
    de.setUint16(28, nama.length, true);
    de.setUint32(42, offset, true);
    entri.set(nama, 46);

    bagian.push(lokal, b.data);
    pusat.push(entri);
    offset += lokal.length + b.data.length;
  }

  const ukuranPusat = pusat.reduce((s, e) => s + e.length, 0);
  const akhir = new Uint8Array(22);
  const da = new DataView(akhir.buffer);
  da.setUint32(0, 0x06054b50, true);
  da.setUint16(8, berkas.length, true);
  da.setUint16(10, berkas.length, true);
  da.setUint32(12, ukuranPusat, true);
  da.setUint32(16, offset, true);

  const semua = [...bagian, ...pusat, akhir];
  return new Blob(semua as unknown as BlobPart[], { type: "application/zip" });
}

// ---------- ZIP kode: semua blok kode di obrolan ----------
function namaDariMeta(meta: string): string {
  const kata = (meta || "").trim().split(/\s+/)[0] || "";
  const bersih = kata.replace(/^title=/, "").replace(/^["']|["']$/g, "");
  return /[./]/.test(bersih) && !/^\s*$/.test(bersih) ? bersih : "";
}

function amanPath(p: string): string {
  return p
    .split(/[\\/]+/)
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => s.replace(/[^\w.\- ]+/g, "_"))
    .join("/");
}

function eksporZipKode(judul: string, pesan: Pesan[]) {
  const enc = new TextEncoder();
  const berkas: { nama: string; data: Uint8Array }[] = [];
  const dipakai = new Set<string>();
  let nomor = 0;

  for (const m of pesan) {
    if (m.role === "user") continue;
    const re = /```([^\n]*)\n([\s\S]*?)(?:```|$)/g;
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(m.content)) !== null) {
      if (hit[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      const kepala = (hit[1] || "").trim();
      const bahasa = (kepala.split(/\s+/)[0] || "").toLowerCase();
      // Blok khusus tampilan (kartu, kuis, gambar, dan seterusnya) bukan file kode
      if (["kartu", "grafik", "gambar", "foto", "kuis", "animasi"].includes(bahasa)) continue;
      const isi = hit[2].replace(/\n$/, "");
      if (!isi.trim()) continue;
      nomor += 1;
      const meta = kepala.slice(bahasa.length).trim();
      let nama = amanPath(namaDariMeta(meta));
      if (!nama) nama = `kode-${nomor}.${EKSTENSI[bahasa] || "txt"}`;
      let unik = nama;
      let n = 2;
      while (dipakai.has(unik)) {
        const titik = nama.lastIndexOf(".");
        unik = titik > 0 ? `${nama.slice(0, titik)}-${n}${nama.slice(titik)}` : `${nama}-${n}`;
        n += 1;
      }
      dipakai.add(unik);
      berkas.push({ nama: unik, data: enc.encode(isi) });
    }
  }

  if (berkas.length === 0) {
    alert("Tidak ada file kode di obrolan ini.");
    return;
  }
  unduhBlob(buatZip(berkas), `${namaAman(judul, "kode")}-kode.zip`);
}

// ---------- Word (.docx asli, dibuat dari ZIP + XML) ----------
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function para(teks: string, opsi: { tebal?: boolean; kode?: boolean; warna?: string; besar?: number } = {}): string {
  const rpr =
    (opsi.kode ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>' : "") +
    (opsi.tebal ? "<w:b/>" : "") +
    (opsi.warna ? `<w:color w:val="${opsi.warna}"/>` : "") +
    (opsi.kode ? '<w:sz w:val="19"/>' : opsi.besar ? `<w:sz w:val="${opsi.besar}"/>` : "");
  return `<w:p><w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(teks)}</w:t></w:r></w:p>`;
}

function eksporWord(judul: string, pesan: Pesan[]) {
  const enc = new TextEncoder();
  let badan = para(judul, { tebal: true, besar: 36 });
  for (const m of pesan) {
    badan += para(peran(m), { tebal: true, warna: m.role === "user" ? "444444" : "D9540B" });
    for (const b of pecahBagian(m.content)) {
      if (b.kode) {
        for (const baris of b.teks.split("\n")) badan += para(baris, { kode: true });
      } else {
        for (const baris of b.teks.trim().split("\n")) {
          const bersih = baris.replace(/^#{1,6}\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1");
          badan += para(bersih);
        }
      }
    }
    badan += para("");
  }

  const dokumen =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    badan +
    "<w:sectPr/></w:body></w:document>";
  const tipe =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const zip = buatZip([
    { nama: "[Content_Types].xml", data: enc.encode(tipe) },
    { nama: "_rels/.rels", data: enc.encode(rels) },
    { nama: "word/document.xml", data: enc.encode(dokumen) },
  ]);
  const docx = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  unduhBlob(docx, `${namaAman(judul)}.docx`);
}

// ---------- Menu pilihan ekspor (dibuat langsung di halaman, tanpa mengubah tampilan React) ----------
export function menuEkspor(judul: string, pesan: Pesan[]) {
  if (typeof document === "undefined") return;
  if (!pesan || pesan.length === 0) {
    alert("Belum ada isi obrolan untuk diekspor.");
    return;
  }
  const lama = document.getElementById("myai-menu-ekspor");
  if (lama) lama.remove();

  const lapis = document.createElement("div");
  lapis.id = "myai-menu-ekspor";
  lapis.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,sans-serif";
  const kotak = document.createElement("div");
  kotak.style.cssText = "background:#161616;color:#f5f5f5;border-radius:18px;padding:18px;width:100%;max-width:340px";
  const judulMenu = document.createElement("div");
  judulMenu.textContent = "Ekspor obrolan";
  judulMenu.style.cssText = "font-weight:700;font-size:17px;text-align:center;margin-bottom:12px";
  kotak.appendChild(judulMenu);

  const tutup = () => lapis.remove();
  const tambah = (label: string, aksi: () => void, utama = false) => {
    const tombol = document.createElement("button");
    tombol.textContent = label;
    tombol.style.cssText =
      "display:block;width:100%;margin-top:8px;padding:12px 14px;border-radius:12px;border:none;font-size:15px;font-weight:600;cursor:pointer;text-align:left;" +
      (utama ? "background:linear-gradient(135deg,#ff7a18,#ff9d4d);color:#0a0a0a" : "background:#1f1f1f;color:#f5f5f5");
    tombol.onclick = () => {
      tutup();
      aksi();
    };
    kotak.appendChild(tombol);
  };

  tambah("PDF (lewat jendela cetak)", () => eksporPdf(judul, pesan), true);
  tambah("Word (.docx)", () => eksporWord(judul, pesan));
  tambah("ZIP semua file kode", () => eksporZipKode(judul, pesan));
  tambah("Teks biasa (.txt)", () => eksporTxt(judul, pesan));

  const batal = document.createElement("button");
  batal.textContent = "Batal";
  batal.style.cssText = "display:block;width:100%;margin-top:12px;background:none;border:none;color:#888;font-size:14px;cursor:pointer";
  batal.onclick = tutup;
  kotak.appendChild(batal);

  lapis.appendChild(kotak);
  lapis.onclick = (e) => {
    if (e.target === lapis) tutup();
  };
  document.body.appendChild(lapis);
}
