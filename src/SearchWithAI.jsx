import React, { useState, useEffect, useRef } from 'react';
import { extractFields } from './extractFields';
import { TIME_OPTIONS, LOCATION_OPTIONS } from './defaultOptions';

const t = {
  primary: '#FF5B1B', primaryLight: '#FAA284', primaryBg: '#FFF0EB',
  primaryBorder: '#FABB96', bg: '#FEFBF6', white: '#FFFFFF',
  surface: '#F7F5F2', dark: '#1D1D2F', border: '#EDE8DF',
  borderDark: '#DDD9D1', text: '#1D1D2F', textSec: '#56524E',
  textMuted: '#9E9A93', success: '#05C270', successBg: '#E6FAF2',
  successBorder: '#A8E6CF', successDark: '#036B42',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const Chip = ({ label, selected, onClick }) => (
  <button onClick={onClick} style={{
    padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
    border: selected ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
    backgroundColor: selected ? t.primaryBg : t.white,
    fontSize: '12px', color: selected ? t.primary : t.textSec,
    fontWeight: selected ? '600' : '400', fontFamily: font,
    transition: 'background-color 0.15s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.15s cubic-bezier(0.23, 1, 0.32, 1), color 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
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
      transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
    }}>{nextLabel}</button>
  </div>
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
  </div>
);

const StepHeader = ({ title, sub, step, total, onExit }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      {total && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', flex: 1 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              backgroundColor: i < step ? t.primary : t.border,
              transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
            }} />
          ))}
        </div>
      )}
      {onExit && (
        <button onClick={onExit} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.textMuted, fontSize: '20px', lineHeight: 1,
          padding: '0 0 0 12px', flexShrink: 0,
        }}>✕</button>
      )}
    </div>
    <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px', color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em' }}>{title}</h2>
    {sub && <p style={{ margin: 0, fontSize: '14px', color: t.textMuted, fontFamily: font, lineHeight: '1.5' }}>{sub}</p>}
  </div>
);

const REFINE_STEPS = ['time', 'artist', 'location', 'self'];
const REFINE_TOTAL = REFINE_STEPS.length;

function getSearchState(suggestedMatches, confirmedMatches) {
  if (!suggestedMatches || suggestedMatches.length === 0) return 'searching';
  const visible = suggestedMatches.filter(m => m.userResponse !== 'no');
  if (visible.length === 0) return 'searching';
  const confirmed = visible.find(m => confirmedMatches?.some(cm => cm.note?.id === m.id));
  if (confirmed) return 'connected';
  if (visible.some(m => m.userResponse === 'yes')) return 'requested';
  if (visible.some(m => m.theyAlreadyRequested)) return 'they_want';
  return 'match_found';
}

const STATE_LABELS = {
  searching:   { label: 'Searching…',      color: '#9E9A93', bg: '#F7F5F2', border: '#EDE8DF' },
  match_found: { label: 'Match found!',    color: '#FF5B1B', bg: '#FFF0EB', border: '#FABB96' },
  they_want:   { label: 'They want you!',  color: '#FF5B1B', bg: '#FFF0EB', border: '#FF5B1B' },
  requested:   { label: 'Request sent',    color: '#9E9A93', bg: '#F7F5F2', border: '#EDE8DF' },
  connected:   { label: 'Connected ✓',     color: '#036B42', bg: '#E6FAF2', border: '#A8E6CF' },
};

