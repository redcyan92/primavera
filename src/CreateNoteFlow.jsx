import React, { useState } from 'react';
import { PS_ARTISTS, TIME_OPTIONS, LOCATION_OPTIONS } from './defaultOptions';

const t = {
  primary: '#FF5B1B', primaryBg: '#FFF0EB', primaryBorder: '#FABB96',
  bg: '#FEFBF6', white: '#FFFFFF', surface: '#F7F5F2',
  dark: '#1D1D2F', border: '#EDE8DF', borderDark: '#DDD9D1',
  text: '#1D1D2F', textSec: '#56524E', textMuted: '#9E9A93',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const Chip = ({ label, selected, onClick }) => (
  <button onClick={onClick} style={{
    padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
    border: selected ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
    backgroundColor: selected ? t.primaryBg : t.white,
    fontSize: '12px', color: selected ? t.primary : t.textSec,
    fontWeight: selected ? '600' : '400', fontFamily: font,
    transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
  }}>{label}</button>
);

const SectionLabel = ({ children }) => (
  <p style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px', fontFamily: font }}>{children}</p>
);

const ProgressBar = ({ step, total }) => (
  <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{
        flex: 1, height: '3px', borderRadius: '2px',
        backgroundColor: i < step ? t.primary : t.border,
        transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
      }} />
    ))}
  </div>
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

const INITIAL = {
  visibility: null,
  artist: null,
  location: null,
  day: null,
  timePeriod: null,
  description: '',
  ownDesc: '',
  instagram: '',
};

