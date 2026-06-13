import React, { useState, useEffect, useMemo } from 'react';

const ARTISTS = [
  'Shlohmo', 'Rosalía', 'Björk', 'Carbón Silicio',
  'The Cure', 'LCD Soundsystem', 'Four Tet', 'Otro'
];

const LOCATIONS = [
  { value: 'main_stage', label: 'Main Stage' },
  { value: 'bar', label: 'Bar / Drinks Area' },
  { value: 'bathroom', label: 'Bathrooms' },
  { value: 'entrance', label: 'Entrance' },
  { value: 'vip', label: 'VIP Area' },
  { value: 'mosh_pit', label: 'Mosh Pit' },
  { value: 'general', label: 'General Area' },
  { value: 'other', label: 'Other' },
];

const DAYS = [
  { value: 'viernes', label: 'Fri' },
  { value: 'sabado', label: 'Sat' },
  { value: 'domingo', label: 'Sun' },
];

const TIME_PERIODS = [
  { value: 'mañana', label: 'Morning (10am–2pm)' },
  { value: 'tarde', label: 'Afternoon (2–6pm)' },
  { value: 'noche', label: 'Evening (6–10pm)' },
  { value: 'madrugada', label: 'Late night (10pm+)' },
];

const COMPANIONS = [
  { value: 'solo', label: 'Alone' },
  { value: 'pareja', label: 'With a partner' },
  { value: 'amigo_1', label: '1 friend' },
  { value: 'amigos_2_3', label: '2–3 friends' },
  { value: 'amigos_4plus', label: '4+ friends' },
];

const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary'];
const BUILD_OPTIONS = ['Very slim', 'Slim', 'Average', 'Athletic', 'Muscular'];
const HAIR_COLOR_OPTIONS = ['Black', 'Brown', 'Blonde', 'Red', 'Grey/White', 'Coloured', 'Shaved'];
const HAIR_LENGTH_OPTIONS = ['Shaved', 'Very short', 'Short', 'Medium', 'Long', 'Very long'];
const EYE_COLOR_OPTIONS = ['Brown', 'Green', 'Blue/Grey', 'Light', "Don't remember"];
const FEATURES_OPTIONS = ['Visible tattoos', 'Piercings', 'Glasses', 'Beard', 'Hat/Cap', 'Bold makeup', 'Large earrings'];

export const HEIGHT_RANGES = [
  { value: 'muy_baja', label: '< 1.55m', min: 0, max: 1.55 },
  { value: 'baja', label: '1.55–1.65m', min: 1.55, max: 1.65 },
  { value: 'media', label: '1.65–1.75m', min: 1.65, max: 1.75 },
  { value: 'alta', label: '1.75–1.85m', min: 1.75, max: 1.85 },
  { value: 'muy_alta', label: '> 1.85m', min: 1.85, max: 9 },
];

export const AGE_RANGES = [
  { value: 'menor_18', label: '< 18', min: 0, max: 18 },
  { value: '18_23', label: '18–23', min: 18, max: 23 },
  { value: '23_28', label: '23–28', min: 23, max: 28 },
  { value: '28_35', label: '28–35', min: 28, max: 35 },
  { value: '35_45', label: '35–45', min: 35, max: 45 },
  { value: 'mayor_45', label: '> 45', min: 45, max: 200 },
];

const INITIAL_DATA = {
  visibility: null,
  location_type: null,
  day: null,
  timePeriod: null,
  artist: null,
  artistCustom: '',
  description: '',

  // Otra persona — rangos aproximados
  other_gender: [],
  other_age_range: null,
  other_height_range: null,
  other_build: null,
  other_hair_color: [],
  other_hair_length: null,
  other_eye_color: null,
  other_features: [],
  other_clothing: '',

  // Yo mismo/a — valores exactos
  own_gender: null,
  own_age: '',
  own_height: '',
  own_build: null,
  own_hair_color: null,
  own_hair_length: null,
  own_eye_color: null,
  own_features: [],
  own_clothing: '',

  instagram: '',
  companions: null,
};

const STORAGE_KEY = 'fulmi_note_draft';

// ─── Primitive UI ──────────────────────────────────────────────────────────

const Tag = ({ label, selected, onClick }) => (
  <button onClick={onClick} style={{
    padding: '7px 14px', borderRadius: '999px',
    border: selected ? '2px solid #F7602E' : '1px solid #EDE8DF',
    backgroundColor: selected ? '#FFF0EB' : '#FFFFFF',
    cursor: 'pointer', fontSize: '13px',
    color: selected ? '#F7602E' : '#56524E',
    fontWeight: selected ? '600' : '400', transition: 'all 0.15s',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  }}>{label}</button>
);

