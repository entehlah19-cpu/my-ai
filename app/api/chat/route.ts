import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pesanUser } = await request.json();
    
    // Kunci API asli kamu dari Google AI Studio (Format resmi AQ tanpa tambahan teks)
    const GEMINI_API_KEY = 'AQ.Ab8RN6KIRamsKBkOOs1Sv9VKd2CvW5tNKOssmtwE00MxDe1';

    // Memanggil model gemini-2.5-flash yang kompatibel di sisi server
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: pesanUser }] }]
        })
      }
    );

    const data = await response.json();

    // Tampilkan pesan kesalahan jika terjadi masalah otentikasi Google
    if (data.error) {
      return NextResponse.json({ text: `Eror dari Google: ${data.error.message}` }, { status: 400 });
    }

    if (data.candidates && data.candidates.content && data.candidates.content.parts.text) {
      const jawabanAI = data.candidates.content.parts.text;
      return NextResponse.json({ text: jawabanAI });
    }

    return NextResponse.json({ text: 'Maaf, My AI tidak menerima respons balik dari Google.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ text: 'Terjadi kegagalan koneksi internal pada sistem.' }, { status: 500 });
  }
}
