const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export async function generateEmbedding(text) {
  if (!text?.trim() || !OPENAI_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({ input: text.trim(), model: 'text-embedding-3-small' }),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
