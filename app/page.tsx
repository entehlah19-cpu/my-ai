 export default function Home() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      backgroundColor: "#212121",
      color: "white"
    }}>
      <header style={{
        padding: "16px",
        borderBottom: "1px solid #444",
        fontSize: "20px",
        fontWeight: "bold"
      }}>
        My AI
      </header>

      <div style={{
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#aaa"
      }}>
        Mulai percakapan dengan AI...
      </div>

      <div style={{
        padding: "16px",
        borderTop: "1px solid #444"
      }}>
        <input
          placeholder="Ketik pesan..."
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "none",
            outline: "none"
          }}
        />
      </div>
    </main>
  );
}

