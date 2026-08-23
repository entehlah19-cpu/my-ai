'use client';

import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';

type Attachment =
  | { kind: 'inline'; name: string; data: string; mimeType: string }
  | { kind: 'text'; name: string; content: string };

type Message = {
  role: 'user' | 'ai';
  text: string;
  attachment?: Attachment;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

const STORAGE_KEY = 'my-ai-conversations';
const TEXT_EXT_RE = /\.(txt|md|csv|json)$/i;

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
  const [pendingAttachment, setPendingAttachment] = useState<
    (Attachment & { previewUrl?: string }) | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            ? newMessages[1].text.slice(0, 30) || 'File'
            : c.title;
        return { ...c, messages: newMessages, title };
      })
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file maksimal 8MB ya.');
      return;
    }

    const isTextFile =
      file.type.startsWith('text/') ||
      file.type === 'application/json' ||
      TEXT_EXT_RE.test(file.name);

    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingAttachment({ kind: 'text', name: file.name, content: reader.result as string });
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setPendingAttachment({
          kind: 'inline',
          name: file.name,
          data: base64Data,
          mimeType: file.type || 'application/octet-stream',
          previewUrl: file.type.startsWith('image/') ? result : undefined,
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }

  async function sendMessage() {
    if (!input.trim() && !pendingAttachment) return;
    let attachment: Attachment | undefined;
    if (pendingAttachment) {
      attachment =
        pendingAttachment.kind === 'inline'
          ? { kind: 'inline', name: pendingAttachment.name, data: pendingAttachment.data, mimeType: pendingAttachment.mimeType }
          : { kind: 'text', name: pendingAttachment.name, content: pendingAttachment.content };
    }
    const newUserMessage: Message = { role: 'user', text: input, ...(attachment ? { attachment } : {}) };
    const newMessages: Message[] = [...messages, newUserMessage];
    updateMessages(newMessages);
    setInput('');
    setPendingAttachment(null);
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
              <b>{m.role === 'user' ? 'Kamu' : 'AI'}:</b>{' '}
              {m.role === 'ai' ? <Markdown>{m.text}</Markdown> : m.text}
              {m.attachment?.kind === 'inline' && m.attachment.mimeType.startsWith('image/') && (
                <div>
                  <img
                    src={`data:${m.attachment.mimeType};base64,${m.attachment.data}`}
                    alt="gambar terkirim"
                    style={{ maxWidth: 200, borderRadius: 8, marginTop: 4 }}
                  />
                </div>
              )}
              {m.attachment?.kind === 'inline' && !m.attachment.mimeType.startsWith('image/') && (
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>📄 {m.attachment.name}</div>
              )}
              {m.attachment?.kind === 'text' && (
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>📄 {m.attachment.name}</div>
              )}
            </div>
          ))}
          {isLoading && <div>AI sedang mengetik...</div>}
        </div>

        <div style={{ marginTop: 12 }}>
          {pendingAttachment && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {pendingAttachment.previewUrl ? (
                <img src={pendingAttachment.previewUrl} alt="preview" style={{ height: 50, borderRadius: 6 }} />
              ) : (
                <span style={{ fontSize: 13 }}>📄 {pendingAttachment.name}</span>
              )}
              <button onClick={() => setPendingAttachment(null)} style={{ fontSize: 12 }}>Hapus</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="file"
              accept="image/*,application/pdf,.pdf,.txt,.md,.csv,.json,text/plain,text/csv,text/markdown,application/json"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 12px' }}>
              📎
            </button>
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
    </div>
  );
}
