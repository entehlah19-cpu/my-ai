'use client';

import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Halo! Aku My AI. Ada yang bisa aku bantu hari ini?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleKirim = () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.toLowerCase();
    
    setMessages((prev) => [...prev, { role: 'user', text: input }]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      let jawabanAI = 'Maaf, My AI masih dalam mode belajar. Coba tanya yang lain!';

      if (userMessage.includes('halo') || userMessage.includes('hai')) {
        jawabanAI = 'Halo juga! Senang mengobrol denganmu. Aku My AI!';
      } else if (userMessage.includes('siapa namamu') || userMessage.includes('nama')) {
        jawabanAI = 'Namaku My AI, asisten pribadimu!';
      } else if (userMessage.includes('kabar') || userMessage.includes('apa kabar')) {
        jawabanAI = 'Aku luar biasa! Bagaimana dengan kabarmu hari ini?';
      } else if (userMessage.includes('terima kasih') || userMessage.includes('thanks')) {
        jawabanAI = 'Sama-sama! My AI selalu siap membantu.';
      }

      setMessages((prev) => [...prev, { role: 'ai', text: jawabanAI }]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <main style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#0070f3' }}>🤖 My AI Website</h2>
      
      {/* Ruang Obrolan */}
      <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>
              {msg.role === 'user' ? 'Kamu' : 'My AI'}
            </div>
            <span style={{ display: 'inline-block', padding: '10px 14px', borderRadius: '12px', backgroundColor: msg.role === 'user' ? '#0070f3' : '#e4e6eb', color: msg.role === 'user' ? 'white' : 'black', maxWidth: '75%', textAlign: 'left' }}>
              {msg.text}
            </span>
          </div>
        ))}
        {isLoading && <p style={{ color: '#888', fontStyle: 'italic', fontSize: '14px' }}>My AI sedang mengetik...</p>}
      </div>

      {/* Kolom Input & Tombol */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleKirim()}
          placeholder="ketik pesan di sini..." 
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
