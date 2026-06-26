function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const checkTimeOverlap = (time1, time2) => {
  const t1 = time1.toLowerCase();
  const t2 = time2.toLowerCase();
  const days = ['thursday', 'friday', 'saturday', 'sunday', 'viernes', 'sabado', 'sábado', 'domingo', 'jueves'];
  const periods = ['morning', 'afternoon', 'evening', 'late night', 'late_night', 'mañana', 'tarde', 'noche', 'madrugada', 'midnight'];
  return days.some(d => t1.includes(d) && t2.includes(d)) || periods.some(p => t1.includes(p) && t2.includes(p));
};

const getQualityLabel = (score) => {
  if (score >= 100) return 'Strong match';
  if (score >= 75) return 'Good match';
  if (score >= 50) return 'Possible';
  return 'Low chance';
};

export const calculateMatchScore = (note1, note2) => {
  let score = 0;

  // Structured prefilter signals — also used as score
  if (note1.artist && note2.artist && note1.artist.toLowerCase() === note2.artist.toLowerCase()) score += 40;
  if (note1.time && note2.time && checkTimeOverlap(note1.time, note2.time)) score += 30;
  if (note1.location && note2.location && note1.location === note2.location) score += 20;

  // Embedding cross-match: note A describes other → compare to note B's self, and vice versa
  const e1o = note1.embeddingOther, e1s = note1.embeddingSelf;
  const e2o = note2.embeddingOther, e2s = note2.embeddingSelf;

  if (e1o && e2s && e2o && e1s) {
    const sim = (cosineSim(e1o, e2s) + cosineSim(e2o, e1s)) / 2;
    score += Math.round(sim * 50);
  } else if (e1o && e2s) {
    score += Math.round(cosineSim(e1o, e2s) * 25);
  } else if (e2o && e1s) {
    score += Math.round(cosineSim(e2o, e1s) * 25);
  }

  return { score, quality: getQualityLabel(score) };
};

export const findMatches = (myNote, allNotes) => {
  return allNotes
    .filter(n => n.id !== myNote.id && n.user_id !== myNote.user_id)
    .filter(n =>
      n.visibility === 'targeted' || n.visibility === 'private' ||
      (n.visibility === 'public' && n.searchIntent)
    )
    .map(n => {
      const { score, quality } = calculateMatchScore(myNote, n);
      return {
        id: n.id, user_id: n.user_id,
        description: n.description, artist: n.artist,
        time: n.time, location: n.location, instagram: n.instagram,
        embeddingOther: n.embeddingOther, embeddingSelf: n.embeddingSelf,
        score, quality, userResponse: null,
      };
    })
    .filter(m => m.score >= 40)
    .sort((a, b) => b.score - a.score);
};
