import React, { useState, useEffect, useRef } from 'react';
import { extractFields } from './extractFields';
import { PS_ARTISTS, TIME_OPTIONS, LOCATION_OPTIONS, APPEARANCE_OPTIONS, DAY_OPTIONS } from './defaultOptions';

const t = {
  primary: '#F7602E', primaryLight: '#FAA284', primaryBg: '#FFF0EB',
  primaryBorder: '#FABB96', bg: '#FEFBF6', white: '#FFFFFF',
  surface: '#F7F5F2', dark: '#1D1D2F', border: '#EDE8DF',
  borderDark: '#DDD9D1', text: '#1D1D2F', textSec: '#56524E',
  textMuted: '#9E9A93', success: '#05C270', successBg: '#E6FAF2',
  successBorder: '#A8E6CF', successDark: '#036B42',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ── Primitives ────────────────────────────────────────────────────────────

const Chip = ({ label, selected, onClick }) => (
  <button onClick={onClick} style={{
    padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
    border: selected ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
    backgroundColor: selected ? t.primaryBg : t.white,
    fontSize: '12px', color: selected ? t.primary : t.textSec,
    fontWeight: selected ? '600' : '400', fontFamily: font,
    transition: 'all 0.15s',
  }}>{label}</button>
);

const SectionLabel = ({ children }) => (
  <p style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px', fontFamily: font }}>{children}</p>
);

const NavButtons = ({ onBack, onNext, nextLabel = 'Next →', nextEnabled = true, isLast = false }) => (
  <div style={{ display: 'flex', gap: '10px', paddingTop: '20px', paddingBottom: '8px' }}>
    {onBack && (
      <button onClick={onBack} style={{
        flex: 1, padding: '13px', borderRadius: '12px', border: `1px solid ${t.border}`,
        backgroundColor: t.white, cursor: 'pointer', fontSize: '14px',
        color: t.text, fontWeight: '500', fontFamily: font,
      }}>← Back</button>
    )}
    <button onClick={onNext} disabled={!nextEnabled} style={{
      flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
      backgroundColor: nextEnabled ? (isLast ? t.primary : t.dark) : t.borderDark,
      cursor: nextEnabled ? 'pointer' : 'not-allowed',
      fontSize: '14px', color: '#fff', fontWeight: '700', fontFamily: font,
      transition: 'background-color 0.2s',
    }}>{nextLabel}</button>
  </div>
);

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  }} />
);

const LoadingScreen = ({ message = 'Thinking…', sub }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '55vh', gap: '16px',
  }}>
    <div style={{
      width: '48px', height: '48px',
      border: `3px solid ${t.border}`, borderTop: `3px solid ${t.primary}`,
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
    <div style={{ textAlign: 'center' }}>
      <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '600', color: t.dark, fontFamily: font }}>{message}</p>
      {sub && <p style={{ margin: 0, fontSize: '12px', color: t.textMuted, fontFamily: font }}>{sub}</p>}
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const StepHeader = ({ title, sub, step, total }) => (
  <div style={{ marginBottom: '24px' }}>
    {total && (
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '2px',
            backgroundColor: i < step ? t.primary : t.border,
            transition: 'background-color 0.3s',
          }} />
        ))}
      </div>
    )}
    <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px', color: t.dark, fontFamily: font }}>{title}</h2>
    {sub && <p style={{ margin: 0, fontSize: '14px', color: t.textMuted, fontFamily: font, lineHeight: '1.5' }}>{sub}</p>}
  </div>
);

const REFINE_STEPS = ['time', 'artist', 'location', 'appearance', 'self'];
const REFINE_TOTAL = REFINE_STEPS.length;

// ── Main component ────────────────────────────────────────────────────────