export default function SearchWithAI({ onSave, artists = [], days = [], mySearches = [], suggestedMatches = [], confirmedMatches = [], onNavigateToConnections }) {
  const [step, setStep] = useState('input');
  const [prompt, setPrompt] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [refined, setRefined] = useState({
    artist: null, time: null, location: null, day: null, ownDesc: '',
  });

  const go = (nextStep, delay = 900) => {
    setStep('loading');
    setTimeout(() => setStep(nextStep), delay);
  };

  const handleAnalyze = () => {
    if (!prompt.trim()) return;
    setStep('loading');
    setTimeout(() => {
      const fields = extractFields(prompt, artists);
      setExtracted(fields);
      setRefined(prev => ({
        ...prev,
        artist: fields.artist || null,
        time: fields.time || null,
        location: fields.location || null,
        day: fields.day || null,
      }));
      setStep('time');
    }, 700);
  };

  const handleSubmit = () => {
    const timeStr = [refined.day, refined.time].filter(Boolean).join(' ') || null;
    onSave({
      visibility: 'targeted',
      location: refined.location,
      time: timeStr,
      artist: refined.artist,
      description: prompt,
      ownDesc: refined.ownDesc.trim() || null,
      instagram: null,
    });
    go('confirm', 500);
  };

  const handleReset = () => {
    setStep('input');
    setPrompt('');
    setExtracted(null);
    setRefined({ artist: null, time: null, location: null, day: null, ownDesc: '' });
  };

  // ── Typewriter placeholder ────────────────────────────────────────────────
  const EXAMPLES = [
    'tall girl with dark curly hair, was at Bicep around midnight near the front…',
    'chico con gorra verde cerca del bar durante Rosalía, tatuajes en los brazos…',
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

  if (step === 'loading') return <LoadingScreen message="On it…" sub="Reading between the lines" />;

  // ── Step: input ───────────────────────────────────────────────────────────
  if (step === 'input') return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        minHeight: 'calc(62svh)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '24px',
      }}>
        <span style={{
          fontSize: '11px', padding: '5px 12px', borderRadius: '999px',
          backgroundColor: t.primaryBg, color: t.primary, border: `1px solid ${t.primaryBorder}`,
          fontFamily: font,
        }}>
          <span style={{ fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI Search</span>
          <span style={{ fontWeight: '400', margin: '0 4px' }}>&middot;</span>
          <span style={{ fontWeight: '400' }}>Find your missed connection</span>
        </span>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 8px', color: t.dark, letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>
            Who did you vibe with?
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: t.textMuted, fontFamily: font, lineHeight: '1.6', maxWidth: '300px' }}>
            Tell me anything you remember — the more detail, the better the match.
          </p>
        </div>

        <div style={{
          width: '100%', backgroundColor: t.white, border: `1px solid ${t.primaryBorder}`,
          borderRadius: '16px', padding: '14px 14px 10px',
          boxShadow: `0 0 0 5px rgba(255,91,27,0.07), 0 0 20px 6px rgba(255,91,27,0.10), 0 1px 4px rgba(29,29,47,0.05)`, position: 'relative',
        }}>
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
          {/* Visibility indicator — bottom left */}
          <div style={{ position: 'absolute', bottom: '14px', left: '14px', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>Compatible only</span>
          </div>
          {/* Send button — bottom right */}
          <button
            onClick={handleAnalyze}
            disabled={!prompt.trim()}
            style={{
              position: 'absolute', bottom: '12px', right: '12px',
              width: '36px', height: '36px', borderRadius: '50%', border: 'none',
              backgroundColor: prompt.trim() ? t.primary : t.borderDark,
              color: '#fff', cursor: prompt.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {mySearches.length > 0 && (
        <div style={{ width: '100%', marginTop: '40px' }}>
          <h3 style={{
            fontSize: '15px', fontWeight: '700', margin: '0 0 16px',
            color: t.dark, fontFamily: font, textAlign: 'center',
          }}>My Searches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mySearches.map(note => {
              const state = getSearchState(suggestedMatches, confirmedMatches);
              const stateStyle = STATE_LABELS[state];
              const metaParts = [
                note.location && note.location.replace(/_/g, ' '),
                note.time,
                note.artist && note.artist !== 'Otro' ? note.artist : null,
              ].filter(Boolean);
              return (
                <button
                  key={note.id}
                  onClick={onNavigateToConnections}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF',
                    borderRadius: '14px', padding: '14px',
                    boxShadow: '0 1px 3px rgba(29,29,47,0.05)',
                    fontFamily: font,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: metaParts.length > 0 ? '10px' : '0' }}>
                    {metaParts.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                        {metaParts.map((m, i) => (
                          <span key={i} style={{
                            fontSize: '10px', color: t.textMuted, backgroundColor: t.surface,
                            borderRadius: '6px', padding: '3px 8px', textTransform: 'capitalize',
                          }}>{m}</span>
                        ))}
                      </div>
                    )}
                    <span style={{
                      fontSize: '10px', fontWeight: '700', padding: '3px 9px',
                      borderRadius: '999px', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0,
                      color: stateStyle.color, backgroundColor: stateStyle.bg, border: `1px solid ${stateStyle.border}`,
                    }}>{stateStyle.label}</span>
                  </div>
                  <p style={{ fontSize: '14px', color: t.text, margin: 0, lineHeight: '1.6' }}>
                    {note.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ height: '40px' }} />
    </div>
  );

  // ── Step: time ────────────────────────────────────────────────────────────
  if (step === 'time') return (
    <div>
      <StepHeader title="When did it happen?" sub="Approximate is totally fine" step={1} total={REFINE_TOTAL} onExit={handleReset} />

      <div style={{ marginBottom: '20px' }}>
        <SectionLabel>Day</SectionLabel>
        <div style={{ display: 'flex', gap: '8px' }}>
          {days.map(d => (
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

      <NavButtons onBack={() => setStep('input')} onNext={() => go('artist')} nextLabel="Next →" />
    </div>
  );

  // ── Step: artist ──────────────────────────────────────────────────────────
  if (step === 'artist') return (
    <div>
      <StepHeader title="What were you watching?" sub="Which artist or stage were you at?" step={2} total={REFINE_TOTAL} onExit={handleReset} />

      <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '2px 0' }}>
        {artists.filter(a => a !== 'Otro').slice().sort((a, b) => a.localeCompare(b)).map(a => (
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
      <StepHeader title="Where were you?" sub="Where in the festival did you see them?" step={3} total={REFINE_TOTAL} onExit={handleReset} />

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

      <NavButtons onBack={() => go('artist')} onNext={() => go('self')} nextLabel="Next →" />
    </div>
  );

  // ── Step: self ────────────────────────────────────────────────────────────
  if (step === 'self') return (
    <div>
      <StepHeader title="And a bit about you?" sub="So they can recognise you when we find a match" step={4} total={REFINE_TOTAL} onExit={handleReset} />

      <SectionLabel>Describe yourself</SectionLabel>
      <textarea
        value={refined.ownDesc}
        onChange={e => setRefined(p => ({ ...p, ownDesc: e.target.value }))}
        placeholder="e.g. I was wearing a red jacket, short brown hair, was with two friends near the bar…"
        style={{
          width: '100%', minHeight: '120px', padding: '12px 14px',
          borderRadius: '12px', border: `1px solid ${t.border}`,
          fontSize: '14px', fontFamily: font, color: t.dark,
          backgroundColor: t.white, resize: 'none', outline: 'none',
          lineHeight: '1.55', boxSizing: 'border-box',
        }}
      />

      <NavButtons
        onBack={() => go('location')}
        onNext={handleSubmit}
        nextLabel="Submit search"
        nextEnabled={!!refined.ownDesc.trim()}
        isLast
      />
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
      </div>

      <button onClick={handleReset} style={{
        padding: '13px 32px', borderRadius: '12px', border: `1px solid ${t.border}`,
        backgroundColor: t.white, cursor: 'pointer', fontSize: '14px',
        color: t.text, fontWeight: '500', fontFamily: font,
      }}>+ New search</button>
    </div>
  );
}