const OptionButton = ({ label, selected, onClick, fullWidth }) => (
  <button onClick={onClick} style={{
    width: fullWidth ? '100%' : undefined,
    padding: '10px 14px', borderRadius: '10px',
    border: selected ? '2px solid #F7602E' : '1px solid #EDE8DF',
    backgroundColor: selected ? '#FFF0EB' : '#FFFFFF',
    cursor: 'pointer', textAlign: 'left',
    fontSize: '13px', color: selected ? '#F7602E' : '#1D1D2F',
    fontWeight: selected ? '600' : '400', transition: 'all 0.15s',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  }}>{label}</button>
);

const SectionLabel = ({ children }) => (
  <p style={{ fontSize: '11px', fontWeight: '600', color: '#9E9A93', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px 0', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
    {children}
  </p>
);

const FieldBlock = ({ label, children }) => (
  <div style={{ marginBottom: '20px' }}>
    <SectionLabel>{label}</SectionLabel>
    {children}
  </div>
);

const InlineGrid = ({ cols = 3, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '8px' }}>
    {children}
  </div>
);

const WrapRow = ({ children }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{children}</div>
);

const NumberInput = ({ value, onChange, placeholder, unit }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '90px', padding: '10px 12px', borderRadius: '10px',
        border: '1px solid #e0e0e0', fontSize: '16px', textAlign: 'center',
        fontWeight: '500', boxSizing: 'border-box'
      }}
    />
    {unit && <span style={{ fontSize: '13px', color: '#888' }}>{unit}</span>}
  </div>
);

