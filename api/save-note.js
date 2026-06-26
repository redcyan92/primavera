const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const MAX_TEXT_LENGTH = 2000;

async function generateEmbedding(text) {
  if (!text?.trim() || !OPENAI_KEY) return null;
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
}

async function saveToSupabase(note) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(note),
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    user_id, festival_id, visibility, description, own_desc,
    artist, location, time, instagram, search_intent,
  } = req.body ?? {};

  // Input validation
  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'Missing user_id' });
  }
  if (!visibility || !['targeted', 'public'].includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility' });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return res.status(400).json({ error: 'Description too short' });
  }
  if (description.length > MAX_TEXT_LENGTH || (own_desc && own_desc.length > MAX_TEXT_LENGTH)) {
    return res.status(400).json({ error: 'Text too long' });
  }

  try {
    const [embeddingOther, embeddingSelf] = await Promise.all([
      generateEmbedding(description),
      generateEmbedding(own_desc),
    ]);

    const note = {
      user_id,
      festival_id: festival_id ?? null,
      visibility,
      description: description.trim(),
      own_desc: own_desc?.trim() ?? null,
      artist: artist ?? null,
      location: location ?? null,
      time: time ?? null,
      instagram: instagram?.trim() ?? null,
      search_intent: search_intent ?? false,
      embedding_other: embeddingOther,
      embedding_self: embeddingSelf,
    };

    const created = await saveToSupabase(note);
    return res.status(200).json(created);
  } catch (err) {
    console.error('save-note error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
