'use client';

import { useState } from 'react';

// Mendefinisikan tipe data pesan agar TypeScript di Vercel tidak eror
interface Message {
  role: 'user' | 'ai';
  text: string;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message>();
  const [isLoading, setIsLoading] = useState(false);

  const handleKirim = async () => {
    if (!input.trim() || isLoading) return;

    const pesanUser = input;
    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }]);
    setInput('');
    setIsLoading(true);

    try {
      // Memanggil AI gratis Pollinations (tanpa API key, aman dari CORS)
      const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: pesanUser }
          ],
          model: 'openai'
        })
      });

      if (!response.ok) {
        throw new Error('Gagal menghubungi AI');
      }

      const jawabanAI = await response.text();
      setMessages((prev) => [...prev, { role: 'ai', text: jawabanAI }]);
    } catch (error) {
      setMessages((prev) => [
       ...prev,
        { role: 'ai', text: 'Maaf, koneksi ke My AI terputus. Coba kirim pesan lagi ya!' }
      ]);
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
            Halo! Aku My AI. Aku sekarang sudah di-upgrade menjadi sangat pintar dan bisa menjawab apa saja secara gratis tanpa API Key. Ada yang bisa kubantu?
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
