const handleKirim = async () => {
    if (!input.trim() || isLoading) return;

    const pesanUser = input;
    setMessages((prev) => [...prev, { role: 'user', text: pesanUser }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: pesanUser }]
              }
            ]
          })
        }
      );

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
        const jawabanAI = data.candidates[0].content.parts[0].text;
        setMessages((prev) => [...prev, { role: 'ai', text: jawabanAI }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Kunci API terhubung, tapi balasan kosong. Coba tes kirim sekali lagi ya!' }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Waduh, sistemku agak sibuk. Coba kirim pesan lagi ya!' }]);
    } finally {
      setIsLoading(false);
    }
  };
