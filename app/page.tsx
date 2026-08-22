'use client';

import { useState, useEffect } from 'react';

type Message = {
  role: 'user' | 'ai';
  text: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

const STORAGE_KEY = 'my-ai-conversations';

function makeNewConversation(): Conversation {
  return {
    id: Date.now().toString(),
    title: 'Obrolan Baru',
    messages: [{ role: 'ai', text: 'Halo! Aku My AI. Ada yang bisa dibantu?' }],
  };
}

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.conversations) && parsed.conversations.length > 0) {
          setConversations(parsed.conversations);
          setCurrentId(parsed.currentId || parsed.conversations[0].id);
          setIsLoaded(true);
          return;
        }
      }
    } catch {}
    const fresh = makeNewConversation();
    setConversations([fresh]);
    setCurrentId(fresh.id);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, currentId }));
    } catch {}
  }, [conversations, currentId, isLoaded]);

  const current = conversations.find((c) => c.id === currentId);
  const messages = current ? current.messages : [];

  function updateMessages(newMessages: Message[]) {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== currentId) return c;
        const title =
          c.title === 'Obrolan Baru' && newMessages.length > 1
            ? newMessages[1].text.slice(0, 30)
            : c.title;
        return { ...c, messages: newMessages, title };
      })
    );
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const newMessages: Message[] = [...messages, { role: 'user', text: input }];
    updateMessages(newMessages);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      updateMessages([...newMessages, { role: 'ai', text: data.reply }]);
    } catch {
      updateMessages([...newMessages, { role: 'ai', text: 'Terjadi kesalahan, coba lagi.' }]);
    } finally {
      setIsLoading(false);
    }
  }

  function newConversation() {
    const fresh = makeNewConversation();
    setConversations((prev) => [fresh, ...prev]);
    setCurrentId(fresh.id);
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      if (rest.length === 0) {
        const fresh = makeNewConversation();
        setCurrentId(fresh.id);
        return [fresh];
      }
      if (id === currentId) setCurrentId(rest[0].id);
      return rest;
    });
  }

  return (
    <div style={{ display: 'flex', maxWidth: 900, margin: '0 auto', padding: 20, gap: 16 }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <button onClick={newConversation} style={{ width: '100%', padding: 8, marginBottom: 12 }}>
          + Obrolan Baru
        </button>
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => setCurrentId(c.id)}
            style={{
              padding: 8,
              marginBottom: 4,
              borderRadius: 6,
              cursor: 'pointer',
              background: c.id === currentId ? '#333' : 'transparent',
              color: c.id === currentId ? '#fff' : 'inherit',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.title}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(c.id);
              }}
              style={{ marginLeft: 6, opacity: 0.6 }}
            >
              ✕
            </span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
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
    </div>
  );
}
