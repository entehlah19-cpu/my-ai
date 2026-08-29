"use client";

import { useRef, useState } from "react";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [temporaryChat, setTemporaryChat] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);

  const cameraInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    console.log("File dipilih:", files);

    // Nanti di sini bisa dikirim ke API / upload server
  };

  return (
    <main className="chat-page">

      {/* CHAT AREA */}
      <div className="chat-content">
        <h1>AI Chat</h1>

        {thinking && (
          <div className="mode-badge">
            🧠 Berpikir lebih keras aktif
          </div>
        )}

        {temporaryChat && (
          <div className="temporary-badge">
            💬 Obrolan sementara
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      <div className="input-wrapper">

        <div className="input-box">

          {/* TOMBOL + */}
          <button
            className="plus-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Tambah"
          >
            +
          </button>

          <input
            className="message-input"
            placeholder="Tanyakan apa saja"
          />

          <button className="send-button">
            ↑
          </button>
        </div>

        {/* MENU KIRI */}
        {menuOpen && (
          <div className="attachment-menu">

            {/* KAMERA */}
            <button
              className="menu-item"
              onClick={() => cameraInput.current?.click()}
            >
              <span className="menu-icon">📷</span>
              <span>Kamera</span>
            </button>

            {/* FOTO */}
            <button
              className="menu-item"
              onClick={() => photoInput.current?.click()}
            >
              <span className="menu-icon">🖼️</span>
              <span>Foto</span>
            </button>

            {/* FILE */}
            <button
              className="menu-item"
              onClick={() => fileInput.current?.click()}
            >
              <span className="menu-icon">📎</span>
              <span>File</span>
            </button>

            {/* PLUGIN */}
            <button
              className="menu-item"
              onClick={() => setPluginOpen(!pluginOpen)}
            >
              <span className="menu-icon">🧩</span>
              <span>Plugin</span>
              <span className="arrow">
                {pluginOpen ? "⌃" : "›"}
              </span>
            </button>

            {pluginOpen && (
              <div className="plugin-submenu">
                <button>🌐 Web Search</button>
                <button>🧮 Calculator</button>
                <button>💻 Code</button>
              </div>
            )}

            {/* BERPIKIR LEBIH KERAS */}
            <button
              className={`menu-item ${
                thinking ? "active-menu" : ""
              }`}
              onClick={() => setThinking(!thinking)}
            >
              <span className="menu-icon">🧠</span>
              <span>Berpikir lebih keras</span>

              <span className="check">
                {thinking ? "✓" : ""}
              </span>
            </button>

            {/* OBROLAN SEMENTARA */}
            <button
              className={`menu-item ${
                temporaryChat ? "active-menu" : ""
              }`}
              onClick={() => setTemporaryChat(!temporaryChat)}
            >
              <span className="menu-icon">💬</span>
              <span>Obrolan sementara</span>

              <span className="check">
                {temporaryChat ? "✓" : ""}
              </span>
            </button>
          </div>
        )}

        {/* HIDDEN INPUTS */}

        {/* Kamera */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleFile}
        />

        {/* Foto */}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFile}
        />

        {/* File */}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={handleFile}
        />

      </div>
    </main>
  );
}
