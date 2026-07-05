import React, { useState, useRef, useEffect } from 'react';
import { radius } from './radius';

const font = "'Plus Jakarta Sans', system-ui, sans-serif";
const healFont = "'HealTheWeb', system-ui, sans-serif";

const TYPING_TEXT = "That guy with the pink cowboy hat who danced with me during Fred again..'s set";

const SparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2.15c0 0 .21 5.8 2.58 8.16 2.36 2.36 8.16 2.58 8.16 2.58s-5.8.21-8.16 2.58c-2.37 2.36-2.58 8.16-2.58 8.16s-.21-5.8-2.58-8.16C8.06 13.1 2.15 12.89 2.15 12.89s5.8-.21 8.16-2.58C12.68 7.95 13 2.15 13 2.15z" fill="white"/>
  </svg>
);

const BAR_PADDING = 20;
const BUTTON_SIZE = 41;
const BAR_GAP = 17;
const FULL_TEXT_WIDTH = 672;
const BAR_WIDTH = BAR_PADDING + FULL_TEXT_WIDTH + BAR_GAP + BUTTON_SIZE + BAR_PADDING;

function AnimatedSearchBar({ active }) {
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState('typing');
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setCharIndex(0);
      setPhase('typing');
      setVisible(true);
      clearTimeout(timerRef.current);
      return;
    }

    if (phase === 'typing') {
      if (charIndex < TYPING_TEXT.length) {
        timerRef.current = setTimeout(() => setCharIndex(c => c + 1), 45);
      } else {
        timerRef.current = setTimeout(() => setPhase('bump'), 300);
      }
    } else if (phase === 'bump') {
      timerRef.current = setTimeout(() => setPhase('fadeout'), 400);
    } else if (phase === 'fadeout') {
      setVisible(false);
      timerRef.current = setTimeout(() => setPhase('hidden'), 500);
    } else if (phase === 'hidden') {
      timerRef.current = setTimeout(() => {
        setCharIndex(0);
        setPhase('typing');
        setVisible(true);
      }, 800);
    }

    return () => clearTimeout(timerRef.current);
  }, [active, charIndex, phase]);

  const displayText = TYPING_TEXT.slice(0, charIndex);
  const isBumping = phase === 'bump';

  const progress = charIndex / TYPING_TEXT.length;
  const cursorX = BAR_PADDING + (progress * FULL_TEXT_WIDTH);
  const centerX = 190;
  const initialOffset = 30;
  const shift = Math.max(0, cursorX - centerX);

  return (
    <div style={{
      position: 'absolute',
      left: 0, right: 0,
      top: '25%',
      zIndex: 3,
      overflow: 'hidden',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${BAR_GAP}px`,
        background: '#FFFFFF',
        borderRadius: '11px',
        padding: `11px ${BAR_PADDING}px`,
        boxShadow: '0 0 40px rgba(181,11,242,0.12), 0 2px 8px rgba(29,29,47,0.06)',
        whiteSpace: 'nowrap',
        width: `${BAR_WIDTH}px`,
        transform: `translateX(${initialOffset - shift}px)`,
        transition: shift > 0 ? 'transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
      }}>
        <div style={{
          width: `${FULL_TEXT_WIDTH}px`,
          flexShrink: 0,
          overflow: 'hidden',
          fontSize: '18px',
          fontFamily: font,
          color: '#56524E',
          lineHeight: '1.3',
          fontWeight: '400',
        }}>
          {displayText}
          {phase === 'typing' && (
            <span style={{
              display: 'inline-block',
              width: '2px', height: '18px',
              backgroundColor: '#56524E',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 0.8s step-end infinite',
            }} />
          )}
        </div>
        <div style={{
          width: `${BUTTON_SIZE}px`, height: `${BUTTON_SIZE}px`,
          borderRadius: '50%',
          backgroundColor: '#B50BF2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transform: isBumping ? 'scale(1.15)' : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}>
          <SparkleIcon />
        </div>
      </div>
    </div>
  );
}

const VibesIcon = ({ color = '#9E9A93' }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.50001 0C7.91413 0 8.25019.336085 8.25019.750219V14.2498C8.25019 14.6639 7.91413 15 7.50001 15C7.08582 15 6.74976 14.6639 6.74976 14.2498V.750219C6.74976.336085 7.08582 0 7.50001 0Z" fill={color}/>
    <path d="M4.49998 3.75022C4.49998 3.33609 4.16459 3 3.75046 3C3.33633 3 3.00024 3.33609 3.00024 3.75022V11.2495C3.00024 11.6636 3.33633 11.9997 3.75046 11.9997C4.16459 11.9997 4.49998 11.6636 4.49998 11.2495V3.75022Z" fill={color}/>
    <path d="M.750219 6.00049C1.16434 6.00049 1.50043 6.33589 1.50043 6.75001V8.25039C1.50043 8.66458 1.16434 8.99995.750219 8.99995.336085 8.99995 0 8.66458 0 8.25039V6.75001C0 6.33589.336085 6.00049.750219 6.00049Z" fill={color}/>
    <path d="M14.2498 6.00049C14.6639 6.00049 14.9999 6.33589 14.9999 6.75001V8.25039C14.9999 8.66458 14.6639 8.99995 14.2498 8.99995 13.8356 8.99995 13.4995 8.66458 13.4995 8.25039V6.75001C13.4995 6.33589 13.8356 6.00049 14.2498 6.00049Z" fill={color}/>
    <path d="M12 3.75022C12 3.33609 11.6639 3 11.2497 3C10.8356 3 10.5002 3.33609 10.5002 3.75022V11.2495C10.5002 11.6636 10.8356 11.9997 11.2497 11.9997 11.6639 11.9997 12 11.6636 12 11.2495V3.75022Z" fill={color}/>
  </svg>
);

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="13" cy="4" r="2.5" stroke="#9E9A93" strokeWidth="1.2"/>
    <circle cx="5" cy="9" r="2.5" stroke="#9E9A93" strokeWidth="1.2"/>
    <circle cx="13" cy="14" r="2.5" stroke="#9E9A93" strokeWidth="1.2"/>
    <line x1="7.2" y1="7.8" x2="11" y2="5.2" stroke="#9E9A93" strokeWidth="1.2"/>
    <line x1="7.2" y1="10.2" x2="11" y2="12.8" stroke="#9E9A93" strokeWidth="1.2"/>
  </svg>
);

const LightningIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L4 10h4l-1 6 7-8h-4.5L10 2z" stroke="#9E9A93" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);

const FEED_POSTS = [
  { author: 'Luna García', time: '2h', tag: 'Peggy Gou', body: 'Lost my voice screaming during Peggy Gou. The girl next to me shared her water bottle and we danced together for the entire set. Best night ever.', likes: 7 },
  { author: 'Sarah Chen', time: '1h', tag: 'Fred again..', body: 'That moment when Fred again.. dropped "Marea" and 40,000 people went completely silent before erupting. Chills. Actual chills. I was sobbing.', likes: 23 },
  { author: 'Marco Rossi', time: '45m', tag: 'Björk', body: 'Cried during Björk. Not even a little — full ugly crying. The person next to me quietly handed me a pack of tissues they clearly needed for themselves.', likes: 4 },
  { author: 'Tom Eriksen', time: '30m', tag: 'Tame Impala', body: 'The couple slow dancing during "Let It Happen" while confetti rained down — that was the most beautiful thing I\'ve ever seen at a festival.', likes: 12 },
  { author: 'Clara Moreau', time: '15m', tag: 'Rosalía', body: 'Someone in the crowd started singing the bridge of "DESPECHÁ" so loud that people around them joined in. By the end the whole section was a choir.', likes: 3 },
];

const FOCUS_INDEX = 2;
const POST_HEIGHT = 170;
const POST_GAP = 12;

function FeedPost({ post, likes, opacity, scale, highlight, iconBump }) {
  return (
    <div style={{
      background: '#F8FAFB',
      borderRadius: '8px',
      padding: '14px',
      opacity,
      transform: `scale(${scale})`,
      transition: 'opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1), transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
      transformOrigin: 'center center',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: '700', fontSize: '13px', color: '#1D1D2F' }}>{post.author}</span>
          <span style={{ fontWeight: '300', fontSize: '13px', color: 'rgba(29,29,47,0.8)' }}>· {post.time}</span>
        </div>
        <span style={{ fontSize: '16px', color: '#9E9A93', letterSpacing: '1px' }}>···</span>
      </div>
      <div style={{ marginTop: '4px' }}>
        <span style={{
          display: 'inline-block',
          background: '#F2F3F6',
          borderRadius: '2px',
          padding: '2px 7px',
          fontSize: '10px',
          color: '#9E9A93',
          textTransform: 'capitalize',
        }}>{post.tag}</span>
      </div>
      <p style={{
        fontSize: '13px',
        lineHeight: '1.5',
        color: '#1D1D2F',
        margin: '10px 0 0',
        fontWeight: '400',
      }}>{post.body}</p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        paddingTop: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', transform: iconBump ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}>
          <VibesIcon color={highlight ? '#B50BF2' : '#9E9A93'} />
          <span style={{ fontSize: '12px', fontWeight: '500', color: highlight ? '#B50BF2' : '#9E9A93', transition: 'color 0.3s ease' }}>{likes}</span>
        </div>
        <ShareIcon />
        <div style={{ flex: 1 }} />
        <LightningIcon />
      </div>
    </div>
  );
}

function AnimatedFeed({ active }) {
  const [scrollY, setScrollY] = useState(0);
  const [phase, setPhase] = useState('scrolling');
  const [likeCount, setLikeCount] = useState(0);
  const [visible, setVisible] = useState(true);
  const [iconBump, setIconBump] = useState(false);
  const timerRef = useRef(null);
  const frameRef = useRef(null);
  const bumpRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setScrollY(0);
      setPhase('scrolling');
      setLikeCount(0);
      setVisible(true);
      setIconBump(false);
      cancelAnimationFrame(frameRef.current);
      clearTimeout(timerRef.current);
      clearTimeout(bumpRef.current);
      return;
    }

    const targetScroll = FOCUS_INDEX * (POST_HEIGHT + POST_GAP) - 80;

    if (phase === 'scrolling') {
      let start = null;
      const duration = 3000;
      const animate = (ts) => {
        if (!start) start = ts;
        const elapsed = ts - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setScrollY(eased * targetScroll);
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          timerRef.current = setTimeout(() => setPhase('fading'), 200);
        }
      };
      frameRef.current = requestAnimationFrame(animate);
    } else if (phase === 'fading') {
      timerRef.current = setTimeout(() => setPhase('focusing'), 400);
    } else if (phase === 'focusing') {
      timerRef.current = setTimeout(() => setPhase('counting'), 700);
    } else if (phase === 'counting') {
      const target = 12;
      if (likeCount < target) {
        if (likeCount === 0) {
          timerRef.current = setTimeout(() => {
            setLikeCount(1);
            setIconBump(true);
            clearTimeout(bumpRef.current);
            bumpRef.current = setTimeout(() => setIconBump(false), 250);
          }, 300);
        } else if (likeCount === 1) {
          timerRef.current = setTimeout(() => setLikeCount(2), 350);
        } else {
          timerRef.current = setTimeout(() => setLikeCount(c => c + 1), 80);
        }
      } else {
        timerRef.current = setTimeout(() => setPhase('fadeout'), 500);
      }
    } else if (phase === 'fadeout') {
      setVisible(false);
      timerRef.current = setTimeout(() => setPhase('hidden'), 500);
    } else if (phase === 'hidden') {
      timerRef.current = setTimeout(() => {
        setScrollY(0);
        setLikeCount(0);
        setPhase('scrolling');
        setVisible(true);
      }, 800);
    }

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(timerRef.current);
    };
  }, [active, phase, likeCount]);

  const isZoomed = phase === 'focusing' || phase === 'counting' || phase === 'fadeout';
  const isFading = phase === 'fading' || isZoomed;

  return (
    <div style={{
      position: 'absolute',
      left: '20px', right: '20px',
      top: 0,
      height: '50%',
      zIndex: 3,
      overflow: 'hidden',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94)',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${POST_GAP}px`,
        paddingTop: '40px',
        transform: `translateY(${-scrollY}px) scale(${isZoomed ? 0.85 : 0.72})`,
        transformOrigin: `center ${scrollY + 140}px`,
        transition: isZoomed ? 'transform 0.7s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
      }}>
        {FEED_POSTS.map((post, i) => (
          <FeedPost
            key={i}
            post={post}
            likes={i === FOCUS_INDEX ? likeCount : post.likes}
            opacity={isFading && i !== FOCUS_INDEX ? 0 : 1}
            scale={1}
            highlight={i === FOCUS_INDEX && (phase === 'counting' || phase === 'fadeout')}
            iconBump={i === FOCUS_INDEX && iconBump}
          />
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  {
    headline: 'Search for someone you met at the festival',
    body: 'You crossed paths. Describe the moment. Who you saw, where, when. Write it down. The system matches you only if they\'re searching too.',
    image: '/onboarding_BG.png',
  },
  {
    headline: 'Share with the community',
    body: 'Share a festival moment that everyone sees. Anyone could recognize themselves and reach out. Your space to shout out to whoever was there.',
    image: '/onboarding2_BG.png',
  },
  {
    headline: 'Swap contacts with your connections',
    body: 'When both of you were searching and the system found a match, you can share your Instagram or WhatsApp and keep the conversation going.',
    image: '/onboarding3_BG.png',
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
      {/* Background images with crossfade */}
      {SLIDES.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '100%',
          backgroundImage: `url(${s.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: i === current ? 1 : 0,
          transition: 'opacity 0.5s ease',
          zIndex: 1,
        }} />
      ))}

      {/* Gradient overlay: transparent at top, fades to #F8FAFB at mid-screen */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(to bottom, transparent 20%, #F8FAFB 50%)',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* Animated search bar on slide 1 */}
      {current === 0 && <AnimatedSearchBar active={current === 0} />}

      {/* Animated feed on slide 2 */}
      {current === 1 && <AnimatedFeed active={current === 1} />}

      {/* Skip */}
      {!isLast && (
        <button onClick={onComplete} style={{
          position: 'absolute', top: '52px', right: '20px',
          background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderRadius: radius.xl, padding: '6px 14px',
          color: '#FFFFFF', fontSize: '13px',
          fontWeight: '600', cursor: 'pointer', fontFamily: font,
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
