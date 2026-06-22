'use client';

import { useState, useEffect } from 'react';

// Deklarasi global agar TypeScript di Vercel tidak error saat membaca Puter.js
declare global {
  interface Window {
    puter: any;
  }
}

type Message = {
  role: 'user' | 'ai';
  text: string;
};

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message>();
  const [isLoading, setIsLoading] = useState(false);
  const [isPuterLoaded, setIsPuterLoaded] = useState(false);

  // Memuat pustaka Puter.js secara dinamis saat halaman dibuka
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.onload = () => {
      setIsPuterLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Membersihkan script saat komponen tidak digunakan
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  },);

  const handleKirim = async () => {
    if (!input.trim() || isLoading) return;
    
    // Pastikan Puter.js sudah siap sebelum mengirim pesan
    if (!isPuterLoaded ||!window.puter) {
      setMessages((prev) =>);
      return;
    }

    const pesanUser = input;
    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }]);
    setInput('');
    setIsLoading(true);

    try {
      // Memanggil kecerdasan buatan Puter.js secara langsung tanpa API Key
      const response = await window.puter.ai.chat(pesanUser);
      const jawabanAI = typeof response === 'string'? response : (response.message?.content || 'Maaf, aku tidak menerima respons.');
      
      setMessages((prev) => [...prev, { role: 'ai', text: jawabanAI }]);
    } catch (error) {
      setMessages((prev) =>);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: '20px', maxWidth: '700px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#0070f3' }}>🤖 My AI Website (Pro)</h2>
      
      {/* Ruang Obrolan */}
      <div style={{ height: '450px', overflowY: 'auto', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.role === 'user'? 'right' : 'left', margin: '10px 0' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>
              {msg.role === 'user'? 'Kamu' : 'My AI'}
            </div>
            <span style={{ 
              display: 'inline-block', 
              padding: '10px 14px', 
              borderRadius: '12px', 
              backgroundColor: msg.role === 'user'? '#0070f3' : '#e4e6eb', 
              color: msg.role === 'user'? 'white' : 'black', 
              maxWidth: '85%', 
              textAlign: 'left',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.text}
            </span>
          </div>
        ))}
        {isLoading && <p style={{ color: '#888', fontStyle: 'italic', fontSize: '14px' }}>My AI sedang berpikir keras...</p>}
      </div>

      {/* Kolom Input & Tombol */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleKirim()}
          placeholder={isPuterLoaded? "Tanya apa saja ke My AI..." : "Sedang memuat AI..."}
          disabled={!isPuterLoaded}
          style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ccc', color: 'black', fontSize: '16px' }}
        />
        <button 
          onClick={handleKirim}
          disabled={isLoading ||!isPuterLoaded}
          style={{ padding: '12px 24px', borderRadius: '6px', backgroundColor: '#0070f3', color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          Kirim
        </button>
      </div>
    </main>
  );
}
