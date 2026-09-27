const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64Data] = result.split(",");
      setPendingDoc({ name: file.name, mimeType: file.type, data: base64Data });
    };
    reader.readAsDataURL(file);
    setShowAttachSheet(false);
  };
    };
    reader.readAsDataURL(file);
    setShowAttachSheet(false);
  };

  const kirimPesan = async () => {
    if ((!input.trim() && !pendingImage) || !activeId) return;

    const teksInput = input;
    const gambarUntukDikirim = pendingImage;

    const pesanUser: Message = {
      role: "user",
      content: teksInput || "(gambar)",
      imagePreview: gambarUntukDikirim?.preview,
    };

    setInput("");
    setPendingImage(null);
    setLoading(true);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              title: c.messages.length === 0 ? (teksInput || "Gambar").slice(0, 30) : c.title,
              messages: [...c.messages, pesanUser],
            }
          : c
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
