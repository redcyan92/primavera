function buildArtistRegex(artists) {
  const terms = artists
    .filter(a => a !== 'Otro')
    .sort((a, b) => b.length - a.length)
    .map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return terms.length ? new RegExp(terms.join('|'), 'i') : null;
}

const TIME_PATTERNS = [
  { pattern: /\b(\d{1,2})[:\.](\d{2})\s*(am|pm)?\b/i, extract: (m) => `${m[1]}:${m[2]}${m[3] ? ' ' + m[3].toLowerCase() : ''}` },
  { pattern: /\b(?:at|a\s+las?|alle?)\s+(\d{1,2})\b/i, extract: (m) => `${m[1]}:00` },
  { pattern: /\b(\d{1,2})\s*(am|pm)\b/i, extract: (m) => `${m[1]}${m[2].toLowerCase()}` },
  { pattern: /\b(midnight|medianoche|mezzanotte|a\s*medianoche)\b/i, extract: () => 'midnight' },
  { pattern: /\b(morning|mañana|por\s+la\s+mañana|mattina|mattino|di\s+mattina)\b/i, extract: () => 'morning' },
  { pattern: /\b(afternoon|tarde|por\s+la\s+tarde|pomeriggio|di\s+pomeriggio)\b/i, extract: () => 'afternoon' },
  { pattern: /\b(evening|night(?!\s*club)|noche|por\s+la\s+noche|sera|di\s+sera)\b/i, extract: () => 'evening' },
  { pattern: /\b(late\s*night|early\s*hours?|madrugada|de\s+madrugada|notte\s+fonda)\b/i, extract: () => 'late night' },
];

const LOCATION_KEYWORDS = {
  main_stage:  /\b(main\s*stage|escenario\s*principal|gran\s*escenario|tarima)\b/i,
  bar:         /\b(bar|drink|beber|tomando|cerveza|birra|cocktail|copa|cubata)\b/i,
  bathroom:    /\b(bathroom|toilet|baño|bagno|wc|aseo|lavabo)\b/i,
  entrance:    /\b(entrance|entrada|ingresso|exit|salida|acceso|puerta)\b/i,
  vip:         /\bvip\b/i,
  mosh_pit:    /\b(mosh|pit|front(?:\s*row)?|fila\s*(?:uno|1|delantera)|primera\s*fila|barreras?)\b/i,
  camping:     /\b(camping|camp(?:site)?|outside|fuera|acampada|carpa)\b/i,
  general:     /\b(general\s*area|zona\s*general|crowd|multitud)\b/i,
};

const DAY_PATTERNS = [
  { pattern: /\b(monday|lunes|lunedì|lundi)\b/i, value: 'monday' },
  { pattern: /\b(tuesday|martes|martedì|mardi)\b/i, value: 'tuesday' },
  { pattern: /\b(wednesday|miércoles|mercoledì|mercredi)\b/i, value: 'wednesday' },
  { pattern: /\b(thursday|jueves|giovedì|jeudi)\b/i, value: 'thursday' },
  { pattern: /\b(friday|viernes|venerdì|vendredi)\b/i, value: 'friday' },
  { pattern: /\b(saturday|sábado|sabato|samedi)\b/i, value: 'saturday' },
  { pattern: /\b(sunday|domingo|domenica|dimanche)\b/i, value: 'sunday' },
];

export function extractFields(text, artists = []) {
  const result = { artist: null, time: null, location: null, day: null };

  const artistRegex = buildArtistRegex(artists);
  if (artistRegex) {
    const m = text.match(artistRegex);
    if (m) result.artist = artists.find(a => a.toLowerCase() === m[0].toLowerCase()) || m[0];
  }

  for (const { pattern, extract } of TIME_PATTERNS) {
    const m = text.match(pattern);
    if (m) { result.time = extract(m); break; }
  }

  for (const [value, pattern] of Object.entries(LOCATION_KEYWORDS)) {
    if (pattern.test(text)) { result.location = value; break; }
  }

  for (const { pattern, value } of DAY_PATTERNS) {
    if (pattern.test(text)) { result.day = value; break; }
  }

  return result;
}
