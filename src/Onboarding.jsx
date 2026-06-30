import React, { useState } from 'react';
import { radius } from './radius';

const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const healFont = "'HealTheWeb', system-ui, sans-serif";

const SLIDES = [
  {
    headline: 'Search for someone you met at the festival',
    body: 'You crossed paths. Describe the moment. Who you saw, where, when. Write it down. The system matches you only if they\'re searching too.',
    blobs: [
      { color: '#FF5B1B', x: '18%',  y: '12%', w: '65%', h: '48%' },
      { color: '#FF6A40', x: '78%',  y: '8%',  w: '60%', h: '44%' },
      { color: '#C090C8', x: '45%',  y: '40%', w: '50%', h: '38%' },
      { color: '#E8B0A0', x: '30%',  y: '55%', w: '40%', h: '30%' },
    ],
  },
  {
    headline: 'Share with the community',
    body: 'Share a festival moment that everyone sees. Anyone could recognize themselves and reach out. Your space to shout out to whoever was there.',
    blobs: [
      { color: '#5B2FD4', x: '50%',  y: '2%',  w: '75%', h: '55%' },
      { color: '#FF5B1B', x: '5%',   y: '28%', w: '38%', h: '55%' },
      { color: '#FF5B1B', x: '92%',  y: '22%', w: '38%', h: '50%' },
      { color: '#9070E0', x: '50%',  y: '52%', w: '55%', h: '30%' },
    ],
  },
  {
    headline: 'Swap contacts with your connections',
    body: 'When both of you were searching and the system found a match, you can share your Instagram or WhatsApp and keep the conversation going.',
    blobs: [
      { color: '#6B3FD4', x: '55%',  y: '-2%', w: '85%', h: '60%' },
      { color: '#FF5B1B', x: '28%',  y: '32%', w: '32%', h: '38%' },
      { color: '#FF5B1B', x: '58%',  y: '22%', w: '26%', h: '32%' },
      { color: '#FF8060', x: '14%',  y: '52%', w: '28%', h: '26%' },
      { color: '#FFFFFF', x: '35%',  y: '30%', w: '20%', h: '20%', opacity: 0.55 },
    ],
  },
];

const BlobBg = ({ blobs }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    {blobs.map((b, i) => (
      <div key={i} style={{
        position: 'absolute',
        left: b.x, top: b.y,
        width: b.w, height: b.h,
        backgroundColor: b.color,
        borderRadius: radius.circle,
        filter: 'blur(52px)',
        transform: 'translate(-50%, -50%)',
        opacity: b.opacity ?? 1,
      }} />
    ))}
    {/* Fade bottom half to cream */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to bottom, transparent 35%, #EDE8DF 68%)',
    }} />
  </div>
);

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
      backgroundColor: '#EDE8DF',
      display: 'flex', flexDirection: 'column',
      fontFamily: font,
      overflow: 'hidden',
      maxWidth: '380px', margin: '0 auto',
    }}>
      <BlobBg blobs={slide.blobs} />

      {/* Skip */}
      {!isLast && (
        <button onClick={onComplete} style={{
          position: 'absolute', top: '52px', right: '20px',
          background: 'rgba(255,255,255,0.25)', border: 'none',
          borderRadius: radius.xl, padding: '6px 14px',
          color: 'rgba(30,20,10,0.55)', fontSize: '13px',
          fontWeight: '500', cursor: 'pointer', fontFamily: font,
          backdropFilter: 'blur(8px)', zIndex: 10,
        }}>Skip</button>
      )}

      {/* Content anchored to bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 24px 48px', zIndex: 5,
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              height: '4px',
              width: i === current ? '28px' : '8px',
              borderRadius: radius.xs,
              backgroundColor: i === current ? '#FF5B1B' : 'rgba(29,29,47,0.20)',
              transition: 'width 0.3s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            }} />
          ))}
        </div>

        {/* Headline */}
        <h1 style={{
          margin: '0 0 12px',
          fontSize: '28px', fontWeight: '700', lineHeight: '1.2',
          color: '#1D1D2F', fontFamily: healFont, letterSpacing: '0.01em',
        }}>{slide.headline}</h1>

        {/* Body */}
        <p style={{
          margin: '0 0 32px',
          fontSize: '14px', lineHeight: '1.65',
          color: '#56524E', fontWeight: '400',
        }}>{slide.body}</p>

        {/* CTA */}
        <button onClick={next} style={{
          width: '100%', padding: '16px', border: 'none',
          backgroundColor: '#1D1D2F', borderRadius: radius.lg,
          color: '#FFFFFF', fontSize: '16px', fontWeight: '700',
          cursor: 'pointer', fontFamily: font,
        }}>
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
