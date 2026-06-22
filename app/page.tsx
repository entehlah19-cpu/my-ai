'use client';

import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }>();
  const [isLoading, setIsLoading] = useState(false);

  const handleKirim = async () => {
    if (!input.trim() || isLoading) return;

    const pesanUser = input;
    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }]);
    setInput('');
    setIsLoading(true);

    try {
      // Memanggil API internal Next.js secara aman di sisi server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesanUser })
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'ai', text: data.text }]);
    } catch (error) {
      // Memperbaiki error sintaksis yang membuat build Vercel gagal kemarin
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
        <div style={{ textAlign: 'left', margin: '10px 0' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>My AI</div>
          <span style={{ display: 'inline-block', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#e4e6eb', color: 'black', maxWidth: '85%', textAlign: 'left' }}>
            Halo! Aku My AI. Sekarang aku sudah di-upgrade menjadi sangat pintar seperti Claude AI. Ada yang bisa aku bantu hari ini?
          </span>
        </div>

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
          placeholder="Tanya apa saja ke My AI..." 
          style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ccc', color: 'black', fontSize: '16px' }}
        />
        <button 
          onClick={handleKirim}
          disabled={isLoading}
          style={{ padding: '12px 24px', borderRadius: '6px', backgroundColor: '#0070f3', color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
        >
          Kirim
        </button>
      </div>
    </main>
  );
}
