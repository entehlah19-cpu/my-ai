<div className="composer">
  {/* Popup menu */}
  {menuOpen && (
    <div className="plus-menu">
      <button onClick={() => cameraInput.current?.click()}>
        <span className="menu-circle">◉</span>
        <span>Kamera</span>
      </button>

      <button onClick={() => photoInput.current?.click()}>
        <span className="menu-circle">▧</span>
        <span>Foto</span>
      </button>

      <button onClick={() => fileInput.current?.click()}>
        <span className="menu-circle">♧</span>
        <span>File</span>
      </button>

      <button onClick={() => setPluginOpen(!pluginOpen)}>
        <span className="menu-circle">◌</span>
        <span>Plugin</span>
        <span className="menu-arrow">›</span>
      </button>

      <button
        className={thinking ? "selected" : ""}
        onClick={() => setThinking(!thinking)}
      >
        <span className="menu-circle">✦</span>
        <span>Berpikir lebih keras</span>
        {thinking && <span className="check">✓</span>}
      </button>

      <button
        className={temporaryChat ? "selected" : ""}
        onClick={() => setTemporaryChat(!temporaryChat)}
      >
        <span className="menu-circle">◔</span>
        <span>Obrolan sementara</span>
        {temporaryChat && <span className="check">✓</span>}
      </button>
    </div>
  )}

  {/* Input */}
  <div className="composer-box">
    <button
      className="plus-btn"
      onClick={() => setMenuOpen(!menuOpen)}
    >
      +
    </button>

    <input
      type="text"
      placeholder="Tanyakan apa saja"
    />

    <button className="send-btn">
      ↑
    </button>
  </div>
</div>
