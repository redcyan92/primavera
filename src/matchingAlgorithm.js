import { HEIGHT_RANGES, AGE_RANGES } from './CreateNoteFlow';

// Parse otherPersonDesc / ownDesc — may be JSON (new) or legacy plain string
const parseDesc = (raw) => {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

// Returns true if the own height (e.g. "1.78") falls inside the other's height range key
const heightInRange = (rangeKey, ownHeightStr) => {
  const h = parseFloat(ownHeightStr);
  if (isNaN(h)) return false;
  const range = HEIGHT_RANGES.find(r => r.value === rangeKey);
  if (!range) return false;
  return h >= range.min && h < range.max;
};

// Returns true if the own age (e.g. "26") falls inside the other's age range key
const ageInRange = (rangeKey, ownAgeStr) => {
  const a = parseInt(ownAgeStr, 10);
  if (isNaN(a)) return false;
  const range = AGE_RANGES.find(r => r.value === rangeKey);
  if (!range) return false;
  return a >= range.min && a < range.max;
};

const BUILD_ORDER = ['Muy delgado/a', 'Delgado/a', 'Medio/a', 'Atlético/a', 'Fornido/a'];
const buildDistance = (a, b) => {
  const ai = BUILD_ORDER.indexOf(a);
  const bi = BUILD_ORDER.indexOf(b);
  if (ai === -1 || bi === -1) return 99;
  return Math.abs(ai - bi);
};

// Structured physical comparison: other's approximate description vs own exact values
// Returns a raw score 0-24
const physicalMatchScore = (other, own) => {
  if (!other || !own) return 0;
  let score = 0;

  // Gender: hard disqualifier if specified and mismatches
  if (other.gender?.length && own.gender) {
    if (!other.gender.includes(own.gender)) return 0;
    score += 4;
  }

  // Height: +4 if own height falls in other's selected range
  if (other.height_range && own.height) {
    if (heightInRange(other.height_range, own.height)) score += 4;
  }

  // Age: +4 if own age falls in other's selected range
  if (other.age_range && own.age) {
    if (ageInRange(other.age_range, own.age)) score += 4;
  }

  // Build: +3 exact match, +1 adjacent
  if (other.build && own.build) {
    const d = buildDistance(other.build, own.build);
    if (d === 0) score += 3;
    else if (d === 1) score += 1;
  }

  // Hair color: +3 if own color is in other's multi-select
  if (other.hair_color?.length && own.hair_color) {
    if (other.hair_color.includes(own.hair_color)) score += 3;
  }

  // Hair length: +2
  if (other.hair_length && own.hair_length && other.hair_length === own.hair_length) {
    score += 2;
  }

  // Eye color: +1 (less reliable memory)
  if (other.eye_color && own.eye_color && other.eye_color !== 'No recuerdo') {
    if (other.eye_color === own.eye_color) score += 1;
  }

  // Features overlap: +1 per shared feature, max 3
  if (other.features?.length && own.features?.length) {
    const overlap = other.features.filter(f => own.features.includes(f)).length;
    score += Math.min(overlap, 3);
  }

  return score; // max ~24
};

export const calculateMatchScore = (note1, note2) => {
  let score = 0;

  // Artista: +40
  if (note1.artist && note2.artist && note1.artist.toLowerCase() === note2.artist.toLowerCase()) {
    score += 40;
  }

  // Tempo: +30
  if (note1.time && note2.time && checkTimeOverlap(note1.time, note2.time)) {
    score += 30;
  }

  // Location: +20
  if (note1.location && note2.location && note1.location.toLowerCase() === note2.location.toLowerCase()) {
    score += 20;
  }

  // Physical matching: bidirectional (note1 describes other → should match note2's own, and vice versa)
  const other1 = parseDesc(note1.otherPersonDesc);
  const own2   = parseDesc(note2.ownDesc);
  const other2 = parseDesc(note2.otherPersonDesc);
  const own1   = parseDesc(note1.ownDesc);

  const phys1to2 = physicalMatchScore(other1, own2);
  const phys2to1 = physicalMatchScore(other2, own1);

  // Normalize average to max 15 (parity with original scoring)
  const physScore = Math.round(((phys1to2 + phys2to1) / 2 / 24) * 15);
  score += physScore;

  // Companions contrast: +10
  if (note1.companions && note2.companions && doCompanionsContrast(note1.companions, note2.companions)) {
    score += 10;
  }

  // Completeness bonus: +5
  if (countFilledFields(note1) >= 3 && countFilledFields(note2) >= 3) {
    score += 5;
  }

  return { score, quality: getQualityLabel(score) };
};

const checkTimeOverlap = (time1, time2) => {
  const t1 = time1.toLowerCase();
  const t2 = time2.toLowerCase();
  const daysMatch = ['viernes', 'sabado', 'sábado', 'domingo'].some(d => t1.includes(d) && t2.includes(d));
  const periodMatch = ['mañana', 'tarde', 'noche', 'madrugada'].some(p => t1.includes(p) && t2.includes(p));
  return daysMatch || periodMatch;
};

const doCompanionsContrast = (comp1, comp2) => {
  const soloKw = ['solo', 'sola', 'alone'];
  const groupKw = ['amigas', 'amigos', 'pareja', 'grupo', 'amiga', 'amigo', 'familia', 'amigo_1', 'amigos_2_3', 'amigos_4plus'];
  const isSolo = (c) => soloKw.some(k => c.toLowerCase().includes(k));
  const isGroup = (c) => groupKw.some(k => c.toLowerCase().includes(k));
  return (isSolo(comp1) && isGroup(comp2)) || (isSolo(comp2) && isGroup(comp1));
};

const countFilledFields = (note) => {
  let n = 0;
  if (note.description?.trim()) n++;
  if (note.artist?.trim()) n++;
  if (note.time?.trim()) n++;
  if (note.location?.trim()) n++;
  if (note.otherPersonDesc) n++;
  if (note.ownDesc) n++;
  if (note.companions?.trim()) n++;
  return n;
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
      const { score, quality } = calculateMatchScore(noteToMatch, note);
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
        score,
        quality,
        userResponse: null
      };
    })
    .filter(m => m.score >= 40)
    .sort((a, b) => b.score - a.score);
};
