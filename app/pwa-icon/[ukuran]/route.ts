import { IKON } from "../ikon-data";

// Menyajikan ikon aplikasi: /pwa-icon/180, /pwa-icon/192, atau /pwa-icon/512
export async function GET(_req: Request, ctx: { params: Promise<{ ukuran: string }> }) {
  const { ukuran } = await ctx.params;
  const b64 = IKON[ukuran];
  if (!b64) return new Response("Ikon tidak ditemukan", { status: 404 });

  const bytes = Buffer.from(b64, "base64");
  const isi = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(isi, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
