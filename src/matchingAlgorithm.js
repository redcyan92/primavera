export const calculateMatchScore = (note1, note2) => {
  let score = 0;

  if (note1.artist && note2.artist && note1.artist.toLowerCase() === note2.artist.toLowerCase()) {
    score += 40;
  }

  if (note1.time && note2.time) {
    if (checkTimeOverlap(note1.time, note2.time)) {
      score += 30;
    }
  }

  if (note1.location && note2.location && note1.location.toLowerCase() === note2.location.toLowerCase()) {
    score += 20;
  }

  if (note1.otherPersonDesc && note2.ownDesc) {
    const similarity = calculateSimilarity(note1.otherPersonDesc, note2.ownDesc);
    if (similarity > 0.5) {
      score += 15;
    }
  }

  if (note1.companions && note2.companions) {
    if (doCompanionsContrast(note1.companions, note2.companions)) {
      score += 10;
    }
  }

  const note1Completeness = countFilledFields(note1);
  const note2Completeness = countFilledFields(note2);
  if (note1Completeness >= 3 && note2Completeness >= 3) {
    score += 5;
  }

  return {
    score,
    quality: getQualityLabel(score)
  };
};

const checkTimeOverlap = (time1, time2) => {
  const keywords1 = time1.toLowerCase();
  const keywords2 = time2.toLowerCase();

  const daysMatch = ['viernes', 'sabado', 'sábado', 'domingo'].some(day =>
    keywords1.includes(day) && keywords2.includes(day)
  );

  const periodMatch = ['mañana', 'tarde', 'noche', 'madrugada'].some(period =>
    keywords1.includes(period) && keywords2.includes(period)
  );

  return daysMatch || periodMatch;
};

const calculateSimilarity = (str1, str2) => {
  const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  return commonWords.length / Math.max(words1.length, words2.length);
};

const doCompanionsContrast = (comp1, comp2) => {
  const soloKeywords = ['solo', 'sola', 'alone', 'sin acompañante'];
  const groupKeywords = ['amigas', 'amigos', 'pareja', 'grupo', 'amiga', 'amigo', 'familia'];

  const isSolo1 = soloKeywords.some(k => comp1.toLowerCase().includes(k));
  const isSolo2 = soloKeywords.some(k => comp2.toLowerCase().includes(k));
  const isGroup1 = groupKeywords.some(k => comp1.toLowerCase().includes(k));
  const isGroup2 = groupKeywords.some(k => comp2.toLowerCase().includes(k));

  return (isSolo1 && isGroup2) || (isSolo2 && isGroup1);
};

const countFilledFields = (note) => {
  let count = 0;
  if (note.description?.trim()) count++;
  if (note.artist?.trim()) count++;
  if (note.time?.trim()) count++;
  if (note.location?.trim()) count++;
  if (note.otherPersonDesc?.trim()) count++;
  if (note.ownDesc?.trim()) count++;
  if (note.companions?.trim()) count++;
  return count;
};

const getQualityLabel = (score) => {
  if (score >= 90) return 'Muy probable';
  if (score >= 70) return 'Probable';
  if (score >= 50) return 'Puede ser';
  return 'Poco probable';
};

export const findMatches = (noteToMatch, allNotes) => {
  return allNotes
    .filter(note => note.id !== noteToMatch.id && note.visibility === 'private')
    .map(note => {
      const matchScore = calculateMatchScore(noteToMatch, note);
      return {
        id: note.id,
        user_id: note.user_id,
        description: note.description,
        artist: note.artist,
        time: note.time,
        otherPersonDesc: note.otherPersonDesc,
        ownDesc: note.ownDesc,
        companions: note.companions,
        instagram: note.instagram,
        score: matchScore.score,
        quality: matchScore.quality,
        userResponse: null
      };
    })
    .filter(match => match.score >= 40)
    .sort((a, b) => b.score - a.score);
};
