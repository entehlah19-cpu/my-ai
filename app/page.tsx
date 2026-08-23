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

const colors = {
  bg: '#17130F',
  panel: '#201A15',
  panelRaised: '#2A2219',
  border: '#382E22',
  accent: '#E3A857',
  accentSoft: '#4A3B22',
  ink: '#F3ECDD',
  inkMuted: '#9C8F7C',
  userBubble: '#2C3B37',
};

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
    <div
      className="myai-layout"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: colors.bg,
        color: colors.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
      }}
    >
      <style>{`
        @keyframes myai-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .myai-pulse-dot {
          animation: myai-pulse 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .myai-pulse-dot { animation: none; }
        }
        @media (max-width: 640px) {
          .myai-layout { flex-direction: column !important; }
          .myai-sidebar { width: 100% !important; border-right: none !important; border-bottom: 1px solid ${colors.border} !important; }
        }
      `}</style>

      <div
        className="myai-sidebar"
        style={{
          width: 220,
          flexShrink: 0,
          background: colors.panel,
          borderRight: `1px solid ${colors.border}`,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="myai-pulse-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: colors.accent,
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>My AI</span>
        </div>

        <button
          onClick={newConversation}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            background: colors.panelRaised,
            color: colors.ink,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'left',
          }}
        >
          + Obrolan Baru
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setCurrentId(c.id)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                background: c.id === currentId ? colors.accentSoft : 'transparent',
                color: c.id === currentId ? colors.ink : colors.inkMuted,
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
                style={{ marginLeft: 6, opacity: 0.5, fontSize: 12 }}
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          padding: '24px 20px',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: colors.inkMuted,
              fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
            }}
          >
            Obrolan
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{current?.title ?? 'My AI'}</div>
        </div>

        <div
          style={{
            flex: 1,
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            padding: 16,
            minHeight: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                background: m.role === 'user' ? colors.userBubble : colors.panelRaised,
                borderLeft: m.role === 'ai' ? `3px solid ${colors.accent}` : 'none',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 11, color: colors.inkMuted, marginBottom: 2, fontWeight: 600 }}>
                {m.role === 'user' ? 'Kamu' : 'My AI'}
              </div>
              {m.role === 'ai' ? <Markdown>{m.text}</Markdown> : m.text}
              {m.attachment?.kind === 'inline' && m.attachment.mimeType.startsWith('image/') && (
                <div>
                  <img
                    src={`data:${m.attachment.mimeType};base64,${m.attachment.data}`}
                    alt="gambar terkirim"
                    style={{ maxWidth: 200, borderRadius: 8, marginTop: 6 }}
                  />
                </div>
              )}
              {m.attachment?.kind === 'inline' && !m.attachment.mimeType.startsWith('image/') && (
                <div style={{ fontSize: 12, color: colors.inkMuted, marginTop: 6 }}>📄 {m.attachment.name}</div>
              )}
              {m.attachment?.kind === 'text' && (
                <div style={{ fontSize: 12, color: colors.inkMuted, marginTop: 6 }}>📄 {m.attachment.name}</div>
              )}
            </div>
          ))}
          {isLoading && (
            <div
              style={{
                alignSelf: 'flex-start',
                color: colors.inkMuted,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                className="myai-pulse-dot"
                style={{ width: 6, height: 6, borderRadius: '50%', background: colors.accent, display: 'inline-block' }}
              />
              My AI sedang mengetik...
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          {pendingAttachment && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {pendingAttachment.previewUrl ? (
                <img src={pendingAttachment.previewUrl} alt="preview" style={{ height: 44, borderRadius: 6 }} />
              ) : (
                <span style={{ fontSize: 13, color: colors.inkMuted }}>📄 {pendingAttachment.name}</span>
              )}
              <button
                onClick={() => setPendingAttachment(null)}
                style={{ fontSize: 12, background: 'transparent', border: 'none', color: colors.inkMuted, cursor: 'pointer' }}
              >
                Hapus
              </button>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              background: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 6,
            }}
          >
            <input
              type="file"
              accept="image/*,application/pdf,.pdf,.txt,.md,.csv,.json,text/plain,text/csv,text/markdown,application/json"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.inkMuted,
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              📎
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: colors.ink,
                fontSize: 14,
                padding: 8,
              }}
              placeholder="Ketik pesan..."
            />
            <button
              onClick={sendMessage}
              disabled={isLoading}
              style={{
                background: colors.accent,
                color: '#211A10',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 14,
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              Kirim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