export default function SearchWithAI({ onSave }) {
  const [step, setStep] = useState('input');
  const [prompt, setPrompt] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [refined, setRefined] = useState({
    artist: null, time: null, location: null,
    appearance: [], day: null,
    // self description fields
    self_gender: null, self_age: '', self_height: '',
    self_hair: null, self_build: null, self_features: [],
    self_clothing: '',
  });

  const go = (nextStep, delay = 900) => {
    setStep('loading');
    setTimeout(() => setStep(nextStep), delay);
  };

  const handleAnalyze = () => {
    if (!prompt.trim()) return;
    setStep('loading');
    setTimeout(() => {
      const fields = extractFields(prompt);
      setExtracted(fields);
      setRefined(prev => ({
        ...prev,
        artist: fields.artist || null,
        time: fields.time || null,
        location: fields.location || null,
        appearance: [...(fields.appearance || [])],
      }));
      setStep('detected');
    }, 700);
  };

  const toggleAppearance = (label) => setRefined(prev => ({
    ...prev,
    appearance: prev.appearance.includes(label)
      ? prev.appearance.filter(l => l !== label)
      : [...prev.appearance, label],
  }));

  const toggleSelfFeature = (label) => setRefined(prev => ({
    ...prev,
    self_features: prev.self_features.includes(label)
      ? prev.self_features.filter(l => l !== label)
      : [...prev.self_features, label],
  }));

  const handleSubmit = () => {
    const timeStr = [refined.day, refined.time].filter(Boolean).join(' ') || null;
    const selfDesc = JSON.stringify({
      gender: refined.self_gender,
      age: refined.self_age,
      height: refined.self_height,
      build: refined.self_build,
      hair: refined.self_hair,
      features: refined.self_features,
      clothing: refined.self_clothing,
    });
    onSave({
      visibility: 'targeted',
      location: refined.location,
      time: timeStr,
      artist: refined.artist,
      description: prompt,
      otherPersonDesc: JSON.stringify({ appearance: refined.appearance }),
      ownDesc: selfDesc,
      instagram: null,
      companions: null,
    });
    go('confirm', 500);
  };

  const handleReset = () => {
    setStep('input');
    setPrompt('');
    setExtracted(null);
    setRefined({ artist: null, time: null, location: null, appearance: [], day: null, self_gender: null, self_age: '', self_height: '', self_hair: null, self_build: null, self_features: [], self_clothing: '' });
  };

  const refineIndex = REFINE_STEPS.indexOf(step);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === 'loading') return <LoadingScreen message="On it…" sub="Reading between the lines" />;

  // ── Typewriter placeholder ────────────────────────────────────────────────
  const EXAMPLES = [
    'tall girl with dark curly hair, was at Bicep around midnight near the front…',
    'chico con gorra verde cerca del bar durante Rosalía, tatuajes en los brazos…',
    'ragazzo alto con capelli biondi vicino al palco durante Four Tet…',
    'person with glasses and a yellow jacket, we talked briefly near the entrance…',
  ];
  const [typeText, setTypeText] = useState('');
  const [exIdx, setExIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const typeRef = useRef(null);

  useEffect(() => {
    if (step !== 'input') return;
    const full = EXAMPLES[exIdx];
    const speed = isDeleting ? 18 : 38;
    const pause = isDeleting ? 0 : 1800;

    if (!isDeleting && typeText === full) {
      typeRef.current = setTimeout(() => setIsDeleting(true), pause);
    } else if (isDeleting && typeText === '') {
      setIsDeleting(false);
      setExIdx(i => (i + 1) % EXAMPLES.length);
    } else {
      typeRef.current = setTimeout(() => {
        setTypeText(isDeleting ? typeText.slice(0, -1) : full.slice(0, typeText.length + 1));
      }, speed);
    }
    return () => clearTimeout(typeRef.current);
  }, [typeText, isDeleting, exIdx, step]);

  // ── Step: input ───────────────────────────────────────────────────────────
  if (step === 'input') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', gap: '24px' }}>
      {/* AI badge */}
      <span style={{
        fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em',
        padding: '5px 12px', borderRadius: '999px',
        backgroundColor: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}`,
        fontFamily: font,
      }}>AI Assisted &middot; Only shared with compatible people</span>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 8px', color: t.dark, letterSpacing: '-0.5px', fontFamily: font }}>
          Who did you vibe with?
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: t.textMuted, fontFamily: font, lineHeight: '1.6', maxWidth: '300px' }}>
          Tell me anything you remember — the more detail, the better the match.
        </p>
      </div>

      {/* Text field with embedded send button */}
      <div style={{
        width: '100%', backgroundColor: t.white, border: `1px solid ${t.border}`,
        borderRadius: '16px', padding: '14px 14px 10px',
        boxShadow: '0 1px 4px rgba(29,29,47,0.05)', position: 'relative',
      }}>
        {/* Animated placeholder */}
        {!prompt && (
          <div style={{
            position: 'absolute', top: '14px', left: '14px', right: '56px',
            fontSize: '14px', color: t.textMuted, fontFamily: font,
            lineHeight: '1.6', pointerEvents: 'none', whiteSpace: 'pre-wrap',
          }}>
            {typeText}<span style={{ borderRight: `2px solid ${t.textMuted}`, marginLeft: '1px', animation: 'blink 1s step-end infinite' }} />
          </div>
        )}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          style={{
            width: '100%', minHeight: '98px', background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            fontSize: '14px', color: t.text, fontFamily: font,
            lineHeight: '1.6', boxSizing: 'border-box',
            paddingRight: '44px',
          }}
        />
        {/* Circle send button */}
        <button
          onClick={handleAnalyze}
          disabled={!prompt.trim()}
          style={{
            position: 'absolute', bottom: '12px', right: '12px',
            width: '36px', height: '36px', borderRadius: '50%', border: 'none',
            backgroundColor: prompt.trim() ? t.primary : t.borderDark,
            color: '#fff', cursor: prompt.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.2s', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );

  // ── Step: detected ────────────────────────────────────────────────────────
  if (step === 'detected') {
    const detectedCount = [extracted?.artist, extracted?.time, extracted?.location, extracted?.appearance?.length > 0].filter(Boolean).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px', color: t.dark, fontFamily: font }}>
            {detectedCount > 0 ? `Nice, I caught ${detectedCount} thing${detectedCount > 1 ? 's' : ''}` : 'Got your description'}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: t.textMuted, fontFamily: font }}>
            {detectedCount > 0 ? "Here's what I found — let's refine together" : "Let's fill in some details together"}
          </p>
        </div>

        <div style={{ backgroundColor: t.white, border: `1px solid ${t.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          {[
            extracted?.artist && { label: 'Artist', value: extracted.artist },
            extracted?.time && { label: 'Time', value: extracted.time },
            extracted?.location && { label: 'Location', value: extracted.location.replace(/_/g, ' ') },
          ].filter(Boolean).map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: font }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: t.success, fontSize: '12px' }}>✓</span>
                <span style={{ fontSize: '14px', color: t.dark, fontFamily: font, fontWeight: '500' }}>{value}</span>
              </div>
            </div>
          ))}

          {extracted?.appearance?.length > 0 && (
            <div style={{ padding: '12px 16px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: font, display: 'block', marginBottom: '8px' }}>Appearance</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {extracted.appearance.map(a => (
                  <span key={a} style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
                    backgroundColor: t.successBg, color: t.successDark,
                    border: `1px solid ${t.successBorder}`, fontFamily: font, fontWeight: '600',
                  }}>✓ {a}</span>
                ))}
              </div>
            </div>
          )}

          {detectedCount === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, fontFamily: font }}>No fields auto-detected — no worries, we'll add them together</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setStep('input')} style={{
            flex: 1, padding: '13px', borderRadius: '12px', border: `1px solid ${t.border}`,
            backgroundColor: t.white, cursor: 'pointer', fontSize: '14px',
            color: t.text, fontWeight: '500', fontFamily: font,
          }}>← Edit</button>
          <button onClick={() => go('time')} style={{
            flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
            backgroundColor: t.dark, cursor: 'pointer', fontSize: '14px',
            color: '#fff', fontWeight: '700', fontFamily: font,
          }}>Let's refine →</button>
        </div>
      </div>
    );
  }

  // ── Step: time ────────────────────────────────────────────────────────────
  if (step === 'time') return (
    <div>
      <StepHeader title="When did it happen?" sub="Approximate is totally fine" step={1} total={REFINE_TOTAL} />

      <div style={{ marginBottom: '20px' }}>
        <SectionLabel>Day</SectionLabel>
        <div style={{ display: 'flex', gap: '8px' }}>
          {DAY_OPTIONS.map(d => (
            <button key={d.value} onClick={() => setRefined(p => ({ ...p, day: p.day === d.value ? null : d.value }))} style={{
              flex: 1, padding: '11px 0', borderRadius: '10px', cursor: 'pointer',
              border: refined.day === d.value ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
              backgroundColor: refined.day === d.value ? t.primaryBg : t.white,
              fontSize: '14px', fontWeight: refined.day === d.value ? '700' : '400',
              color: refined.day === d.value ? t.primary : t.text, fontFamily: font,
            }}>{d.label}</button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Time of day</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {TIME_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setRefined(p => ({ ...p, time: p.time === opt.label ? null : opt.label }))} style={{
              padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
              border: refined.time === opt.label ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
              backgroundColor: refined.time === opt.label ? t.primaryBg : t.white,
              fontSize: '14px', color: refined.time === opt.label ? t.primary : t.text,
              fontWeight: refined.time === opt.label ? '700' : '400', fontFamily: font,
            }}>{opt.label}</button>
          ))}
        </div>
      </div>

      <NavButtons onNext={() => go('artist')} nextLabel="Next →" />
    </div>
  );

  // ── Step: artist ──────────────────────────────────────────────────────────
  if (step === 'artist') return (
    <div>
      <StepHeader title="What were you watching?" sub="Which artist or stage were you at?" step={2} total={REFINE_TOTAL} />

      <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '2px 0' }}>
        {PS_ARTISTS.filter(a => a !== 'Otro').slice().sort((a, b) => a.localeCompare(b)).map(a => (
          <Chip key={a} label={a} selected={refined.artist === a}
            onClick={() => setRefined(p => ({ ...p, artist: p.artist === a ? null : a }))} />
        ))}
      </div>

      <NavButtons onBack={() => go('time')} onNext={() => go('location')} nextLabel="Next →" />
    </div>
  );

  // ── Step: location ────────────────────────────────────────────────────────
  if (step === 'location') return (
    <div>
      <StepHeader title="Where were you?" sub="Where in the festival did you see them?" step={3} total={REFINE_TOTAL} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {LOCATION_OPTIONS.map(loc => (
          <button key={loc.value} onClick={() => setRefined(p => ({ ...p, location: p.location === loc.value ? null : loc.value }))} style={{
            padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
            border: refined.location === loc.value ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
            backgroundColor: refined.location === loc.value ? t.primaryBg : t.white,
            fontSize: '14px', color: refined.location === loc.value ? t.primary : t.text,
            fontWeight: refined.location === loc.value ? '700' : '400', fontFamily: font,
          }}>{loc.label}</button>
        ))}
      </div>

      <NavButtons onBack={() => go('artist')} onNext={() => go('appearance')} nextLabel="Next →" />
    </div>
  );

  // ── Step: appearance ──────────────────────────────────────────────────────
  if (step === 'appearance') return (
    <div>
      <StepHeader title="What did they look like?" sub="Select everything you remember — even vague hints help" step={4} total={REFINE_TOTAL} />

      {Object.entries(APPEARANCE_OPTIONS).map(([group, labels]) => (
        <div key={group} style={{ marginBottom: '18px' }}>
          <SectionLabel>{group}</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {labels.map(label => (
              <Chip key={label} label={label} selected={refined.appearance.includes(label)} onClick={() => toggleAppearance(label)} />
            ))}
          </div>
        </div>
      ))}

      <NavButtons onBack={() => go('location')} onNext={() => go('self')} nextLabel="Next →" />
    </div>
  );

  // ── Step: self ────────────────────────────────────────────────────────────
  if (step === 'self') return (
    <div>
      <StepHeader title="And a bit about you?" sub="So they can recognise you when we find a match" step={5} total={REFINE_TOTAL} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Gender */}
        <div>
          <SectionLabel>I am</SectionLabel>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Woman', 'Man', 'Non-binary'].map(g => (
              <button key={g} onClick={() => setRefined(p => ({ ...p, self_gender: p.self_gender === g ? null : g }))} style={{
                flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer',
                border: refined.self_gender === g ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                backgroundColor: refined.self_gender === g ? t.primaryBg : t.white,
                fontSize: '13px', fontWeight: refined.self_gender === g ? '700' : '400',
                color: refined.self_gender === g ? t.primary : t.text, fontFamily: font,
              }}>{g}</button>
            ))}
          </div>
        </div>

        {/* Age + Height */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <SectionLabel>Age</SectionLabel>
            <input type="number" placeholder="26" value={refined.self_age}
              onChange={e => setRefined(p => ({ ...p, self_age: e.target.value }))}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '10px',
                border: `1px solid ${t.border}`, fontSize: '15px', fontFamily: font,
                color: t.dark, backgroundColor: t.white, boxSizing: 'border-box', outline: 'none',
              }} />
          </div>
          <div style={{ flex: 1 }}>
            <SectionLabel>Height (m)</SectionLabel>
            <input type="text" placeholder="1.75" value={refined.self_height}
              onChange={e => setRefined(p => ({ ...p, self_height: e.target.value }))}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '10px',
                border: `1px solid ${t.border}`, fontSize: '15px', fontFamily: font,
                color: t.dark, backgroundColor: t.white, boxSizing: 'border-box', outline: 'none',
              }} />
          </div>
        </div>

        {/* Hair */}
        <div>
          <SectionLabel>My hair</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {['Black hair', 'Brown hair', 'Blonde hair', 'Red hair', 'Grey/White hair', 'Coloured hair', 'Shaved head', 'Short hair', 'Long hair', 'Curly hair'].map(h => (
              <Chip key={h} label={h} selected={refined.self_hair === h}
                onClick={() => setRefined(p => ({ ...p, self_hair: p.self_hair === h ? null : h }))} />
            ))}
          </div>
        </div>

        {/* Build */}
        <div>
          <SectionLabel>My build</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {['Very slim', 'Slim', 'Average build', 'Athletic', 'Muscular', 'Tall', 'Short'].map(b => (
              <Chip key={b} label={b} selected={refined.self_build === b}
                onClick={() => setRefined(p => ({ ...p, self_build: p.self_build === b ? null : b }))} />
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <SectionLabel>Visible on me</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {['Tattoos', 'Piercings', 'Glasses', 'Beard', 'Hat/Cap', 'Bold makeup', 'Large earrings'].map(f => (
              <Chip key={f} label={f} selected={refined.self_features.includes(f)} onClick={() => toggleSelfFeature(f)} />
            ))}
          </div>
        </div>

        {/* Outfit */}
        <div>
          <SectionLabel>What I was wearing (optional)</SectionLabel>
          <textarea
            placeholder="e.g. white linen shirt, black jeans, orange sneakers…"
            value={refined.self_clothing}
            onChange={e => setRefined(p => ({ ...p, self_clothing: e.target.value }))}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '12px',
              border: `1px solid ${t.border}`, fontSize: '14px', fontFamily: font,
              color: t.dark, backgroundColor: t.white, boxSizing: 'border-box',
              resize: 'none', minHeight: '72px', outline: 'none', lineHeight: '1.5',
            }}
          />
        </div>
      </div>

      <NavButtons onBack={() => go('appearance')} onNext={handleSubmit} nextLabel="Submit search" isLast />
    </div>
  );

  // ── Step: confirm ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '65vh', gap: '24px', textAlign: 'center' }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '24px',
        backgroundColor: t.successBg, border: `2px solid ${t.successBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 8px', color: t.dark, fontFamily: font }}>Your search is live!</h2>
        <p style={{ margin: '0 0 6px', fontSize: '14px', color: t.textSec, fontFamily: font, lineHeight: '1.6', maxWidth: '280px' }}>
          We're watching out for someone who matches your description.
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, fontFamily: font }}>
          If they're also searching, we'll connect you 🙌
        </p>
      </div>

      {/* Summary tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '300px' }}>
        {refined.artist && (
          <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}`, fontFamily: font, fontWeight: '600' }}>
            {refined.artist}
          </span>
        )}
        {refined.time && (
          <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: t.surface, color: t.textSec, border: `1px solid ${t.border}`, fontFamily: font }}>
            {refined.time}
          </span>
        )}
        {refined.location && (
          <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: t.surface, color: t.textSec, border: `1px solid ${t.border}`, fontFamily: font }}>
            {refined.location.replace(/_/g, ' ')}
          </span>
        )}
        {refined.appearance.slice(0, 3).map(a => (
          <span key={a} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: t.surface, color: t.textSec, border: `1px solid ${t.border}`, fontFamily: font }}>
            {a}
          </span>
        ))}
      </div>

      <button onClick={handleReset} style={{
        padding: '13px 32px', borderRadius: '12px', border: `1px solid ${t.border}`,
        backgroundColor: t.white, cursor: 'pointer', fontSize: '14px',
        color: t.text, fontWeight: '500', fontFamily: font,
      }}>+ New search</button>

    </div>
  );
}