export default function CreateNoteFlow({ isOpen, onClose, onSave, days = [] }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(INITIAL);

  if (!isOpen) return null;

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const handleClose = () => {
    setStep(0);
    setData(INITIAL);
    onClose();
  };

  const handleSubmit = () => {
    const time = [data.day, data.timePeriod].filter(Boolean).join(' ') || null;
    onSave({
      visibility: data.visibility,
      artist: data.artist,
      location: data.location,
      time,
      description: data.description.trim(),
      ownDesc: data.ownDesc.trim() || null,
      instagram: data.instagram.trim() || null,
    });
    handleClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100,
    }} onClick={handleClose}>
      <div style={{
        width: '100%', maxWidth: '380px', backgroundColor: t.white,
        borderRadius: '24px 24px 0 0', padding: '24px 20px 40px',
        maxHeight: '92svh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ width: '36px', height: '4px', backgroundColor: t.border, borderRadius: '2px', margin: '0 auto 20px' }} />

        {/* ── Step 0: Type ── */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px', color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>
              What do you want to do?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: t.textMuted, fontFamily: font }}>
              Choose how you want to use Otra right now.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { value: 'targeted', title: 'Find someone', sub: 'You saw someone at the festival and want to reconnect. Only shared with compatible people.' },
                { value: 'public', title: 'Share a moment', sub: 'Share a festival memory with everyone on the Crowd wall.' },
              ].map(({ value, title, sub }) => (
                <button key={value} onClick={() => { set('visibility', value); setStep(1); }} style={{
                  width: '100%', textAlign: 'left', padding: '18px 20px',
                  borderRadius: '16px', cursor: 'pointer',
                  border: `1.5px solid ${t.border}`, backgroundColor: t.white,
                  transition: 'border-color 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: t.dark, fontFamily: font }}>{title}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, fontFamily: font, lineHeight: '1.4' }}>{sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Artist + Location ── */}
        {step === 1 && (
          <div>
            <ProgressBar step={1} total={3} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>
                Artist & location
              </h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: '20px', lineHeight: 1, padding: '0 0 0 12px' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: t.textMuted, fontFamily: font }}>Both optional — skip if you're not sure.</p>

            <SectionLabel>Artist</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '30svh', overflowY: 'auto', marginBottom: '24px', padding: '2px 0' }}>
              {PS_ARTISTS.filter(a => a !== 'Otro').slice().sort((a, b) => a.localeCompare(b)).map(a => (
                <Chip key={a} label={a} selected={data.artist === a} onClick={() => set('artist', data.artist === a ? null : a)} />
              ))}
            </div>

            <SectionLabel>Location</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {LOCATION_OPTIONS.map(loc => (
                <button key={loc.value} onClick={() => set('location', data.location === loc.value ? null : loc.value)} style={{
                  padding: '11px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                  border: data.location === loc.value ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                  backgroundColor: data.location === loc.value ? t.primaryBg : t.white,
                  fontSize: '14px', color: data.location === loc.value ? t.primary : t.text,
                  fontWeight: data.location === loc.value ? '700' : '400', fontFamily: font,
                }}>{loc.label}</button>
              ))}
            </div>

            <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} />
          </div>
        )}

        {/* ── Step 2: Day + Time ── */}
        {step === 2 && (
          <div>
            <ProgressBar step={2} total={3} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>When?</h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: '20px', lineHeight: 1, padding: '0 0 0 12px' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: t.textMuted, fontFamily: font }}>Approximate is totally fine.</p>

            <SectionLabel>Day</SectionLabel>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {days.map(d => (
                <button key={d.value} onClick={() => set('day', data.day === d.value ? null : d.value)} style={{
                  flex: 1, padding: '11px 0', borderRadius: '10px', cursor: 'pointer',
                  border: data.day === d.value ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                  backgroundColor: data.day === d.value ? t.primaryBg : t.white,
                  fontSize: '14px', fontWeight: data.day === d.value ? '700' : '400',
                  color: data.day === d.value ? t.primary : t.text, fontFamily: font,
                }}>{d.label}</button>
              ))}
            </div>

            <SectionLabel>Time of day</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TIME_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => set('timePeriod', data.timePeriod === opt.value ? null : opt.value)} style={{
                  padding: '11px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                  border: data.timePeriod === opt.value ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                  backgroundColor: data.timePeriod === opt.value ? t.primaryBg : t.white,
                  fontSize: '14px', color: data.timePeriod === opt.value ? t.primary : t.text,
                  fontWeight: data.timePeriod === opt.value ? '700' : '400', fontFamily: font,
                }}>{opt.label}</button>
              ))}
            </div>

            <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {/* ── Step 3: Describe ── */}
        {step === 3 && (
          <div>
            <ProgressBar step={3} total={3} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>
                {data.visibility === 'targeted' ? 'Describe the moment' : 'Share your moment'}
              </h2>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: '20px', lineHeight: 1, padding: '0 0 0 12px' }}>✕</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: t.textMuted, fontFamily: font }}>
              {data.visibility === 'targeted' ? 'The more detail, the better the match.' : 'This will appear on the Crowd wall.'}
            </p>

            {data.visibility === 'targeted' ? (
              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>Describe the person you saw</SectionLabel>
                <textarea
                  value={data.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Tall, dark curly hair, was near the front during Four Tet, wearing a white shirt…"
                  style={{
                    width: '100%', minHeight: '100px', padding: '12px 14px',
                    borderRadius: '12px', border: `1px solid ${t.border}`,
                    fontSize: '14px', fontFamily: font, color: t.dark,
                    backgroundColor: t.white, resize: 'none', outline: 'none',
                    lineHeight: '1.55', boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <SectionLabel>What happened?</SectionLabel>
                <textarea
                  value={data.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="That moment when the crowd went completely silent… if you were there, you know 🧡"
                  style={{
                    width: '100%', minHeight: '120px', padding: '12px 14px',
                    borderRadius: '12px', border: `1px solid ${t.border}`,
                    fontSize: '14px', fontFamily: font, color: t.dark,
                    backgroundColor: t.white, resize: 'none', outline: 'none',
                    lineHeight: '1.55', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <SectionLabel>
                {data.visibility === 'targeted' ? 'Describe yourself' : 'About you (optional)'}
              </SectionLabel>
              <textarea
                value={data.ownDesc}
                onChange={e => set('ownDesc', e.target.value)}
                placeholder="e.g. I was wearing a red jacket, short brown hair, was with two friends…"
                style={{
                  width: '100%', minHeight: '80px', padding: '12px 14px',
                  borderRadius: '12px', border: `1px solid ${t.border}`,
                  fontSize: '14px', fontFamily: font, color: t.dark,
                  backgroundColor: t.white, resize: 'none', outline: 'none',
                  lineHeight: '1.55', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '4px' }}>
              <SectionLabel>Instagram / contact (optional)</SectionLabel>
              <input
                type="text"
                value={data.instagram}
                onChange={e => set('instagram', e.target.value)}
                placeholder="@your_instagram"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '12px',
                  border: `1px solid ${t.border}`, fontSize: '14px', fontFamily: font,
                  color: t.dark, backgroundColor: t.white, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <NavButtons
              onBack={() => setStep(2)}
              onNext={handleSubmit}
              nextLabel={data.visibility === 'targeted' ? 'Submit search' : 'Share'}
              nextEnabled={
                data.visibility === 'public'
                  ? !!data.description.trim()
                  : !!data.description.trim() && !!data.ownDesc.trim()
              }
              isLast
            />
          </div>
        )}
      </div>
    </div>
  );
}
