import { PS_ARTISTS } from './defaultOptions';

// Build a regex from the artists list (longest first to avoid partial matches)
const artistRegex = new RegExp(
  PS_ARTISTS
    .filter(a => a !== 'Otro')
    .sort((a, b) => b.length - a.length)
    .map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'i'
);

// EN | ES | IT
const TIME_PATTERNS = [
  // Exact clock times: 23:00 / 11.30 / 11:30pm
  { pattern: /\b(\d{1,2})[:\.](\d{2})\s*(am|pm)?\b/i, extract: (m) => `${m[1]}:${m[2]}${m[3] ? ' ' + m[3].toLowerCase() : ''}` },
  // "at 11" / "a las 11" / "alle 11"
  { pattern: /\b(?:at|a\s+las?|alle?)\s+(\d{1,2})\b/i, extract: (m) => `${m[1]}:00` },
  // bare 11pm / 11am
  { pattern: /\b(\d{1,2})\s*(am|pm)\b/i, extract: (m) => `${m[1]}${m[2].toLowerCase()}` },
  // midnight
  { pattern: /\b(midnight|medianoche|mezzanotte|a\s*medianoche)\b/i, extract: () => 'midnight' },
  // morning
  { pattern: /\b(morning|mañana|por\s+la\s+mañana|mattina|mattino|di\s+mattina)\b/i, extract: () => 'morning' },
  // afternoon
  { pattern: /\b(afternoon|tarde|por\s+la\s+tarde|pomeriggio|di\s+pomeriggio)\b/i, extract: () => 'afternoon' },
  // evening / night (earlier)
  { pattern: /\b(evening|night(?!\s*club)|noche|por\s+la\s+noche|sera|di\s+sera)\b/i, extract: () => 'evening' },
  // late night
  { pattern: /\b(late\s*night|early\s*hours?|madrugada|de\s+madrugada|notte\s+fonda|notte\s+tarda|tarda\s+notte)\b/i, extract: () => 'late night' },
];

const LOCATION_KEYWORDS = {
  main_stage:  /\b(main\s*stage|escenario\s*principal|palco\s*principale?|gran\s*escenario|tarima)\b/i,
  bar:         /\b(bar|drink|beber|tomando|cerveza|birra|cocktail|mojito|copa|copas|cubata)\b/i,
  bathroom:    /\b(bathroom|toilet|baño|bagno|wc|aseo|servizi|lavabo)\b/i,
  entrance:    /\b(entrance|entrada|ingresso|exit|salida|uscita|acceso|puerta)\b/i,
  vip:         /\bvip\b/i,
  mosh_pit:    /\b(mosh|pit|front(?:\s*row)?|fila\s*(?:uno|1|delantera)|primera\s*fila|prime\s*file|davanti\s*al\s*palco|barreras?)\b/i,
  camping:     /\b(camping|camp(?:site)?|outside|fuera|acampada|tenda|carpa)\b/i,
  general:     /\b(general\s*area|zona\s*general|area\s*generale|crowd|multitud|folla)\b/i,
};

