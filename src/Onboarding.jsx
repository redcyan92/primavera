import React, { useState, useRef } from 'react';
import { radius } from './radius';

const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const healFont = "'HealTheWeb', system-ui, sans-serif";

const SLIDES = [
  {
    headline: 'Search for someone you met at the festival',
    body: 'You crossed paths. Describe the moment. Who you saw, where, when. Write it down. The system matches you only if they\'re searching too.',
  },
  {
    headline: 'Share with the community',
    body: 'Share a festival moment that everyone sees. Anyone could recognize themselves and reach out. Your space to shout out to whoever was there.',
  },
  {
    headline: 'Swap contacts with your connections',
    body: 'When both of you were searching and the system found a match, you can share your Instagram or WhatsApp and keep the conversation going.',
  },
];

export default function Onboarding({ onComplete, onBack }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const next = () => {
    if (isLast) onComplete();
    else setCurrent(c => c + 1);
  };

  const prev = () => {
    if (current > 0) setCurrent(c => c - 1);
    else if (onBack) onBack();
  };

  const onTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff > 50) prev();
    else if (diff < -50) next();
    touchStartX.current = null;
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: '#F8FAFB',
        display: 'flex', flexDirection: 'column',
        fontFamily: font,
        overflow: 'hidden',
        maxWidth: '380px', margin: '0 auto',
      }}
    >
      {/* Skip */}
      {!isLast && (
        <button onClick={onComplete} style={{
          position: 'absolute', top: '52px', right: '20px',
          background: 'none', border: '1px solid #E6E8EC',
          borderRadius: radius.xl, padding: '6px 14px',
          color: '#9E9A93', fontSize: '13px',
          fontWeight: '500', cursor: 'pointer', fontFamily: font,
          zIndex: 10,
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
              backgroundColor: i === current ? '#B50BF2' : 'rgba(29,29,47,0.15)',
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

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {current > 0 && (
            <button onClick={prev} style={{
              flex: 1, padding: '16px', border: 'none',
              backgroundColor: '#F2F3F6', borderRadius: radius.lg,
              color: '#1D1D2F', fontSize: '16px', fontWeight: '600',
              cursor: 'pointer', fontFamily: font,
            }}>← Back</button>
          )}
          <button onClick={next} style={{
            flex: current > 0 ? 2 : 1, padding: '16px', border: 'none',
            backgroundColor: '#1D1D2F', borderRadius: radius.lg,
            color: '#FFFFFF', fontSize: '16px', fontWeight: '700',
            cursor: 'pointer', fontFamily: font,
          }}>
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
