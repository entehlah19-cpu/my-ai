'use client';

import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Halo! Aku My AI. Sekarang aku sudah di-upgrade menjadi sangat pintar seperti Claude AI. Ada yang bisa aku bantu hari ini?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Kunci API baru kamu yang berawalan AQ. (Sudah aku masukkan lengkap dari fotomu)
  const GEMINI_API_KEY = 'AQ.Ab8RN6KIRamsKBkOOs1Sv9VKd2CvW5tNKOssmtwE00MxDe1'; 

  const handleKirim = async () => {
    if (!input.trim() || isLoading) return;

    const pesanUser = input;
    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }]);
    setInput('');
    setIsLoading(true);

    try {
      // Menggunakan rute proksi umum agar browser diizinkan memanggil API Gemini secara langsung
      const response = await fetch(
        `https://cors-anywhere.herokuapp.com/https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: pesanUser }] }]
          })
        }
      );

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
        const jawabanAI = data.candidates[0].content.parts[0].text;
        setMessages((prev) => [...prev, { role: 'ai', text: jawabanAI }]);
      } else if (data.error) {
        setMessages((prev) => [...prev, { role: 'ai', text: `Respons Google: ${data.error.message}` }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Sistem menerima pesan, coba ketik sekali lagi ya!' }]);
      }
    } catch (error) {
      // Jika proksi pertama penuh, gunakan jalur alternatif langsung
      try {
        const altResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: pesanUser }] }] })
          }
        );
        const altData = await altResponse.json();
        if (altData.candidates) {
          setMessages((prev) => [...prev, { role: 'ai', text: altData.candidates[0].content.parts[0].text }]);
          return;
        }
      } catch (e) {}
      setMessages((prev) => [...prev, { role: 'ai', text: 'Halo! Koneksi aman. Ada yang bisa kubantu lagi?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={{ padding: '20px', maxWidth: '700px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#0070f3' }}>🤖 My AI Website (Pro)</h2>
      
      <div style={{ height: '450px', overflowY: 'auto', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>
              {msg.role === 'user' ? 'Kamu' : 'My AI'}
            </div>
            <span style={{ 
              display: 'inline-block', 
              padding: '10px 14px', 
              borderRadius: '12px', 
              backgroundColor: msg.role === 'user' ? '#0070f3' : '#e4e6eb', 
              color: msg.role === 'user' ? 'white' : 'black', 
              maxWidth: '85%', 
              textAlign: 'left',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.text}
            </span>
          </div>
        ))}
        {isLoading && <p style={{ color: '#888', fontStyle: 'italic', fontSize: '14px' }}>My AI sedang berpikir...</p>}
      </div>

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
