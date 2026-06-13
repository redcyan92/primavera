import React, { useState } from 'react';

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const SLIDES = [
  {
    label: 'That Moment is Gone',
    headline: 'You connected at the festival. Now find them.',
    body: 'Write a targeted post: where you saw them, when, how you looked, what you remember. AI will match it with compatible users. Find that person.',
    gradient: 'linear-gradient(180deg, rgba(18,14,10,0.10) 0%, rgba(18,14,10,0.45) 40%, rgba(18,14,10,0.92) 100%)',
    bg: 'linear-gradient(160deg, #2a1a0e 0%, #3d2210 30%, #1a100a 100%)',
    accent: '#F7602E',
  },
  {
    label: 'Public Shout Out',
    headline: 'Or leave a post on a public board',
    body: 'Share a festival moment. Everyone sees it. Anyone could recognize themselves and connect with you. It\'s your space to shout that moment to whoever was there.',
    gradient: 'linear-gradient(180deg, rgba(10,14,18,0.08) 0%, rgba(10,14,18,0.50) 40%, rgba(10,14,18,0.93) 100%)',
    bg: 'linear-gradient(160deg, #0d1a14 0%, #122012 30%, #080e08 100%)',
    accent: '#F7602E',
  },
  {
    label: 'Meet IRL',
    headline: 'Match = contacts revealed. Done.',
    body: 'If you both say yes, swap Instagram or WhatsApp. No chat apps, no endless small talk. You meet in person. The magic is there, not on screen.',
    gradient: 'linear-gradient(180deg, rgba(14,10,18,0.05) 0%, rgba(14,10,18,0.48) 38%, rgba(14,10,18,0.92) 100%)',
    bg: 'linear-gradient(160deg, #18101e 0%, #221030 30%, #0e090e 100%)',
    accent: '#F7602E',
  },
];

