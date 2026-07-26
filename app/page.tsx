'use client';

import { useState } from 'react';

type Message = {
  role: 'user' | 'ai';
  text: string;
};

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Halo! Aku My AI. Ada yang bisa dibantu?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const newMessages: Message[] = [...messages, { role: 'user', text: input }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'ai', text: data.reply }]);
    } catch {
      setMessages([...newMessages, { role: 'ai', text: 'Terjadi kesalahan, coba lagi.' }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1>My AI</h1>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <b>{m.role === 'user' ? 'Kamu' : 'AI'}:</b> {m.text}
          </div>
        ))}
        {isLoading && <div>AI sedang mengetik...</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, padding: 8 }}
          placeholder="Ketik pesan..."
        />
        <button onClick={sendMessage} disabled={isLoading}>Kirim</button>
      </div>
    </div>
  );
}
