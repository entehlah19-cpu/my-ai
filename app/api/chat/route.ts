import { NextRequest, NextResponse } from 'next/server';

type IncomingMessage = {
  role: string;
  text: string;
  image?: { data: string; mimeType: string };
};

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const geminiContents = messages.map((m: IncomingMessage) => {
      const parts: Record<string, unknown>[] = [];
      if (m.text) parts.push({ text: m.text });
      if (m.image) {
        parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.data } });
      }
      return {
        role: m.role === 'ai' ? 'model' : 'user',
        parts,
      };
    });

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        },
        body: JSON.stringify({ contents: geminiContents }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ reply: `Error dari Gemini: ${data?.error?.message ?? JSON.stringify(data)}` });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Maaf, tidak ada balasan.';
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ reply: `Server error: ${String(err)}` });
  }
}
