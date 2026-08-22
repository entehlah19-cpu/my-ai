import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const geminiContents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

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