const APPEARANCE_PATTERNS = [
  // ── HAIR COLOR ────────────────────────────────────────────────────────────
  // Black / dark
  { key: 'hair', label: 'Black hair',
    pattern: /\b(black|dark)\s*(hair|pelo|cabello|capelli|melena)\b|\b(pelo|cabello|capelli)\s*(negro|oscuro|scuro|nero)\b/i },
  // Brown / chestnut
  { key: 'hair', label: 'Brown hair',
    pattern: /\b(brown|chestnut|brunette)\s*(hair|pelo|cabello|capelli)?\b|\b(castaño|castaña|castano|castana|pelo\s*marrón|capelli\s*castani)\b/i },
  // Blonde
  { key: 'hair', label: 'Blonde hair',
    pattern: /\b(blonde?|blond)\s*(hair|pelo|cabello|capelli)?\b|\b(rubio|rubia|biondo|bionda|pelo\s*rubio|capelli\s*biondi)\b/i },
  // Red / ginger
  { key: 'hair', label: 'Red hair',
    pattern: /\b(red|ginger|auburn)\s*(hair|pelo|cabello|capelli)?\b|\b(pelirroj[oa]|rojo|rosso|pelo\s*rojo|capelli\s*rossi)\b/i },
  // Grey / white
  { key: 'hair', label: 'Grey/White hair',
    pattern: /\b(gr[ae]y|white|silver)\s*(hair|pelo|cabello|capelli)?\b|\b(cano|canoso|blanco|grigio|bianco|pelo\s*(blanco|gris)|capelli\s*(grigi|bianchi))\b/i },
  // Coloured / dyed
  { key: 'hair', label: 'Coloured hair',
    pattern: /\b(colou?red|dyed|highlights?|tinted)\s*(hair|pelo|cabello|capelli)?\b|\b(teñido|tinto|tinte|decolorado|decolorazione|capelli\s*colorati|pelo\s*teñido|mechas)\b/i },
  // Shaved
  { key: 'hair', label: 'Shaved head',
    pattern: /\b(shaved?\s*head|buzz\s*cut|rapado|rapada|rasato|rasata|calvo|calva|pelado)\b/i },
  // Short hair
  { key: 'hair', label: 'Short hair',
    pattern: /\b(short)\s*(hair|pelo|cabello|capelli)\b|\b(pelo\s*corto|capelli\s*corti)\b/i },
  // Long hair
  { key: 'hair', label: 'Long hair',
    pattern: /\b(long)\s*(hair|pelo|cabello|capelli)\b|\b(pelo\s*largo|melena|capelli\s*lunghi)\b/i },
  // Curly
  { key: 'hair', label: 'Curly hair',
    pattern: /\b(curly|wavy|afro)\s*(hair|pelo|cabello|capelli)?\b|\b(rizado|rizada|ondulado|ricci|ricciuto|pelo\s*rizado|capelli\s*ricci)\b/i },

  // ── EYES ──────────────────────────────────────────────────────────────────
  { key: 'eyes', label: 'Brown eyes',
    pattern: /\b(brown)\s*(eyes?|ojos|occhi)\b|\b(ojos\s*marrones|ojos\s*oscuros|occhi\s*marroni|occhi\s*scuri)\b/i },
  { key: 'eyes', label: 'Green eyes',
    pattern: /\b(green)\s*(eyes?|ojos|occhi)\b|\b(ojos\s*verdes|occhi\s*verdi)\b/i },
  { key: 'eyes', label: 'Blue eyes',
    pattern: /\b(blue|bluish|grey(?=\s*eyes))\s*(eyes?|ojos|occhi)\b|\b(ojos\s*(azules?|grises)|occhi\s*(azzurri|grigio))\b/i },
  { key: 'eyes', label: 'Light eyes',
    pattern: /\b(light|clear|pale|hazel)\s*(eyes?|ojos|occhi)\b|\b(ojos\s*claros|occhi\s*chiari)\b/i },

  // ── BUILD ─────────────────────────────────────────────────────────────────
  { key: 'build', label: 'Tall',
    pattern: /\b(tall|tallish|high)\b|\b(alt[oa]|grande|grandote|longilineo|slanciato)\b/i },
  { key: 'build', label: 'Short',
    pattern: /\b(short(?!\s*hair)|petite|small)\b|\b(baj[oa]|pequeñ[oa]|piccol[oa]|bajito)\b/i },
  { key: 'build', label: 'Slim',
    pattern: /\b(slim|thin|slender|lean|skinny)\b|\b(delgad[oa]|flac[ao]|esbelto|filiforme|magrolin[oa]|magr[oa]|sottile)\b/i },
  { key: 'build', label: 'Athletic',
    pattern: /\b(athletic|fit|toned|sporty)\b|\b(atlético|atlética|deportivo|in\s*forma|sportiv[oa]|tonico)\b/i },
  { key: 'build', label: 'Muscular',
    pattern: /\b(muscular|buff|built|stocky|beefy)\b|\b(musculoso|muscoloso|fornido|robusto|corpulento)\b/i },
  { key: 'build', label: 'Average build',
    pattern: /\b(average|medium)\s*build\b|\b(complexión\s*media|corporatura\s*media|normale)\b/i },

  // ── FEATURES ──────────────────────────────────────────────────────────────
  { key: 'features', label: 'Tattoos',
    pattern: /\b(tattoo|tattooed|tatt?s?)\b|\b(tatuaje|tatuado|tatuaggio|tatuato)\b/i },
  { key: 'features', label: 'Piercings',
    pattern: /\b(piercing|pierced)\b|\b(arete|pendiente|orecchino|aro)\b/i },
  { key: 'features', label: 'Glasses',
    pattern: /\b(glasses?|spectacles?|shades|sunglasses?)\b|\b(gafas|lentes|anteojos|occhiali|oculos)\b/i },
  { key: 'features', label: 'Beard',
    pattern: /\b(beard|stubble|goatee|moustache|mustache)\b|\b(barba|barbudo|bigote|baffi)\b/i },
  { key: 'features', label: 'Hat/Cap',
    pattern: /\b(hat|cap|beanie|bucket\s*hat|snapback|visor)\b|\b(gorra|sombrero|gorro|berretto|cappello|visiera)\b/i },
  { key: 'features', label: 'Bold makeup',
    pattern: /\b(make\s*up|makeup|mascara|eyeliner|glitter|face\s*paint)\b|\b(maquillaje|maquillado|trucco|truccato|purpurina|brillantina)\b/i },
  { key: 'features', label: 'Large earrings',
    pattern: /\b(large|big|hoop)\s*earrings?\b|\b(aretes?\s*grandes?|pendientes?\s*grandes?|orecchini\s*grandi|aretes)\b/i },

  // ── CLOTHING (bonus — stored as appearance tags) ──────────────────────────
  { key: 'clothing', label: 'White top',
    pattern: /\b(white)\s*(t[\s-]?shirt|shirt|top|tee|camiseta|polo)\b|\b(camiseta|maglietta|maglia)\s*(blanca?|bianca?)\b/i },
  { key: 'clothing', label: 'Black top',
    pattern: /\b(black)\s*(t[\s-]?shirt|shirt|top|tee|camiseta|polo)\b|\b(camiseta|maglietta|maglia)\s*(negra?|nera?)\b/i },
  { key: 'clothing', label: 'Dress/Skirt',
    pattern: /\b(dress|skirt|mini|sundress)\b|\b(vestido|falda|vestito|gonna)\b/i },
  { key: 'clothing', label: 'Jacket/Hoodie',
    pattern: /\b(jacket|hoodie|sweatshirt|bomber|parka|windbreaker)\b|\b(chaqueta|sudadera|abrigo|cappotto|felpa|giubbotto)\b/i },
];

export function extractFields(text) {
  const result = {
    artist: null,
    time: null,
    location: null,
    appearance: [],
  };

  // Artist
  const artistMatch = text.match(artistRegex);
  if (artistMatch) result.artist = artistMatch[0];

  // Time — first match wins
  for (const { pattern, extract } of TIME_PATTERNS) {
    const m = text.match(pattern);
    if (m) { result.time = extract(m); break; }
  }

  // Location — first match wins
  for (const [value, pattern] of Object.entries(LOCATION_KEYWORDS)) {
    if (pattern.test(text)) { result.location = value; break; }
  }

  // Appearance — all matches, deduplicated by label
  const seen = new Set();
  for (const { pattern, label } of APPEARANCE_PATTERNS) {
    if (pattern.test(text) && !seen.has(label)) {
      seen.add(label);
      result.appearance.push(label);
    }
  }

  return result;
}