/* Decorative SVG crowd silhouette — adds festival atmosphere without photos */
const CrowdScene = ({ index }) => {
  if (index === 0) return (
    <svg viewBox="0 0 390 480" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '60%', objectFit: 'cover' }}>
      {/* warm stage glow */}
      <defs>
        <radialGradient id="glow0" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#F7602E" stopOpacity="0.55"/>
          <stop offset="60%" stopColor="#c03a10" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#1a0a04" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="spot0" cx="50%" cy="20%" r="30%">
          <stop offset="0%" stopColor="#FFCBA4" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#F7602E" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="390" height="480" fill="#1a100a"/>
      <ellipse cx="195" cy="160" rx="180" ry="130" fill="url(#glow0)"/>
      <ellipse cx="195" cy="90" rx="80" ry="60" fill="url(#spot0)"/>
      {/* crowd silhouette */}
      <path d="M0 480 L0 340 Q20 320 40 335 Q55 290 70 310 Q82 270 95 295 Q108 260 120 280 Q130 245 145 268 Q158 240 170 260 Q182 235 195 255 Q208 235 220 258 Q233 240 245 262 Q258 245 270 268 Q283 248 295 270 Q308 260 320 278 Q332 258 345 280 Q358 270 372 292 Q382 315 390 330 L390 480 Z" fill="#0d0806"/>
      <path d="M0 480 L0 370 Q15 355 28 365 Q40 345 52 358 Q65 340 78 352 Q90 335 102 348 Q115 332 128 344 Q140 328 152 342 Q165 330 175 342 Q185 326 198 340 Q210 328 222 342 Q233 328 246 342 Q258 330 270 344 Q283 332 296 346 Q308 334 320 348 Q333 338 345 352 Q358 343 370 355 Q382 362 390 370 L390 480 Z" fill="#120c08"/>
      {/* light rays */}
      <line x1="195" y1="0" x2="80" y2="340" stroke="#F7602E" strokeOpacity="0.06" strokeWidth="40"/>
      <line x1="195" y1="0" x2="195" y2="350" stroke="#FFCBA4" strokeOpacity="0.09" strokeWidth="30"/>
      <line x1="195" y1="0" x2="310" y2="340" stroke="#F7602E" strokeOpacity="0.06" strokeWidth="40"/>
    </svg>
  );

  if (index === 1) return (
    <svg viewBox="0 0 390 480" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '60%', objectFit: 'cover' }}>
      <defs>
        <radialGradient id="glow1" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#48FF91" stopOpacity="0.25"/>
          <stop offset="50%" stopColor="#1aad5a" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#080e08" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="spot1" cx="50%" cy="15%" r="25%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30"/>
          <stop offset="100%" stopColor="#48FF91" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="390" height="480" fill="#080e08"/>
      <ellipse cx="195" cy="140" rx="180" ry="120" fill="url(#glow1)"/>
      <ellipse cx="195" cy="70" rx="70" ry="50" fill="url(#spot1)"/>
      {/* person with raised fist */}
      <path d="M175 200 Q185 170 195 160 Q205 170 215 200 Q225 240 220 290 L170 290 Q165 240 175 200Z" fill="#0a0f0a"/>
      <circle cx="195" cy="148" r="14" fill="#0a0f0a"/>
      {/* raised arm */}
      <path d="M185 200 Q170 175 160 155 Q155 140 165 138 Q172 136 175 148 Q178 162 188 178Z" fill="#0a0f0a"/>
      <circle cx="161" cy="135" r="8" fill="#0a0f0a"/>
      {/* crowd */}
      <path d="M0 480 L0 360 Q25 340 50 355 Q70 330 90 345 Q108 320 125 338 Q142 315 158 330 Q170 310 183 326 Q192 308 205 324 Q215 310 228 326 Q242 314 255 330 Q268 315 282 332 Q295 318 308 336 Q322 322 336 340 Q350 328 365 345 Q378 352 390 360 L390 480 Z" fill="#060c06"/>
      <path d="M0 480 L0 390 Q18 378 35 388 Q50 372 65 382 Q80 370 95 380 Q108 368 120 378 Q135 366 148 376 Q160 366 174 376 Q185 364 198 374 Q210 364 224 376 Q237 366 250 378 Q264 368 278 380 Q292 370 306 382 Q320 372 334 384 Q348 375 362 386 Q376 378 390 388 L390 480 Z" fill="#0a100a"/>
      {/* confetti dots */}
      <circle cx="100" cy="120" r="3" fill="#F7602E" opacity="0.7"/>
      <circle cx="280" cy="90" r="2.5" fill="#FFCBA4" opacity="0.6"/>
      <circle cx="150" cy="80" r="2" fill="#48FF91" opacity="0.5"/>
      <circle cx="320" cy="130" r="3" fill="#F7602E" opacity="0.5"/>
      <circle cx="60" cy="100" r="2" fill="#FFCBA4" opacity="0.4"/>
      <circle cx="240" cy="110" r="2.5" fill="#48FF91" opacity="0.4"/>
    </svg>
  );

  return (
    <svg viewBox="0 0 390 480" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '60%', objectFit: 'cover' }}>
      <defs>
        <radialGradient id="glow2" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#C084FC" stopOpacity="0.30"/>
          <stop offset="55%" stopColor="#7c3aed" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#0e090e" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="warm2" cx="50%" cy="20%" r="40%">
          <stop offset="0%" stopColor="#F7602E" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#F7602E" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="390" height="480" fill="#0e090e"/>
      <ellipse cx="195" cy="220" rx="200" ry="180" fill="url(#glow2)"/>
      <ellipse cx="195" cy="100" rx="100" ry="80" fill="url(#warm2)"/>
      {/* two people facing each other */}
      {/* person left */}
      <circle cx="140" cy="165" r="20" fill="#130d17"/>
      <path d="M115 210 Q128 190 140 188 Q152 190 165 210 Q172 240 168 300 L112 300 Q108 240 115 210Z" fill="#130d17"/>
      {/* person right */}
      <circle cx="250" cy="165" r="20" fill="#130d17"/>
      <path d="M225 210 Q238 190 250 188 Q262 190 275 210 Q282 240 278 300 L222 300 Q218 240 225 210Z" fill="#130d17"/>
      {/* subtle glow between them */}
      <ellipse cx="195" cy="200" rx="30" ry="40" fill="#F7602E" opacity="0.06"/>
      {/* crowd behind */}
      <path d="M0 480 L0 350 Q20 334 40 346 Q55 322 72 338 Q88 314 104 330 Q118 308 133 324 Q146 302 160 320 Q172 300 184 316 Q192 298 205 314 Q216 298 228 316 Q242 302 256 320 Q270 306 284 324 Q298 310 312 328 Q326 314 340 332 Q355 322 370 338 Q380 344 390 350 L390 480 Z" fill="#0c080e"/>
      <path d="M0 480 L0 385 Q15 374 30 383 Q45 368 60 378 Q74 366 88 376 Q102 365 116 375 Q129 364 142 374 Q155 363 168 374 Q180 362 194 374 Q207 362 220 374 Q234 364 248 376 Q262 365 276 376 Q290 366 304 378 Q318 368 332 380 Q347 370 361 382 Q375 374 390 384 L390 480 Z" fill="#100c12"/>
    </svg>
  );
};

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const next = () => {
    if (isLast) onComplete();
    else setCurrent(c => c + 1);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: slide.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: font,
      overflow: 'hidden',
      transition: 'background 0.5s ease',
    }}>
      {/* Background illustration */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <CrowdScene index={current} />
        {/* gradient overlay fading to dark at bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: slide.gradient,
        }}/>
      </div>

      {/* Skip button */}
      {!isLast && (
        <button
          onClick={onComplete}
          style={{
            position: 'absolute', top: '52px', right: '20px',
            background: 'rgba(255,255,255,0.12)', border: 'none',
            borderRadius: '20px', padding: '6px 14px',
            color: 'rgba(255,255,255,0.7)', fontSize: '13px',
            fontWeight: '500', cursor: 'pointer', fontFamily: font,
            backdropFilter: 'blur(8px)',
            zIndex: 10,
          }}
        >Skip</button>
      )}

      {/* Content — anchored to bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 28px 48px',
        zIndex: 5,
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              height: '5px',
              width: i === current ? '28px' : '8px',
              borderRadius: '3px',
              backgroundColor: i === current ? '#F7602E' : 'rgba(255,255,255,0.30)',
              transition: 'width 0.3s ease, background-color 0.3s ease',
            }}/>
          ))}
        </div>

        {/* Label */}
        <p style={{
          margin: '0 0 10px',
          fontSize: '12px', fontWeight: '600',
          color: 'rgba(255,255,255,0.55)',
          textTransform: 'uppercase', letterSpacing: '0.09em',
        }}>{slide.label}</p>

        {/* Headline */}
        <h1 style={{
          margin: '0 0 16px',
          fontSize: '28px', fontWeight: '700', lineHeight: '1.25',
          color: '#FFFFFF',
        }}>{slide.headline}</h1>

        {/* Body */}
        <p style={{
          margin: '0 0 36px',
          fontSize: '14px', lineHeight: '1.65',
          color: 'rgba(255,255,255,0.65)',
          fontWeight: '400',
        }}>{slide.body}</p>

        {/* CTA buttons */}
        {isLast ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onComplete} style={{
              flex: 2,
              padding: '16px', border: 'none',
              backgroundColor: '#F7602E', borderRadius: '50px',
              color: '#FFFFFF', fontSize: '16px', fontWeight: '700',
              cursor: 'pointer', fontFamily: font,
              boxShadow: '0 6px 20px rgba(247,96,46,0.45)',
            }}>Get Started</button>
            <button onClick={onComplete} style={{
              flex: 1,
              padding: '16px', border: '1.5px solid rgba(255,255,255,0.35)',
              backgroundColor: 'transparent', borderRadius: '50px',
              color: '#F7602E', fontSize: '16px', fontWeight: '600',
              cursor: 'pointer', fontFamily: font,
              backdropFilter: 'blur(8px)',
            }}>Sign In</button>
          </div>
        ) : (
          <button onClick={next} style={{
            width: '100%',
            padding: '16px', border: 'none',
            backgroundColor: '#F7602E', borderRadius: '50px',
            color: '#FFFFFF', fontSize: '16px', fontWeight: '700',
            cursor: 'pointer', fontFamily: font,
            boxShadow: '0 6px 20px rgba(247,96,46,0.45)',
          }}>Next</button>
        )}
      </div>
    </div>
  );
}
