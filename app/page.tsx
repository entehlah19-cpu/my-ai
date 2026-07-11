import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const anthropicMessages = messages.map((m: { role: string; text: string }) => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.text,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: anthropicMessages,
    }),
  });

  const data = await response.json();
  const reply = data?.content?.[0]?.text ?? 'Maaf, terjadi kesalahan.';

  return NextResponse.json({ reply });
}export type Message = {
  role: 'user' | 'ai';
  text: string;
};