const TypeCard = ({ emoji, title, desc, selected, bg, border, onClick }) => (
  <button onClick={onClick} style={{
    height: '90px', borderRadius: '14px', cursor: 'pointer',
    border: selected ? `2px solid ${border}` : '1px solid #EDE8DF',
    backgroundColor: selected ? bg : '#FFFFFF',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '3px', padding: '12px', transition: 'all 0.2s',
    boxShadow: selected ? 'none' : '0 1px 3px rgba(29,29,47,0.04)',
  }}>
    <span style={{ fontSize: '22px' }}>{emoji}</span>
    <span style={{ fontSize: '14px', fontWeight: '700', color: '#1D1D2F', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>{title}</span>
    <span style={{ fontSize: '11px', color: '#9E9A93', textAlign: 'center', lineHeight: '1.4', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>{desc}</span>
  </button>
);

// ─── Shared styles ─────────────────────────────────────────────────────────

const h2 = { fontSize: '18px', fontWeight: '700', color: '#1D1D2F', margin: '0 0 6px 0' };
const sub = { fontSize: '13px', color: '#9E9A93', margin: '0 0 20px 0' };
const textInputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1px solid #EDE8DF', fontSize: '14px',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  backgroundColor: '#FFFFFF', color: '#1D1D2F',
  boxSizing: 'border-box',
};

// ─── Main component ────────────────────────────────────────────────────────

const CreateNoteFlow = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // Merge with INITIAL_DATA so new fields always have their default value
      if (saved) return { ...INITIAL_DATA, ...JSON.parse(saved) };
    } catch {}
    return INITIAL_DATA;
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Steps: 0=tipo, 1=luogo, 2=ora, 3=artista, 4=otra persona, 5=yo mismo, 6=instagram, 7=texto
  const stepFlow = useMemo(() => {
    if (formData.visibility === 'targeted' || formData.visibility === 'private') return [0, 1, 2, 3, 4, 5, 6, 7];
    if (formData.visibility === 'public') return [0, 3, 7];
    return [0];
  }, [formData.visibility]);

  const currentStep = stepFlow[stepIndex];
  const isLastStep = stepIndex === stepFlow.length - 1;
  const progress = stepFlow.length > 1 ? stepIndex / (stepFlow.length - 1) : 0;
  const canSave = formData.description.trim().length > 0;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(formData)); } catch {}
  }, [formData]);

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const toggleTag = (field, value) =>
    setFormData(prev => {
      const arr = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      };
    });

  const transition = (fn) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 150);
  };

  const next = () => {
    if (stepIndex < stepFlow.length - 1) transition(() => setStepIndex(i => i + 1));
  };
  const prev = () => {
    if (stepIndex > 0) transition(() => setStepIndex(i => i - 1));
  };

  const handleTypeSelect = (type) => {
    update('visibility', type);
    transition(() => setStepIndex(1));
  };

  const handleSave = () => {
    if (!canSave) return;

    const timeStr = [formData.day, formData.timePeriod].filter(Boolean).join(' ') || null;
    const artistStr = formData.artist === 'Otro' ? (formData.artistCustom || null) : formData.artist;

    const otherDesc = JSON.stringify({
      gender: formData.other_gender,
      age_range: formData.other_age_range,
      height_range: formData.other_height_range,
      build: formData.other_build,
      hair_color: formData.other_hair_color,
      hair_length: formData.other_hair_length,
      eye_color: formData.other_eye_color,
      features: formData.other_features,
      clothing: formData.other_clothing,
    });

    const ownDesc = JSON.stringify({
      gender: formData.own_gender,
      age: formData.own_age,
      height: formData.own_height,
      build: formData.own_build,
      hair_color: formData.own_hair_color,
      hair_length: formData.own_hair_length,
      eye_color: formData.own_eye_color,
      features: formData.own_features,
      clothing: formData.own_clothing,
    });

    onSave({
      visibility: formData.visibility,
      location: formData.location_type,
      time: timeStr,
      artist: artistStr,
      description: formData.description,
      otherPersonDesc: otherDesc,
      ownDesc: ownDesc,
      instagram: formData.instagram || null,
      companions: formData.companions,
    });

    localStorage.removeItem(STORAGE_KEY);
    setFormData(INITIAL_DATA);
    setStepIndex(0);
  };

  // ─── Step renderers ──────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {

      case 0:
        return (
          <div>
            <h2 style={h2}>What kind of post?</h2>
            <p style={sub}>Choose how you want to share your moment</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TypeCard emoji="🔍" title="Targeted Search"
                desc="AI-matched. Only shown to users with high compatibility. Precise matching."
                selected={formData.visibility === 'targeted' || formData.visibility === 'private'}
                bg="#f1f8e9" border="#a5d6a7"
                onClick={() => handleTypeSelect('targeted')} />
              <TypeCard emoji="📣" title="Public Post"
                desc="Visible to everyone. Anyone can see it, like it, and connect."
                selected={formData.visibility === 'public'}
                bg="#f0f7ff" border="#90caf9"
                onClick={() => handleTypeSelect('public')} />
            </div>
          </div>
        );

      case 1:
        return (
          <div>
            <h2 style={h2}>Where did you see them?</h2>
            <p style={sub}>Select the closest location</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {LOCATIONS.map(loc => (
                <OptionButton key={loc.value} label={loc.label}
                  selected={formData.location_type === loc.value}
                  onClick={() => update('location_type', loc.value)} fullWidth />
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 style={h2}>When was it?</h2>
            <p style={sub}>Doesn't have to be exact</p>
            <FieldBlock label="Day">
              <div style={{ display: 'flex', gap: '8px' }}>
                {DAYS.map(d => (
                  <button key={d.value} onClick={() => update('day', d.value)} style={{
                    flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer',
                    border: formData.day === d.value ? '2px solid #F7602E' : '1px solid #EDE8DF',
                    backgroundColor: formData.day === d.value ? '#FFF0EB' : '#FFFFFF',
                    fontSize: '14px', fontWeight: formData.day === d.value ? '600' : '400',
                    color: formData.day === d.value ? '#F7602E' : '#1D1D2F',
                    transition: 'all 0.15s', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  }}>{d.label}</button>
                ))}
              </div>
            </FieldBlock>
            <FieldBlock label="Approximate time">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TIME_PERIODS.map(tp => (
                  <OptionButton key={tp.value} label={tp.label}
                    selected={formData.timePeriod === tp.value}
                    onClick={() => update('timePeriod', tp.value)} fullWidth />
                ))}
              </div>
            </FieldBlock>
          </div>
        );

      case 3:
        return (
          <div>
            <h2 style={h2}>What were you watching?</h2>
            <p style={sub}>{(formData.visibility === 'targeted' || formData.visibility === 'private') ? 'Greatly improves matching' : 'Optional'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {ARTISTS.map(artist => (
                <OptionButton key={artist} label={artist}
                  selected={formData.artist === artist}
                  onClick={() => update('artist', artist)} fullWidth />
              ))}
            </div>
            {formData.artist === 'Otro' && (
              <input type="text" placeholder="Which artist or activity?"
                value={formData.artistCustom} onChange={e => update('artistCustom', e.target.value)}
                autoFocus style={textInputStyle} />
            )}
          </div>
        );

      case 4:
        return (
          <div>
            <h2 style={h2}>Describe the person you saw</h2>
            <p style={sub}>Approximate values — more detail = better matching</p>

            <FieldBlock label="Gender">
              <WrapRow>
                {GENDER_OPTIONS.map(g => (
                  <Tag key={g} label={g} selected={formData.other_gender.includes(g)} onClick={() => toggleTag('other_gender', g)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Approximate age">
              <InlineGrid cols={3}>
                {AGE_RANGES.map(r => (
                  <OptionButton key={r.value} label={r.label}
                    selected={formData.other_age_range === r.value}
                    onClick={() => update('other_age_range', r.value)} />
                ))}
              </InlineGrid>
            </FieldBlock>

            <FieldBlock label="Approximate height">
              <InlineGrid cols={2}>
                {HEIGHT_RANGES.map(r => (
                  <OptionButton key={r.value} label={r.label}
                    selected={formData.other_height_range === r.value}
                    onClick={() => update('other_height_range', r.value)} />
                ))}
              </InlineGrid>
            </FieldBlock>

            <FieldBlock label="Build">
              <InlineGrid cols={2}>
                {BUILD_OPTIONS.map(b => (
                  <OptionButton key={b} label={b}
                    selected={formData.other_build === b}
                    onClick={() => update('other_build', b)} />
                ))}
              </InlineGrid>
            </FieldBlock>

            <FieldBlock label="Hair colour">
              <WrapRow>
                {HAIR_COLOR_OPTIONS.map(c => (
                  <Tag key={c} label={c} selected={formData.other_hair_color.includes(c)} onClick={() => toggleTag('other_hair_color', c)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Hair length">
              <InlineGrid cols={3}>
                {HAIR_LENGTH_OPTIONS.map(l => (
                  <OptionButton key={l} label={l}
                    selected={formData.other_hair_length === l}
                    onClick={() => update('other_hair_length', l)} />
                ))}
              </InlineGrid>
            </FieldBlock>

            <FieldBlock label="Eyes (if you remember)">
              <WrapRow>
                {EYE_COLOR_OPTIONS.map(c => (
                  <Tag key={c} label={c} selected={formData.other_eye_color === c} onClick={() => update('other_eye_color', c)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Visible features">
              <WrapRow>
                {FEATURES_OPTIONS.map(f => (
                  <Tag key={f} label={f} selected={formData.other_features.includes(f)} onClick={() => toggleTag('other_features', f)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Outfit (optional)">
              <textarea placeholder="What were they wearing..." value={formData.other_clothing}
                onChange={e => update('other_clothing', e.target.value)}
                style={{ ...textInputStyle, minHeight: '60px', resize: 'none' }} />
            </FieldBlock>
          </div>
        );

      case 5:
        return (
          <div>
            <h2 style={h2}>Describe yourself</h2>
            <p style={sub}>Exact values — helps them recognise you</p>

            <FieldBlock label="Gender">
              <WrapRow>
                {GENDER_OPTIONS.map(g => (
                  <Tag key={g} label={g} selected={formData.own_gender === g} onClick={() => update('own_gender', g)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Exact age">
              <NumberInput value={formData.own_age} onChange={v => update('own_age', v)} placeholder="26" unit="yrs" />
            </FieldBlock>

            <FieldBlock label="Exact height">
              <NumberInput value={formData.own_height} onChange={v => update('own_height', v)} placeholder="1.78" unit="m" />
            </FieldBlock>

            <FieldBlock label="Build">
              <InlineGrid cols={2}>
                {BUILD_OPTIONS.map(b => (
                  <OptionButton key={b} label={b}
                    selected={formData.own_build === b}
                    onClick={() => update('own_build', b)} />
                ))}
              </InlineGrid>
            </FieldBlock>

            <FieldBlock label="Hair colour">
              <WrapRow>
                {HAIR_COLOR_OPTIONS.map(c => (
                  <Tag key={c} label={c} selected={formData.own_hair_color === c} onClick={() => update('own_hair_color', c)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Hair length">
              <InlineGrid cols={3}>
                {HAIR_LENGTH_OPTIONS.map(l => (
                  <OptionButton key={l} label={l}
                    selected={formData.own_hair_length === l}
                    onClick={() => update('own_hair_length', l)} />
                ))}
              </InlineGrid>
            </FieldBlock>

            <FieldBlock label="Eyes">
              <WrapRow>
                {EYE_COLOR_OPTIONS.filter(c => c !== "Don't remember").map(c => (
                  <Tag key={c} label={c} selected={formData.own_eye_color === c} onClick={() => update('own_eye_color', c)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Visible features">
              <WrapRow>
                {FEATURES_OPTIONS.map(f => (
                  <Tag key={f} label={f} selected={formData.own_features.includes(f)} onClick={() => toggleTag('own_features', f)} />
                ))}
              </WrapRow>
            </FieldBlock>

            <FieldBlock label="Your outfit (optional)">
              <textarea placeholder="Clothes, colours, something distinctive..." value={formData.own_clothing}
                onChange={e => update('own_clothing', e.target.value)}
                style={{ ...textInputStyle, minHeight: '60px', resize: 'none' }} />
            </FieldBlock>
          </div>
        );

      case 6:
        return (
          <div>
            <h2 style={h2}>Your contact</h2>
            <p style={sub}>Only revealed on a mutual match</p>

            <div style={{ backgroundColor: '#FFF0EB', padding: '14px', borderRadius: '12px', border: '1px solid #FABB96', marginBottom: '20px' }}>
              <SectionLabel>📱 My Instagram (optional)</SectionLabel>
              <input type="text" placeholder="@username" value={formData.instagram}
                onChange={e => update('instagram', e.target.value)}
                style={{ ...textInputStyle, border: '1px solid #FABB96', backgroundColor: '#FFFFFF' }} />
              <p style={{ fontSize: '11px', color: '#F7602E', margin: '6px 0 0 0', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                💡 Only visible if you both say yes
              </p>
            </div>

            <FieldBlock label="Who were you with?">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {COMPANIONS.map(c => (
                  <OptionButton key={c.value} label={c.label}
                    selected={formData.companions === c.value}
                    onClick={() => update('companions', c.value)} fullWidth />
                ))}
              </div>
            </FieldBlock>
          </div>
        );

      case 7:
        return (
          <div>
            <h2 style={h2}>Write your post</h2>
            <p style={sub}>
              {formData.visibility === 'public'
                ? 'Share your story — what happened, where, how it felt...'
                : 'Describe what happened, what you felt...'}
            </p>
            <textarea
              placeholder={formData.visibility === 'public' ? 'I saw someone who caught my eye...' : 'I saw this person and...'}
              value={formData.description} onChange={e => update('description', e.target.value)}
              autoFocus style={{ ...textInputStyle, minHeight: '160px', resize: 'none', lineHeight: '1.6' }}
            />
            <p style={{ fontSize: '12px', color: '#999', margin: '8px 0 0 0' }}>
              💡 More details = better matching
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', zIndex: 1000
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', margin: '0 auto',
        backgroundColor: '#FEFBF6', borderRadius: '20px 20px 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#9E9A93', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              {formData.visibility ? `Step ${stepIndex + 1} of ${stepFlow.length}` : 'New post'}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9E9A93', padding: '4px', lineHeight: 1 }}>✕</button>
          </div>
          {formData.visibility && (
            <div style={{ height: '3px', backgroundColor: '#EDE8DF', borderRadius: '2px', marginBottom: '20px' }}>
              <div style={{
                height: '100%', width: `${progress * 100}%`,
                backgroundColor: (formData.visibility === 'targeted' || formData.visibility === 'private') ? '#24223B' : '#F7602E',
                borderRadius: '2px', transition: 'width 0.3s ease'
              }} />
            </div>
          )}
        </div>

        {/* Step content */}
        <div key={currentStep} style={{
          flex: 1, overflow: 'auto', padding: '0 20px 8px',
          opacity: visible ? 1 : 0, transition: 'opacity 0.15s ease'
        }}>
          {renderStep()}
        </div>

        {/* Bottom nav */}
        {currentStep !== 0 && (
          <div style={{ padding: '12px 20px 20px', flexShrink: 0, borderTop: `1px solid #EDE8DF` }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={prev} style={{
                flex: 1, padding: '13px', borderRadius: '12px',
                border: '1px solid #EDE8DF', backgroundColor: '#FEFBF6',
                cursor: 'pointer', fontSize: '14px', color: '#1D1D2F',
                fontWeight: '500', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}>← Back</button>
              {isLastStep ? (
                <button onClick={handleSave} disabled={!canSave} style={{
                  flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
                  backgroundColor: canSave ? '#F7602E' : '#DDD9D1',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  fontSize: '14px', color: '#FFFFFF', fontWeight: '700',
                  transition: 'background-color 0.2s',
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                }}>Save post ✓</button>
              ) : (
                <button onClick={next} style={{
                  flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
                  backgroundColor: '#1D1D2F', cursor: 'pointer',
                  fontSize: '14px', color: '#FFFFFF', fontWeight: '600',
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                }}>Next →</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateNoteFlow;
