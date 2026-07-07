import React, { useState, useEffect, useCallback, useRef } from 'react';
import CreateNoteFlow from './CreateNoteFlow';
import Onboarding from './Onboarding';
import SearchWithAI from './SearchWithAI';
import { findMatches, calculateMatchScore } from './matchingAlgorithm';
import { LOCATION_OPTIONS, TIME_OPTIONS } from './defaultOptions';
import { radius } from './radius';
import { FESTIVALS, FESTIVAL_LIST, DEFAULT_FESTIVAL_ID } from './festivals';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: '#F8FAFB', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>Something went wrong</p>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px', textAlign: 'center' }}>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', backgroundColor: '#B50BF2', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'YOUR_SUPABASE_KEY';

const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,

  getJwt() {
    return localStorage.getItem('fulmi_jwt') || this.key;
  },

  saveSession(session) {
    if (session.access_token) localStorage.setItem('fulmi_jwt', session.access_token);
    if (session.refresh_token) localStorage.setItem('fulmi_refresh', session.refresh_token);
    if (session.expires_at) localStorage.setItem('fulmi_jwt_exp', String(session.expires_at));
    else if (session.expires_in) localStorage.setItem('fulmi_jwt_exp', String(Math.floor(Date.now() / 1000) + session.expires_in));
  },

  clearSession() {
    localStorage.removeItem('fulmi_jwt');
    localStorage.removeItem('fulmi_refresh');
    localStorage.removeItem('fulmi_jwt_exp');
  },

  async refreshIfNeeded() {
    const exp = Number(localStorage.getItem('fulmi_jwt_exp') || 0);
    const refresh = localStorage.getItem('fulmi_refresh');
    if (!refresh || !exp) return;
    if (Date.now() / 1000 < exp - 60) return;
    try {
      const res = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': this.key },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (res.ok) {
        const data = await res.json();
        this.saveSession(data);
      }
    } catch (err) {
      console.error('Token refresh error:', err);
    }
  },

  async request(table, method = 'GET', data = null, filter = null) {
    await this.refreshIfNeeded();
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.key,
      'Authorization': `Bearer ${this.getJwt()}`,
      'Prefer': 'return=representation'
    };
    let url = `${this.url}/rest/v1/${table}`;
    if (filter) url += `?${filter}`;
    const options = { method, headers, ...(data && { body: JSON.stringify(data) }) };
    try {
      const res = await fetch(url, options);
      const result = await res.json();
      if (!res.ok) console.error('Supabase error:', result);
      return result;
    } catch (err) {
      console.error('Network error:', err);
      return null;
    }
  },

  async getUser(email)            { return this.request('users', 'GET', null, `email=eq.${email}`); },
  async getUserById(id)           { return this.request('users', 'GET', null, `id=eq.${id}`); },
  async createUser(email)         { return this.request('users', 'POST', { email }); },
  async confirmAge(userId)        { return this.request('users', 'PATCH', { age_confirmed: true }, `id=eq.${userId}`); },
  async updateUser(userId, data)  { return this.request('users', 'PATCH', data, `id=eq.${userId}`); },
  async requestFestival(text, userId) { return this.request('festival_requests', 'POST', { text, user_id: userId ?? null }); },

  async sendOtp(email) {
    const res = await fetch(`${this.url}/auth/v1/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.key },
      body: JSON.stringify({ email }),
    });
    return res.ok;
  },

  async verifyOtp(email, token) {
    const res = await fetch(`${this.url}/auth/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.key },
      body: JSON.stringify({ type: 'email', email, token }),
    });
    const data = await res.json();
    if (res.ok && data.access_token) this.saveSession(data);
    return res.ok ? data : null;
  },
  async createNote(userId, note)  { return this.request('notes', 'POST', { user_id: userId, ...note }); },
  async getNotes(userId)          { return this.request('notes', 'GET', null, `user_id=eq.${userId}`); },
  async getAllNotes(festivalId)    { return this.request('notes', 'GET', null, festivalId ? `festival_id=eq.${festivalId}` : null); },
  async getNote(id)               { return this.request('notes', 'GET', null, `id=eq.${id}`); },
  async createMatch(match)        { return this.request('matches', 'POST', match); },
  async getMatches(userId)        { return this.request('matches', 'GET', null, `or=(user_1_id.eq.${userId},user_2_id.eq.${userId})`); },
  async updateMatch(matchId, data){ return this.request('matches', 'PATCH', data, `id=eq.${matchId}`); },
  async updateNote(noteId, data)  { return this.request('notes', 'PATCH', data, `id=eq.${noteId}`); },
  async deleteNote(noteId)        { return this.request('notes', 'DELETE', null, `id=eq.${noteId}`); },
  async getMatchByNotes(n1, n2) {
    const r1 = await this.request('matches', 'GET', null, `note_1_id=eq.${n1}&note_2_id=eq.${n2}`);
    if (r1 && r1.length > 0) return r1;
    return this.request('matches', 'GET', null, `note_1_id=eq.${n2}&note_2_id=eq.${n1}`);
  },
};

const toSnakeCase = (note) => ({
  description:    note.description,
  artist:         note.artist,
  time:           note.time,
  location:       note.location,
  own_desc:       note.ownDesc ?? null,
  instagram:      note.instagram ?? null,
  visibility:     note.visibility,
  search_intent:  note.searchIntent ?? false,
  embedding_other: note.embeddingOther ?? null,
  embedding_self:  note.embeddingSelf ?? null,
  user_id:        note.user_id,
});

const toCamelCase = (note) => ({
  ...note,
  ownDesc:        note.own_desc,
  searchIntent:   note.search_intent,
  embeddingOther: note.embedding_other,
  embeddingSelf:  note.embedding_self,
});

const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
};

// Display name for a user record: the profile/onboarding name, falling back to the email prefix.
const displayNameFor = (u) => (u?.name?.trim?.() || u?.email?.split('@')[0] || '');

// ─── Shared style tokens ───────────────────────────────────────────────────
const t = {
  primary:       '#B50BF2',
  primaryLight:  '#D076F7',
  primaryBg:     '#F3E5FD',
  primaryBorder: '#CC88F5',
  bg:            '#F8FAFB',
  white:         '#FFFFFF',
  surface:       '#F2F3F6',
  dark:          '#1D1D2F',
  darkBlue:      '#24223B',
  third:         '#C970F5',
  thirdLight:    '#EBD5FC',
  border:        '#E6E8EC',
  borderDark:    '#D0D3DA',
  text:          '#1D1D2F',
  textSec:       '#56524E',
  textMuted:     '#9E9A93',
  success:       '#05C270',
  successBg:     '#E6FAF2',
  successBorder: '#A8E6CF',
  successDark:   '#036B42',
  danger:        '#FF4B4B',
  dangerBg:      '#FFF0F0',
};

// Per-category color schemes for Connections cards.
// AI Search → purple family; Crowd → green family (the two greens from the home Crowd pill).
const CATEGORY_THEME = {
  ai: {
    accent:     '#B50BF2',                 // primary purple — text, icons, buttons
    cardBg:     'rgba(181,11,242,0.06)',   // card background
    tint:       'rgba(181,11,242,0.10)',   // pills / status rows
    tintStrong: 'rgba(181,11,242,0.14)',   // emphasis (shared chips)
    border:     '#CC88F5',
    shadow:     'rgba(181,11,242,0.10)',
  },
  crowd: {
    accent:     '#5D8000',                 // dark olive green — text, icons, buttons
    cardBg:     'rgba(176,232,23,0.08)',   // card background
    tint:       'rgba(176,232,23,0.15)',   // pills / status rows
    tintStrong: 'rgba(176,232,23,0.26)',   // emphasis
    border:     'rgba(176,232,23,0.55)',
    shadow:     'rgba(93,128,0,0.10)',
  },
};

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// Reduced circular mark — used in navbars
const OtraLogoMark = ({ color = '#B50BF2', size = 22, style, animatePupil = false }) => (
  <svg viewBox="0 0 8.4 8.4" xmlns="http://www.w3.org/2000/svg" width={size} height={size} style={style}>
    <path fill={color} d="M6.89,1h1.03V0h-3.72C1.89,0,0,1.89,0,4.2c0,1.29.6,2.43,1.51,3.2H.49v1h3.72c2.32,0,4.2-1.89,4.2-4.2,0-1.29-.6-2.43-1.51-3.2ZM4.2,7.4c-1.77,0-3.2-1.43-3.2-3.2s1.43-3.2,3.2-3.2,3.2,1.43,3.2,3.2-1.43,3.2-3.2,3.2Z"/>
    <circle fill={color} cx="4.2" cy="4.2" r=".88"
      style={animatePupil ? { animation: 'otra-look 2.8s ease-in-out infinite' } : undefined} />
  </svg>
);

// Full wordmark — used on splash / auth screens
const OtraLogo = ({ color = '#B50BF2', style }) => (
  <svg viewBox="0 0 27.76 8.41" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path fill={color} d="M11.8.98h-1.48v2.47h-1V0h5.92v3.45h-.98V.98h-1.49v7.42h-.98V.98Z"/>
    <path fill={color} d="M26.63.01h1.13v8.4h-1.07v-1.26l-2.29-1.34-1.54,2.6h-1.18L26.63.01ZM26.69,6V1.89l-1.8,3.06,1.8,1.04Z"/>
    <path fill={color} d="M21.31,7.51l-3.2-2.81h1.44c1.31,0,2.35-1.04,2.35-2.34S20.84.01,19.55.01h-3.13v8.4h.98v-3.02l3.4,2.99.51-.86ZM17.45,1h2.06c.74,0,1.37.61,1.37,1.37s-.62,1.36-1.37,1.36h-2.06V1Z"/>
    <g>
      <path fill={color} d="M4.2,1.01c1.77,0,3.2,1.43,3.2,3.2s-1.43,3.2-3.2,3.2-3.2-1.43-3.2-3.2,1.43-3.2,3.2-3.2M4.2,0C1.89,0,0,1.89,0,4.21s1.89,4.2,4.2,4.2,4.2-1.89,4.2-4.2S6.52,0,4.2,0h0Z"/>
      <rect fill={color} x="4.2" y="0" width="3.72" height="1"/>
      <rect fill={color} x=".49" y="7.41" width="3.72" height="1"/>
      <circle fill={color} cx="4.2" cy="4.21" r=".88"/>
    </g>
  </svg>
);

// ─── Small reusable UI pieces ──────────────────────────────────────────────

const Badge = ({ label, color, bg, border }) => (
  <span style={{
    display: 'inline-block', fontSize: '10px', fontWeight: '600',
    color, backgroundColor: bg,
    padding: '3px 8px', borderRadius: radius.pill,
    fontFamily: font,
  }}>{label}</span>
);

// ─── Main app ──────────────────────────────────────────────────────────────

const PrimaveraApp = () => {
  const [activeFestivalId, setActiveFestivalId] = useState(() => {
    const stored = localStorage.getItem('fulmi_festival_id');
    return stored && FESTIVALS[stored] ? stored : null;
  });
  const [festivalSwitcherOpen, setFestivalSwitcherOpen] = useState(false);
  const [aiSearchActive, setAiSearchActive] = useState(false);
  const [festivalRequestInput, setFestivalRequestInput] = useState('');
  const [festivalRequestStatus, setFestivalRequestStatus] = useState('idle'); // idle | submitting | sent
  const activeFestival = activeFestivalId ? FESTIVALS[activeFestivalId] : null;

  const [sharedPostId] = useState(() => new URLSearchParams(window.location.search).get('post'));
  const [sharedPost, setSharedPost] = useState(null);
  const [sharedPostAuthor, setSharedPostAuthor] = useState('');
  const [sharedPostDismissed, setSharedPostDismissed] = useState(false);

  const [authStep, setAuthStep]             = useState(() => localStorage.getItem('fulmi_user_id') ? null : 'splash');
  const [user, setUser]                     = useState(() => {
    const email = localStorage.getItem('fulmi_user_email');
    return email ? { email } : null;
  });
  const [userId, setUserId]                 = useState(() => localStorage.getItem('fulmi_user_id') || null);
  const [tab, setTab]                       = useState('home');
  const [pendingEmail, setPendingEmail]     = useState('');
  const [otpCode, setOtpCode]               = useState('');
  const [otpError, setOtpError]             = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [ageChecked, setAgeChecked]         = useState(false);
  const [termsChecked, setTermsChecked]     = useState(false);
  const [userName, setUserName]             = useState(() => localStorage.getItem('fulmi_user_name') || '');
  const [editingName, setEditingName]       = useState(false);
  const [nameDraft, setNameDraft]           = useState('');
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal]             = useState(false);
  const [vibeCreating, setVibeCreating]     = useState(false);
  const [vibeStep, setVibeStep]             = useState(0);
  const [vibeText, setVibeText]             = useState('');
  const [vibeArtist, setVibeArtist]         = useState(null);
  const [loading, setLoading]               = useState(false);
  const [myNotes, setMyNotes]               = useState([]);
  const [publicNotes, setPublicNotes]       = useState([]);
  const [dismissedNotes, setDismissedNotes] = useState(new Set());
  // searchCards: [{ note, matches: [...] }] — one entry per targeted note
  const [searchCards, setSearchCards]           = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests]         = useState([]);
  const [confirmedMatches, setConfirmedMatches] = useState([]);
  const [boardSubTab, setBoardSubTab]           = useState('everyone');
  const [matchSubTab, setMatchSubTab]           = useState('ai');
  const [carouselIndexes, setCarouselIndexes]   = useState({});
  const [noteAuthors, setNoteAuthors]           = useState({});
  const [acceptedRequestIds, setAcceptedRequestIds] = useState(new Set());
  const [seenCrowdIds, setSeenCrowdIds]             = useState(new Set());
  const [seenAIIds, setSeenAIIds]                   = useState(new Set());

  // ── Load / refresh all data from DB ──────────────────────────────────────
  const lastRefresh = useRef(0);
  const prevFestivalRef = useRef(activeFestivalId);
  const touchStartX = useRef(null);
  const acceptedRequestIdsRef = useRef(new Set());

  const loadData = useCallback(async (uid, festivalId) => {
    if (!uid) return;
    // Debounce: skip if refreshed within the last 10 seconds
    const now = Date.now();
    if (now - lastRefresh.current < 10_000) return;
    lastRefresh.current = now;

    try {
      const [notes, allNotes, existingMatches] = await Promise.all([
        supabase.getNotes(uid),
        supabase.getAllNotes(festivalId),
        supabase.getMatches(uid),
      ]);

      const camelNotes = Array.isArray(notes) ? notes.map(toCamelCase) : [];
      setMyNotes(camelNotes);

      if (Array.isArray(allNotes)) {
        const camelAll = allNotes.map(toCamelCase);
        setPublicNotes(camelAll.filter(n => n.visibility === 'public'));

        // Author names
        const uniqueIds = [...new Set(camelAll.map(n => n.user_id).filter(Boolean))];
        const authorsMap = {};
        await Promise.all(uniqueIds.map(async id => {
          const res = await supabase.getUserById(id);
          if (res?.[0]) authorsMap[id] = displayNameFor(res[0]);
        }));
        setNoteAuthors(authorsMap);

        // Build searchCards — one per targeted note
        const userTargeted = camelNotes.filter(n => n.visibility === 'targeted' || n.visibility === 'private');
        const otherNotes = camelAll.filter(n => (n.visibility === 'targeted' || n.visibility === 'private') && n.user_id !== uid);

        const cards = userTargeted.map(myNote => {
          let matches = findMatches(myNote, otherNotes);
          // Overlay existing match records
          if (Array.isArray(existingMatches)) {
            matches = matches.map(m => {
              const record = existingMatches.find(r =>
                (r.note_1_id === myNote.id && r.note_2_id === m.id) ||
                (r.note_2_id === myNote.id && r.note_1_id === m.id)
              );
              if (!record) return m;
              const isUser1 = record.user_1_id === uid;
              const myResponse = isUser1 ? record.user_1_response : record.user_2_response;
              const theirResponse = isUser1 ? record.user_2_response : record.user_1_response;
              return { ...m, userResponse: myResponse || null, theyAlreadyRequested: theirResponse === 'yes' && !myResponse };
            });
          }
          return { note: myNote, matches };
        });
        setSearchCards(cards);

        // Existing match records
        if (Array.isArray(existingMatches) && existingMatches.length > 0) {

          // Pending received requests — only Vibes (public) requests go to Requests tab
          const receivedRaw = existingMatches.filter(r =>
            r.user_2_id === uid && !r.user_2_response && r.user_1_response === 'yes'
          );
          const vibesOnly = receivedRaw.filter(r => {
            const targetNote = camelAll.find(n => n.id === r.note_2_id);
            return targetNote?.visibility === 'public';
          });
          const received = (await Promise.all(vibesOnly.map(async r => {
            const myVibeNote = camelAll.find(n => n.id === r.note_2_id) || null;
            const userRes = await supabase.getUserById(r.user_1_id);
            return { matchId: r.id, myVibeNote, createdAt: r.created_at, authorName: displayNameFor(userRes?.[0]), message: r.message || null };
          }))).filter(Boolean);
          setReceivedRequests(prev => {
            const keptAccepted = prev.filter(r => acceptedRequestIdsRef.current.has(r.matchId));
            const newIds = new Set(received.map(r => r.matchId));
            return [...received, ...keptAccepted.filter(r => !newIds.has(r.matchId))];
          });

          // Sent requests — where this user reached out on someone else's public post
          const sentRaw = existingMatches.filter(r =>
            r.user_1_id === uid && r.user_1_response === 'yes'
          );
          const sentVibes = sentRaw.filter(r => {
            const targetNote = camelAll.find(n => n.id === r.note_2_id);
            return targetNote?.visibility === 'public';
          });
          const sent = (await Promise.all(sentVibes.map(async r => {
            const theirVibeNote = camelAll.find(n => n.id === r.note_2_id) || null;
            const myNote = camelAll.find(n => n.id === r.note_1_id) || null;
            const userRes = await supabase.getUserById(r.user_2_id);
            const confirmed = r.revealed;
            return {
              matchId: r.id,
              theirVibeNote,
              myNote,
              authorName: displayNameFor(userRes?.[0]),
              message: r.message || null,
              confirmed,
              theirResponse: r.user_2_response || null,
            };
          }))).filter(Boolean);
          setSentRequests(sent);

          // Confirmed matches — only keep if the note still exists
          const confirmedRaw = existingMatches.filter(r => r.revealed);
          const confirmed = (await Promise.all(confirmedRaw.map(async r => {
            const isUser1 = r.user_1_id === uid;
            const theirNoteId = isUser1 ? r.note_2_id : r.note_1_id;
            const myNoteId   = isUser1 ? r.note_1_id : r.note_2_id;
            const theirUserId = isUser1 ? r.user_2_id : r.user_1_id;
            const theirNote = camelAll.find(n => n.id === theirNoteId);
            if (!theirNote) return null;
            const userRes = await supabase.getUserById(theirUserId);
            return { matchId: r.id, myNoteId, note: theirNote, score: r.score, quality: r.quality, authorName: displayNameFor(userRes?.[0]) };
          }))).filter(Boolean);
          setConfirmedMatches(confirmed);
        } else {
          setReceivedRequests([]);
          setSentRequests([]);
          setConfirmedMatches([]);
        }

      }
    } catch (err) {
      console.error('loadData error:', err);
    }
  }, []);

  // Restore session on mount — if no JWT, force re-login
  useEffect(() => {
    if (userId && !localStorage.getItem('fulmi_jwt')) {
      localStorage.removeItem('fulmi_user_email');
      localStorage.removeItem('fulmi_user_id');
      supabase.clearSession();
      setUser(null);
      setUserId(null);
      setAuthStep('splash');
      return;
    }
    if (userId && activeFestivalId) { lastRefresh.current = 0; loadData(userId, activeFestivalId); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when the user switches festivals
  useEffect(() => {
    if (prevFestivalRef.current === activeFestivalId) return;
    prevFestivalRef.current = activeFestivalId;
    if (!userId || !activeFestivalId) return;
    lastRefresh.current = 0;
    loadData(userId, activeFestivalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFestivalId]);

  // Fetch shared post from ?post= URL param
  useEffect(() => {
    if (!sharedPostId) return;
    (async () => {
      const notes = await supabase.getNote(sharedPostId);
      if (notes?.[0]) {
        setSharedPost(toCamelCase(notes[0]));
        const userRes = await supabase.getUserById(notes[0].user_id);
        if (userRes?.[0]) setSharedPostAuthor(displayNameFor(userRes[0]));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPostId]);

  // If already logged in and arriving via share link, land on Crowd tab
  useEffect(() => {
    if (sharedPostId && userId && !authStep) setTab('crowd');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPostId, userId]);

  // Seed history stack so the first back-swipe has somewhere to go
  useEffect(() => {
    history.replaceState({ tab: 'home' }, '');
  }, []);

  // Navigate tabs and push history so swipe-back works
  const navigateTo = useCallback((newTab) => {
    history.pushState({ tab: newTab }, '');
    setTab(newTab);
  }, []);

  // Open modal and push history entry so swipe-back closes it
  const openModal = useCallback(() => {
    history.pushState({ modal: 'create' }, '');
    openModal();
  }, []);

  // Intercept browser back gesture
  useEffect(() => {
    const onPop = (e) => {
      if (isModalOpen) { setIsModalOpen(false); return; }
      if (vibeCreating) {
        if (vibeStep > 0) { setVibeStep(s => s - 1); history.pushState({ tab }, ''); }
        else { setVibeCreating(false); }
        return;
      }
      setTab(e.state?.tab || 'home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isModalOpen, vibeCreating, vibeStep, tab]);

  // Re-fetch whenever the tab becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(userId, activeFestivalId); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, activeFestivalId, loadData]);

  useEffect(() => {
    if (!userId || !activeFestivalId) return;
    const id = setInterval(() => loadData(userId, activeFestivalId), 25000);
    return () => clearInterval(id);
  }, [userId, activeFestivalId, loadData]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOtpError('');
    try {
      const ok = await supabase.sendOtp(pendingEmail);
      if (ok) {
        setAuthStep('otp');
        setResendCountdown(30);
      } else {
        setOtpError('Could not send the code. Check the email and try again.');
      }
    } catch (err) {
      console.error('sendOtp error:', err);
      setOtpError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOtpError('');
    try {
      const session = await supabase.verifyOtp(pendingEmail, otpCode);
      if (!session) {
        setOtpError('That code isn\'t right. Try again.');
        setLoading(false);
        return;
      }
      // Find or create user in our users table
      const users = await supabase.getUser(pendingEmail);
      let uid, isNew;
      if (users && users.length > 0) {
        uid = users[0].id;
        isNew = !users[0].age_confirmed;
      } else {
        const newUser = await supabase.createUser(pendingEmail);
        uid = newUser[0]?.id;
        isNew = true;
      }
      if (uid) {
        localStorage.setItem('fulmi_user_email', pendingEmail);
        localStorage.setItem('fulmi_user_id', uid);
        setUser({ email: pendingEmail });
        setUserId(uid);
        lastRefresh.current = 0;
        if (isNew) {
          setAuthStep('age');
        } else {
          const localName = localStorage.getItem('fulmi_user_name');
          if (localName && !users[0].name) await supabase.updateUser(uid, { name: localName });
          setAuthStep(null);
          if (activeFestivalId) await loadData(uid, activeFestivalId);
        }
      }
    } catch (err) {
      console.error('verifyOtp error:', err);
      setOtpError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAge = async () => {
    setLoading(true);
    try {
      await supabase.confirmAge(userId);
      if (userName.trim()) {
        localStorage.setItem('fulmi_user_name', userName.trim());
        await supabase.updateUser(userId, { name: userName.trim() });
      }
      setAuthStep(null);
      if (activeFestivalId) await loadData(userId, activeFestivalId);
    } catch (err) {
      console.error('confirmAge error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // Push history on auth step transitions so swipe-back works
  useEffect(() => {
    if (authStep) history.pushState({ authStep }, '');
  }, [authStep]);

  // Handle swipe-back during auth flow
  useEffect(() => {
    if (authStep === null) return; // main app handles its own popstate
    const onPop = () => {
      if (authStep === 'otp')        { setAuthStep('email'); setOtpCode(''); setOtpError(''); }
      else if (authStep === 'email') { setAuthStep('onboarding'); }
      else if (authStep === 'onboarding') { setAuthStep('splash'); }
      else if (authStep === 'age')   { setAuthStep('email'); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [authStep]);

  // Mark connection items as seen when user opens the relevant sub-tab
  useEffect(() => {
    if (tab !== 'matches') return;
    if (matchSubTab === 'requests') {
      setSeenCrowdIds(prev => {
        const next = new Set(prev);
        receivedRequests.forEach(r => next.add(r.matchId));
        sentRequests.filter(r => r.confirmed).forEach(r => next.add(r.matchId));
        return next;
      });
    } else if (matchSubTab === 'ai') {
      setSeenAIIds(prev => {
        const next = new Set(prev);
        confirmedMatches.filter(m => m.note?.visibility !== 'public').forEach(m => next.add(m.matchId));
        return next;
      });
    }
  }, [tab, matchSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveNote = async (formData) => {
    if (!userId) return;
    setLoading(true);
    try {
      const body = {
        ...toSnakeCase({ ...formData, user_id: userId }),
        festival_id: activeFestivalId ?? null,
      };
      const res = await fetch('/api/save-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const created = await res.json();
      if (created) {
        const newNote = toCamelCase(created[0]);
        if (formData.visibility === 'targeted' || formData.visibility === 'private') {
          setMyNotes(prev => [...prev, newNote]);
          const allNotes = await supabase.getAllNotes(activeFestivalId);
          if (allNotes) {
            const otherNotes = allNotes.map(toCamelCase).filter(n => (n.visibility === 'targeted' || n.visibility === 'private') && n.user_id !== userId);
            const newMatches = findMatches(newNote, otherNotes);
            setSearchCards(prev => [...prev, { note: newNote, matches: newMatches }]);
          }
        } else {
          setMyNotes(prev => [...prev, newNote]);
          setPublicNotes(prev => [...prev, newNote]);
        }
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Save note error:', err);
      alert('Error saving note');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (note, comment) => {
    setPublicNotes(prev => prev.map(n => n.id === note.id ? { ...n, requested: true } : n));
    if (!userId || !note.user_id) return;
    const myNote = myNotes.find(n => n.visibility === 'targeted' || n.visibility === 'private');
    await supabase.createMatch({
      note_1_id: myNote?.id || null,
      note_2_id: note.id,
      user_1_id: userId,
      user_2_id: note.user_id,
      user_1_response: 'yes',
      message: comment || null,
    });
  };

  const handleLikePublic = (noteId) => {
    setPublicNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, liked: !n.liked, likes: (n.likes || 0) + (n.liked ? -1 : 1) } : n
    ));
  };

  const handleDeleteNote = async (noteId) => {
    const prevPublic = publicNotes;
    const prevMy = myNotes;
    setPublicNotes(prev => prev.filter(n => n.id !== noteId));
    setMyNotes(prev => prev.filter(n => n.id !== noteId));
    await supabase.deleteNote(noteId);
  };

  const handleDismissNote = (noteId) => {
    setDismissedNotes(prev => new Set([...prev, noteId]));
  };

  const handleMatchResponse = async (noteId, matchId, response) => {
    const card = searchCards.find(c => c.note.id === noteId);
    const match = card?.matches.find(m => m.id === matchId);
    setSearchCards(prev => prev.map(c =>
      c.note.id !== noteId ? c : {
        ...c,
        matches: c.matches.map(m => m.id === matchId ? { ...m, userResponse: response } : m),
      }
    ));
    if (response === 'yes' && userId && noteId && match) {
      const existing = await supabase.getMatchByNotes(noteId, matchId);
      if (existing && existing.length > 0) {
        const record = existing[0];
        const isUser1 = record.user_1_id === userId;
        const otherResponse = isUser1 ? record.user_2_response : record.user_1_response;
        const revealed = otherResponse === 'yes';
        const updateData = isUser1 ? { user_1_response: 'yes', revealed } : { user_2_response: 'yes', revealed };
        await supabase.updateMatch(record.id, updateData);
      } else {
        await supabase.createMatch({
          note_1_id: noteId, note_2_id: matchId,
          user_1_id: userId, user_2_id: match.user_id,
          score: match.score, quality: match.quality,
          user_1_response: 'yes',
        });
      }
    }
  };

  const handleRequestResponse = async (matchId, accept) => {
    if (accept) {
      setAcceptedRequestIds(prev => {
        const next = new Set([...prev, matchId]);
        acceptedRequestIdsRef.current = next;
        return next;
      });
    } else {
      setReceivedRequests(prev => prev.filter(r => r.matchId !== matchId));
    }
    const record = (await supabase.getMatches(userId) || []).find(r => r.id === matchId);
    if (!record) return;
    const revealed = accept && record.user_1_response === 'yes';
    await supabase.updateMatch(matchId, { user_2_response: accept ? 'yes' : 'no', revealed });
    if (revealed) {
      const allN = await supabase.getAllNotes(activeFestivalId);
      const camelAll = allN ? allN.map(toCamelCase) : [];
      const theirNote = camelAll.find(n => n.id === record.note_1_id);
      if (theirNote) {
        setConfirmedMatches(prev => [...prev, { matchId, note: theirNote, score: record.score, quality: record.quality }]);
      }
    }
  };

  const handleAddInstagram = async (noteId, instagram) => {
    if (!noteId) return;
    await supabase.updateNote(noteId, { instagram });
    setMyNotes(prev => prev.map(n => n.id === noteId ? { ...n, instagram } : n));
    setSearchCards(prev => prev.map(c =>
      c.note.id === noteId ? { ...c, note: { ...c.note, instagram } } : c
    ));
  };

  // ── Shared post preview (unregistered users arriving via share link) ──────

  if (sharedPost && !sharedPostDismissed && authStep === 'splash') {
    const chips = [
      sharedPost.location && sharedPost.location.replace(/_/g, ' '),
      sharedPost.time,
      sharedPost.artist && sharedPost.artist !== 'Otro' ? sharedPost.artist : null,
    ].filter(Boolean);

    return (
      <div style={{
        maxWidth: '480px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: '#EEE1FD', fontFamily: font,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '140%', height: '60svh',
          background: 'radial-gradient(ellipse 80% 100% at 50% 8%, #B50BF2 0%, #8A00CC 42%, rgba(180,100,240,0.5) 70%, transparent 88%)',
          filter: 'blur(22px)', pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, padding: '28px 24px 0' }}>
          <OtraLogoMark color='#FFFFFF' size={28} />
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1, padding: '24px 24px 0' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: font }}>
            Someone shared this with you
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: '700', color: '#FFFFFF', fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1.25', letterSpacing: '0.01em' }}>
            Do you know this person?
          </h1>
        </div>

        {/* Post card */}
        <div style={{ position: 'relative', zIndex: 1, margin: '20px 16px 0', backgroundColor: t.white, borderRadius: radius.xl, padding: '18px 18px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: t.textMuted, fontFamily: font }}>
            Posted by <span style={{ color: t.dark }}>{sharedPostAuthor || 'someone'}</span> at the festival
          </p>
          <p style={{ margin: '0 0 12px', fontSize: '15px', color: t.dark, lineHeight: '1.55', fontFamily: font }}>
            {sharedPost.description}
          </p>
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {chips.map(chip => (
                <Badge key={chip} label={chip} color={t.textSec} bg={t.surface} border={t.border} />
              ))}
            </div>
          )}
          {/* Likes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: t.textMuted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={t.primary} stroke={t.primary} strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span style={{ fontSize: '12px', fontWeight: '600', color: t.primary, fontFamily: font }}>{sharedPost.likes || 0} {(sharedPost.likes || 0) === 1 ? 'vibe' : 'vibes'}</span>
          </div>
        </div>

        {/* CTAs */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', padding: '24px 24px 52px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => setAuthStep('onboarding')}
            style={{
              width: '100%', padding: '17px', border: 'none',
              backgroundColor: t.dark, borderRadius: radius.lg,
              fontSize: '16px', fontWeight: '700', color: '#FFFFFF',
              cursor: 'pointer', fontFamily: font,
            }}
          >
            Join to respond
          </button>
          <button
            onClick={() => setSharedPostDismissed(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: 'rgba(29,29,47,0.5)', fontFamily: font, padding: '4px',
            }}
          >
            Just browsing — skip
          </button>
        </div>
      </div>
    );
  }

  // ── Splash screen ────────────────────────────────────────────────────────

  // ── Splash ────────────────────────────────────────────────────────────────

  if (authStep === 'splash') {
    return (
      <div style={{
        maxWidth: '480px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: '#F1F9B5', fontFamily: font,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Background from SVG asset */}
        <svg viewBox="0 0 375 812" preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="splash-blur" x="-102" y="-152" width="576" height="1199" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
              <feGaussianBlur stdDeviation="30" result="effect1_foregroundBlur"/>
            </filter>
            <clipPath id="splash-clip">
              <rect width="375" height="812"/>
            </clipPath>
          </defs>
          <g clipPath="url(#splash-clip)">
            <rect width="375" height="812" fill="#F1F9B5"/>
            <g filter="url(#splash-blur)">
              <rect x="0.5" y="0.5" width="375" height="811" fill="#B0E817" stroke="#B0E817"/>
              <path d="M-38 551V987H414V551C387.412 570.069 325.043 608.206 181.957 608.206C38.8719 608.206 -15.4403 570.069 -38 551Z" fill="#F9F9F9"/>
              <path d="M410 -92V343.957C410 343.957 342.681 511 184 511C25.3192 511 -42 343.957 -42 343.957V-92H410Z" fill="#B50BF2"/>
            </g>
          </g>
        </svg>
        {/* Full-width wordmark, equal padding top and sides */}
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 20px 0' }}>
          <OtraLogo color='#FFFFFF' style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <h1 style={{
            fontSize: '42px', fontWeight: '500', color: '#FFFFFF',
            margin: 0, lineHeight: '1.15', textAlign: 'center',
            fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em',
          }}>
            Find the people you vibed with
          </h1>
        </div>
        <div style={{ position: 'relative', zIndex: 1, padding: '0 24px 64px' }}>
          <button
            onClick={() => setAuthStep('onboarding')}
            style={{
              width: '100%', padding: '17px', border: 'none',
              backgroundColor: t.dark, borderRadius: radius.lg,
              fontSize: '16px', fontWeight: '700', color: '#FFFFFF',
              cursor: 'pointer', fontFamily: font,
            }}
          >Get started</button>
        </div>
      </div>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  if (authStep === 'onboarding') {
    return (
      <Onboarding onComplete={() => setAuthStep('email')} onBack={() => setAuthStep('splash')} />
    );
  }

  // ── Email entry ───────────────────────────────────────────────────────────

  if (authStep === 'email') {
    const emailSwipeRef = { start: null };
    return (
      <div
        onTouchStart={e => { emailSwipeRef.start = e.touches[0].clientX; }}
        onTouchEnd={e => { if (emailSwipeRef.start !== null && e.changedTouches[0].clientX - emailSwipeRef.start > 50) { setAuthStep('onboarding'); } emailSwipeRef.start = null; }}
        style={{
        maxWidth: '480px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.primary, fontFamily: font,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <OtraLogoMark color='#FFFFFF' size={28} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 48px', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 8px', letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1.3' }}>
              Enter your email
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
              We'll send you a code to confirm it's you.
            </p>
          </div>
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email" placeholder="your@email.com"
              value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)}
              required disabled={loading} autoFocus
              className="fulmi-input"
              style={{
                height: '52px', padding: '0 16px', borderRadius: radius.lg,
                border: 'none', fontSize: '15px',
                backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
                outline: 'none', fontFamily: font,
              }}
            />
            {otpError && <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{otpError}</p>}
            <button type="submit" disabled={loading || !pendingEmail} style={{
              height: '52px', cursor: 'pointer', borderRadius: radius.lg,
              border: 'none', backgroundColor: '#FFFFFF',
              fontSize: '15px', fontWeight: '700', color: t.primary,
              fontFamily: font, marginTop: '4px',
              opacity: (loading || !pendingEmail) ? 0.6 : 1,
            }}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── OTP verification ──────────────────────────────────────────────────────

  if (authStep === 'otp') {
    return (
      <div style={{
        maxWidth: '480px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.primary, fontFamily: font,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <OtraLogoMark color='#FFFFFF' size={28} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 48px', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 8px', letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1.3' }}>
              Check your inbox
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
              We sent a 6-digit code to <strong style={{ color: '#FFFFFF' }}>{pendingEmail}</strong>
            </p>
          </div>
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" placeholder="000000"
              maxLength={6}
              value={otpCode} onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
              required disabled={loading} autoFocus
              className="fulmi-input"
              style={{
                height: '52px', padding: '0 16px', borderRadius: radius.lg,
                border: 'none', fontSize: '22px', letterSpacing: '0.25em', textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
                outline: 'none', fontFamily: font,
              }}
            />
            {otpError && <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{otpError}</p>}
            <button type="submit" disabled={loading || otpCode.length < 6} style={{
              height: '52px', cursor: 'pointer', borderRadius: radius.lg,
              border: 'none', backgroundColor: '#FFFFFF',
              fontSize: '15px', fontWeight: '700', color: t.primary,
              fontFamily: font, marginTop: '4px',
              opacity: (loading || otpCode.length < 6) ? 0.6 : 1,
            }}>
              {loading ? 'Verifying…' : 'Confirm'}
            </button>
          </form>
          <div style={{ textAlign: 'center' }}>
            {resendCountdown > 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                Resend in {resendCountdown}s
              </p>
            ) : (
              <button
                onClick={async () => {
                  setOtpError('');
                  setOtpCode('');
                  const ok = await supabase.sendOtp(pendingEmail);
                  if (ok) setResendCountdown(30);
                  else setOtpError('Could not resend. Try again.');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontFamily: font, textDecoration: 'underline' }}
              >
                Resend code
              </button>
            )}
          </div>
          <button
            onClick={() => { setAuthStep('email'); setOtpCode(''); setOtpError(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.55)', fontFamily: font, textAlign: 'center' }}
          >
            ← Change email
          </button>
        </div>
      </div>
    );
  }

  // ── Age + Terms ───────────────────────────────────────────────────────────

  if (authStep === 'age') {
    const ageSwipeRef = { start: null };
    return (
      <div
        onTouchStart={e => { ageSwipeRef.start = e.touches[0].clientX; }}
        onTouchEnd={e => { if (ageSwipeRef.start !== null && e.changedTouches[0].clientX - ageSwipeRef.start > 50) { setAuthStep('email'); } ageSwipeRef.start = null; }}
        style={{
        maxWidth: '480px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.bg, fontFamily: font,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <OtraLogoMark color={t.primary} size={28} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 48px', gap: '28px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: t.dark, margin: '0 0 8px', letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1.3' }}>
              Almost there
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: t.textSec, lineHeight: '1.5' }}>
              Confirm the following to get started.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: t.textMuted, fontFamily: font, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Your name</label>
            <input
              type="text"
              placeholder="How should we call you?"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              style={{
                height: '48px', padding: '0 14px', borderRadius: radius.lg,
                fontSize: '15px', border: 'none',
                backgroundColor: t.white, color: t.dark,
                outline: 'none', fontFamily: font, boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { checked: ageChecked, set: setAgeChecked, label: 'I am 18 years old or older' },
              { checked: termsChecked, set: setTermsChecked, label: (
                <>I agree to the <a href="/terms" style={{ color: t.primary }}>Terms of Service</a> and <a href="/privacy" style={{ color: t.primary }}>Privacy Policy</a></>
              )},
            ].map(({ checked, set, label }, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <div
                  onClick={() => set(v => !v)}
                  style={{
                    width: '22px', height: '22px', borderRadius: radius.sm, flexShrink: 0, marginTop: '1px',
                    border: `2px solid ${checked ? t.primary : t.borderDark}`,
                    backgroundColor: checked ? t.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {checked && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontSize: '14px', color: t.text, lineHeight: '1.5' }}>{label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleConfirmAge}
            disabled={!ageChecked || !termsChecked || !userName.trim() || loading}
            style={{
              height: '52px', cursor: 'pointer', borderRadius: radius.lg,
              border: 'none', backgroundColor: t.dark,
              fontSize: '15px', fontWeight: '700', color: '#FFFFFF',
              fontFamily: font,
              opacity: (!ageChecked || !termsChecked || !userName.trim() || loading) ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // ── Festival picker ───────────────────────────────────────────────────────

  const submitFestivalRequest = async () => {
    const text = festivalRequestInput.trim();
    if (!text || festivalRequestStatus === 'submitting') return;
    setFestivalRequestStatus('submitting');
    await supabase.requestFestival(text, userId);
    setFestivalRequestInput('');
    setFestivalRequestStatus('sent');
  };

  if (!activeFestivalId) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', height: '100svh', backgroundColor: t.bg, fontFamily: font, display: 'flex', flexDirection: 'column' }}>
        {/* Sticky header */}
        <div style={{ padding: '24px 24px 0', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: t.dark, margin: 0, fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em' }}>Pick your festival</h1>
          {/* Fade into list */}
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: '32px', background: `linear-gradient(to bottom, ${t.bg} 0%, rgba(248,250,251,0) 100%)`, pointerEvents: 'none' }} />
        </div>
        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FESTIVAL_LIST.map(f => {
              const upcoming = f.start && new Date() < new Date(f.start);
              return (
                <button key={f.id} onClick={() => {
                  if (upcoming) return;
                  localStorage.setItem('fulmi_festival_id', f.id);
                  setActiveFestivalId(f.id);
                  setTab('home');
                  lastRefresh.current = 0;
                  loadData(userId, f.id);
                }} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: '14px 16px', borderRadius: radius.md,
                  backgroundColor: f.id === activeFestivalId ? t.primaryBg : t.white,
                  cursor: upcoming ? 'default' : 'pointer', textAlign: 'left', border: 'none', outline: 'none',
                  opacity: upcoming ? 0.5 : 1,
                }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: f.id === activeFestivalId ? t.primary : t.dark, fontFamily: font, margin: 0 }}>{f.fullName}</p>
                    <p style={{ fontSize: '12px', color: t.textMuted, fontFamily: font, margin: '2px 0 0' }}>{f.city} · {f.dates}</p>
                  </div>
                  {upcoming && <span style={{ fontSize: '10px', fontWeight: '700', color: t.textMuted, backgroundColor: t.border, borderRadius: radius.pill, padding: '2px 7px', fontFamily: font, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Coming soon</span>}
                  {f.id === activeFestivalId && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${t.border}` }}>
            {festivalRequestStatus === 'sent' ? (
              <p style={{ fontSize: '13px', color: t.textMuted, fontFamily: font, margin: 0 }}>Thanks! We'll let you know if it's added.</p>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: t.textMuted, fontFamily: font, margin: '0 0 8px' }}>Can't find it?</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text" placeholder="Your festival"
                    value={festivalRequestInput} onChange={(e) => setFestivalRequestInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitFestivalRequest(); }}
                    style={{
                      flex: 1, height: '44px', padding: '0 14px', borderRadius: radius.lg,
                      border: 'none', fontSize: '14px', backgroundColor: t.white,
                      color: t.dark, outline: 'none', fontFamily: font,
                    }}
                  />
                  <button
                    onClick={submitFestivalRequest}
                    disabled={!festivalRequestInput.trim() || festivalRequestStatus === 'submitting'}
                    style={{
                      height: '44px', padding: '0 16px', borderRadius: radius.lg,
                      border: 'none', backgroundColor: t.dark, color: '#FFFFFF',
                      fontSize: '13px', fontWeight: '700', fontFamily: font, cursor: 'pointer',
                      opacity: (!festivalRequestInput.trim() || festivalRequestStatus === 'submitting') ? 0.5 : 1,
                    }}
                  >
                    {festivalRequestStatus === 'submitting' ? '…' : 'Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────

  const unseenCrowdCount = [
    ...receivedRequests,
    ...sentRequests.filter(r => r.confirmed),
  ].filter(r => !seenCrowdIds.has(r.matchId)).length;
  const unseenAICount = confirmedMatches
    .filter(m => m.note?.visibility !== 'public' && !seenAIIds.has(m.matchId)).length;
  const totalConnectionsNotif = unseenCrowdCount + unseenAICount;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: t.bg, fontFamily: font, position: 'relative' }}>

      {/* Top header — flowing fade */}
      <div style={{
        padding: '12px 16px 20px',
        position: 'sticky',
        top: 0, left: 0, right: 0, zIndex: 10,
        background: 'linear-gradient(to bottom, #F8FAFB 60%, rgba(248,250,251,0))',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'auto' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: t.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <OtraLogoMark color={t.primary} size={22} />
          </div>
          {/* Festival selector — fully rounded pill */}
          <button
            onClick={() => setFestivalSwitcherOpen(true)}
            disabled={isModalOpen || vibeCreating || aiSearchActive}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              backgroundColor: t.white, border: 'none',
              borderRadius: radius.xxl, padding: '7px 10px 7px 14px',
              cursor: isModalOpen || vibeCreating || aiSearchActive ? 'default' : 'pointer',
              opacity: isModalOpen || vibeCreating || aiSearchActive ? 0.4 : 1,
            }}>
            <span style={{ fontSize: '11px', fontWeight: '500', fontFamily: font, color: t.textMuted, whiteSpace: 'nowrap' }}>{activeFestival?.fullName || 'Select festival'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', paddingBottom: '88px', backgroundColor: t.bg }}>

        {/* ── TAB: HOME ── */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100svh - 130px)' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 4px', color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em', lineHeight: '1.2' }}>
              {(() => {
                const name = userName || user?.email?.split('@')[0] || 'there';
                const festivalName = activeFestival?.name || activeFestival?.fullName;
                const today = new Date().toISOString().slice(0, 10);
                const { start, end } = activeFestival || {};
                const second = !start || !festivalName ? null
                  : today < start ? `can't wait for ${festivalName}!`
                  : today <= end ? `are you enjoying ${festivalName}?`
                  : `did you enjoy ${festivalName}?`;
                return (
                  <>
                    Hey {name},{second && <><br />{second}</>}
                  </>
                );
              })()}
            </h1>
            {/* Cards pushed to bottom */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px' }}>

              {/* AI Search card */}
              <button onClick={() => navigateTo('notes')} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', padding: '20px', borderRadius: radius.lg,
                border: 'none', backgroundColor: t.white,
                cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
              }}>
                {/* Icon + title + badge in one row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginBottom: '16px' }}>
                  <svg width="20" height="21" viewBox="0 0 23 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M9.29037 2.32259C9.71812 2.32259 10.0646 2.67 10.0646 3.09678C10.0646 3.52453 9.71812 3.87097 9.29037 3.87097C5.01483 3.87097 1.54842 7.33737 1.54842 11.6129C1.54842 15.8894 5.01483 19.3548 9.29037 19.3548C12.9698 19.3548 16.05 16.7875 16.8368 13.3461C16.9327 12.929 17.3488 12.6687 17.7659 12.7645C18.182 12.8593 18.4423 13.2745 18.3475 13.6906C17.9236 15.5448 16.9433 17.187 15.5943 18.4344L19.175 22.7302C19.4479 23.0583 19.4043 23.547 19.0763 23.8208C18.7482 24.0938 18.2604 24.0502 17.9866 23.7221L14.374 19.3867C12.9137 20.3447 11.168 20.9031 9.29034 20.9031C4.15935 20.9031 0 16.7438 0 11.6128C0 6.4828 4.15938 2.32259 9.29037 2.32259Z" fill={t.primary}/>
                    <path d="M17.552 0.211931C17.6032 -0.0706435 18.0097 -0.0706435 18.0591 0.211931C18.4307 2.34677 20.102 4.01997 22.2387 4.39158C22.5223 4.4419 22.5223 4.84837 22.2387 4.89772C20.1029 5.2703 18.4307 6.94255 18.0591 9.07737C18.0107 9.36091 17.6023 9.36091 17.552 9.07737C17.1803 6.94253 15.509 5.27032 13.3743 4.89772C13.0907 4.84836 13.0907 4.44192 13.3743 4.39158C15.5091 4.01997 17.1803 2.34675 17.552 0.211931Z" fill={t.primary}/>
                  </svg>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1', flex: 1 }}>AI Search</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(181,11,242,0.10)', borderRadius: radius.pill, padding: '4px 9px', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: t.primary, fontFamily: font }}>Matches only</span>
                  </div>
                </div>
                <p style={{ margin: '0 0 40px', fontSize: '13px', color: t.textSec, fontFamily: font, lineHeight: '1.5' }}>
                  Describe who you're looking for and the moment you shared. If they're also searching, AI will match you privately.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: t.dark, fontFamily: font }}>Find your missed connection</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
              </button>

              {/* Crowd card */}
              <button onClick={() => navigateTo('public')} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', padding: '20px', borderRadius: radius.lg,
                border: 'none', backgroundColor: t.white,
                cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
              }}>
                {/* Icon + title + badge in one row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginBottom: '16px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill="#5d8000"/>
                    <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill="#5d8000"/>
                    <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill="#5d8000"/>
                    <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill="#5d8000"/>
                    <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill="#5d8000"/>
                  </svg>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1', flex: 1 }}>Crowd</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(176,232,23,0.15)', borderRadius: radius.pill, padding: '4px 9px', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5d8000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#5d8000', fontFamily: font }}>Public</span>
                  </div>
                </div>
                <p style={{ margin: '0 0 40px', fontSize: '13px', color: t.textSec, fontFamily: font, lineHeight: '1.5' }}>
                  Post a moment to the Crowd wall. Anyone at the festival can see it, interact and connect with you.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: t.dark, fontFamily: font }}>See what people are sharing</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.dark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
              </button>
          </div>
          </div>
        )}

        {/* ── TAB: AI SEARCH ── */}
        {tab === 'notes' && (
          <SearchWithAI
            onSave={handleSaveNote}
            artists={activeFestival?.artists || []}
            days={activeFestival?.days || []}
            mySearches={searchCards}
            confirmedMatches={confirmedMatches}
            onNavigateToConnections={() => navigateTo('matches')}
            festival={activeFestival}
            onActiveChange={setAiSearchActive}
          />
        )}

        {/* ── TAB: CONNECTIONS ── */}
        {tab === 'matches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0', color: t.dark, letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>Connections</h1>
            </div>

            {/* Sub-tab switcher */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex', position: 'relative', width: '228px',
                backgroundColor: t.surface, borderRadius: radius.md,
                padding: '4px', gap: '0',
              }}>
                <div style={{
                  position: 'absolute', top: '4px', bottom: '4px',
                  left: matchSubTab === 'ai' ? '4px' : '114px',
                  width: '110px',
                  backgroundColor: t.white,
                  borderRadius: radius.sm,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'left 0.22s cubic-bezier(0.23, 1, 0.32, 1)',
                  pointerEvents: 'none',
                }} />
                {[{ id: 'ai', label: 'AI Search' }, { id: 'requests', label: 'Crowd' }].map(st => (
                  <button key={st.id} onClick={() => setMatchSubTab(st.id)} style={{
                    position: 'relative', zIndex: 1,
                    width: '110px', padding: '6px 0', borderRadius: radius.sm, cursor: 'pointer',
                    border: 'none', background: 'transparent', textAlign: 'center',
                    color: matchSubTab === st.id ? t.dark : t.textSec,
                    fontSize: '12px', fontWeight: matchSubTab === st.id ? '700' : '400',
                    fontFamily: font, letterSpacing: '0.03em',
                    transition: 'color 0.18s cubic-bezier(0.23, 1, 0.32, 1)', whiteSpace: 'nowrap',
                  }}>
                    {st.label}
                    {st.id === 'requests' && unseenCrowdCount > 0 && (
                      <span style={{
                        marginLeft: '5px',
                        backgroundColor: matchSubTab === 'requests' ? 'rgba(255,255,255,0.35)' : t.primary,
                        color: '#fff',
                        fontSize: '9px', fontWeight: '700',
                        borderRadius: radius.pill, padding: '1px 5px', fontFamily: font,
                        verticalAlign: 'middle',
                      }}>{unseenCrowdCount}</span>
                    )}
                    {st.id === 'ai' && unseenAICount > 0 && (
                      <span style={{
                        marginLeft: '5px',
                        backgroundColor: matchSubTab === 'ai' ? 'rgba(255,255,255,0.35)' : t.primary,
                        color: '#fff',
                        fontSize: '9px', fontWeight: '700',
                        borderRadius: radius.pill, padding: '1px 5px', fontFamily: font,
                        verticalAlign: 'middle',
                      }}>{unseenAICount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── SUB-TAB: AI FOUND ── */}
            {matchSubTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                {searchCards.length === 0 ? (
                  <NoSearchCard onCreateSearch={() => navigateTo('notes')} />
                ) : searchCards.map(({ note: myNote, matches }) => {
                  // Confirmed match for this note (by myNoteId survives festival switches)
                  const confirmedForNote = confirmedMatches.find(cm => cm.myNoteId === myNote.id);

                  const carouselItems = matches
                    .filter(m => m.userResponse !== 'no')
                    .map(m => {
                      const confirmed = confirmedMatches.find(cm => cm.note?.id === m.id) || (confirmedForNote?.note?.id === m.id ? confirmedForNote : null);
                      let state;
                      if (confirmed) {
                        const theyHaveIg = !!confirmed.note?.instagram;
                        const iHaveIg = !!myNote?.instagram;
                        state = (theyHaveIg && iHaveIg) ? 'mutual_done' : iHaveIg ? 'mutual_wait_theirs' : 'mutual_add_ig';
                      } else if (m.userResponse === 'yes') {
                        state = 'requested';
                      } else if (m.theyAlreadyRequested) {
                        state = 'they_want';
                      } else {
                        state = 'pending';
                      }
                      return { match: m, state, confirmed: confirmed || null };
                    });

                  // If card.matches is empty but we have a confirmed match, synthesise a carousel item
                  if (carouselItems.length === 0 && confirmedForNote) {
                    const theyHaveIg = !!confirmedForNote.note?.instagram;
                    const iHaveIg = !!myNote?.instagram;
                    const state = (theyHaveIg && iHaveIg) ? 'mutual_done' : iHaveIg ? 'mutual_wait_theirs' : 'mutual_add_ig';
                    carouselItems.push({ match: { ...confirmedForNote.note, userResponse: 'yes' }, state, confirmed: confirmedForNote });
                  }

                  const idx = carouselIndexes[myNote.id] || 0;
                  const clampedIdx = Math.min(idx, Math.max(0, carouselItems.length - 1));
                  const currentItem = carouselItems[clampedIdx] || null;
                  const setIdx = (val) => setCarouselIndexes(prev => ({ ...prev, [myNote.id]: typeof val === 'function' ? val(prev[myNote.id] || 0) : val }));

                  const fmtChip = s => s.replace(/_/g, ' ').replace(/\s*\(.*?\)/g, '').trim();
                  const metaChips = [
                    myNote.artist && myNote.artist !== 'Otro' ? myNote.artist : null,
                    myNote.time && fmtChip(myNote.time),
                    myNote.location && fmtChip(myNote.location),
                  ].filter(Boolean);

                  return (
                    <div key={myNote.id} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {/* Search label */}
                      <div style={{
                        backgroundColor: t.white,
                        borderRadius: `${radius.xl} ${radius.xl} 0 0`,
                        padding: '14px 14px 14px',
                      }}>
                        {metaChips.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            {metaChips.map((chip, i) => (
                              <span key={i} style={{ fontSize: '10px', color: t.textMuted, backgroundColor: t.surface, borderRadius: radius.sm, padding: '3px 8px', textTransform: 'capitalize' }}>{chip}</span>
                            ))}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '13px', color: t.text, fontFamily: font, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {myNote.description}
                        </p>
                      </div>

                      {/* Match carousel */}
                      {carouselItems.length === 0 ? (
                        <SearchingCard flatTop />
                      ) : (
                        <div
                          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                          onTouchEnd={e => {
                            if (touchStartX.current === null) return;
                            const diff = e.changedTouches[0].clientX - touchStartX.current;
                            if (Math.abs(diff) > 40) {
                              if (diff < 0 && clampedIdx < carouselItems.length - 1) setIdx(i => i + 1);
                              if (diff > 0 && clampedIdx > 0) setIdx(i => i - 1);
                            }
                            touchStartX.current = null;
                          }}
                        >
                          <UnifiedMatchCard
                            flatTop
                            item={currentItem}
                            authorName={noteAuthors[currentItem.match.user_id]}
                            myNote={myNote}
                            onNo={() => {
                              handleMatchResponse(myNote.id, currentItem.match.id, 'no');
                              setIdx(i => Math.max(0, Math.min(i, carouselItems.length - 2)));
                            }}
                            onYes={() => handleMatchResponse(myNote.id, currentItem.match.id, 'yes')}
                            onAddInstagram={(ig) => handleAddInstagram(myNote.id, ig)}
                          />
                          {carouselItems.length > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px' }}>
                              {carouselItems.map((_, i) => (
                                <button key={i} onClick={() => setIdx(i)} style={{
                                  width: i === clampedIdx ? '20px' : '6px',
                                  height: '6px', borderRadius: radius.xs, border: 'none',
                                  cursor: 'pointer', padding: 0,
                                  backgroundColor: i === clampedIdx ? t.primary : t.borderDark,
                                  transition: 'width 0.2s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                                }} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── SUB-TAB: CROWD ── */}
            {matchSubTab === 'requests' && (() => {
              const allCrowd = [
                ...receivedRequests.map(r => ({ ...r, direction: 'received' })),
                ...sentRequests.map(r => ({ ...r, direction: 'sent' })),
              ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                  {allCrowd.length === 0 ? (
                    <div style={{
                      backgroundColor: t.surface, borderRadius: radius.xl, padding: '24px 20px',
                      minHeight: '360px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center',
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill={t.textMuted}/>
                        <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill={t.textMuted}/>
                        <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill={t.textMuted}/>
                        <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill={t.textMuted}/>
                        <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill={t.textMuted}/>
                      </svg>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font }}>No crowd connections yet</p>
                        <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textMuted, fontFamily: font, lineHeight: '1.5' }}>Interact with the Crowd to create connections</p>
                      </div>
                      <button onClick={() => navigateTo('public')} style={{
                        padding: '12px 24px', borderRadius: radius.md, border: 'none',
                        backgroundColor: t.primary, color: '#fff', cursor: 'pointer',
                        fontSize: '14px', fontWeight: '700', fontFamily: font,
                      }}>Check the Crowd →</button>
                    </div>
                  ) : allCrowd.map(item => {
                    const req = item;
                    const isSent = item.direction === 'sent';
                    // Origin post = where the connection started: your post (received) or their post (sent)
                    const originPost = isSent ? req.theirVibeNote : req.myVibeNote;
                    const originName = isSent ? (req.authorName || 'Someone') : 'You';
                    const isAccepted = isSent ? req.confirmed : acceptedRequestIds.has(req.matchId);
                    const myVibeNote = isSent ? req.myNote : req.myVibeNote;
                    const onAddInstagram = isSent
                      ? async (ig) => {
                          if (!req.myNote) return;
                          await supabase.updateNote(req.myNote.id, { instagram: ig });
                          setMyNotes(prev => prev.map(n => n.id === req.myNote.id ? { ...n, instagram: ig } : n));
                          setSentRequests(prev => prev.map(r =>
                            r.matchId === req.matchId ? { ...r, myNote: { ...r.myNote, instagram: ig } } : r
                          ));
                        }
                      : async (ig) => {
                          if (!req.myVibeNote) return;
                          await supabase.updateNote(req.myVibeNote.id, { instagram: ig });
                          setMyNotes(prev => prev.map(n => n.id === req.myVibeNote.id ? { ...n, instagram: ig } : n));
                          setReceivedRequests(prev => prev.map(r =>
                            r.myVibeNote?.id === req.myVibeNote.id ? { ...r, myVibeNote: { ...r.myVibeNote, instagram: ig } } : r
                          ));
                        };

                    return (
                      <div key={req.matchId} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {/* Origin post header */}
                        {originPost && (
                          <div style={{
                            backgroundColor: t.white,
                            borderRadius: `${radius.xl} ${radius.xl} 0 0`,
                            padding: '14px 14px 14px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', fontFamily: font, color: isSent ? t.dark : CATEGORY_THEME.crowd.accent }}>{originName}</p>
                              {timeAgo(originPost.createdAt || originPost.created_at) && (
                                <span style={{ fontSize: '12px', color: t.textMuted, fontFamily: font }}>· {timeAgo(originPost.createdAt || originPost.created_at)}</span>
                              )}
                            </div>
                            {originPost.artist && originPost.artist !== 'Otro' && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                <span style={{ fontSize: '10px', color: t.textMuted, backgroundColor: t.surface, borderRadius: radius.xs, padding: '2px 7px', fontFamily: font, textTransform: 'capitalize' }}>{originPost.artist}</span>
                              </div>
                            )}
                            <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: '1.6', color: t.text, fontFamily: font }}>{originPost.description}</p>
                          </div>
                        )}
                        <RequestCard
                          flatTop={!!originPost}
                          direction={item.direction}
                          req={req}
                          isAccepted={isAccepted}
                          myVibeNote={myVibeNote}
                          theirVibeNote={isSent ? req.theirVibeNote : undefined}
                          onDecline={!isSent ? () => handleRequestResponse(req.matchId, false) : undefined}
                          onAccept={!isSent ? () => handleRequestResponse(req.matchId, true) : undefined}
                          onAddInstagram={onAddInstagram}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── TAB: CROWD ── */}
        {tab === 'public' && !vibeCreating && (
          <div style={{ margin: '0 -16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: t.dark, letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>Crowd</h1>
              <button onClick={() => { setVibeCreating(true); setVibeStep(0); setVibeText(''); setVibeArtist(null); }} style={{
                width: '38px', height: '38px', backgroundColor: t.primary,
                border: 'none', borderRadius: radius.md, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(181,11,242,0.30)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            <div style={{ padding: '0 16px 14px' }}>
              <div style={{
                display: 'inline-flex', position: 'relative',
                backgroundColor: t.surface, borderRadius: radius.md,
                padding: '4px', gap: '0',
              }}>
                {/* sliding pill */}
                <div style={{
                  position: 'absolute', top: '4px', bottom: '4px',
                  left: boardSubTab === 'everyone' ? '4px' : '68px',
                  width: boardSubTab === 'everyone' ? '64px' : '88px',
                  backgroundColor: t.white,
                  borderRadius: radius.sm,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'left 0.22s cubic-bezier(0.23, 1, 0.32, 1)',
                  pointerEvents: 'none',
                }} />
                {[{ id: 'everyone', label: 'All', w: '64px' }, { id: 'mine', label: 'My posts', w: '88px' }].map(st => (
                  <button key={st.id} onClick={() => setBoardSubTab(st.id)} style={{
                    position: 'relative', zIndex: 1,
                    width: st.w, padding: '6px 0', borderRadius: radius.sm, cursor: 'pointer',
                    border: 'none', background: 'transparent', textAlign: 'center',
                    color: boardSubTab === st.id ? t.dark : t.textSec,
                    fontSize: '12px', fontWeight: boardSubTab === st.id ? '700' : '400',
                    fontFamily: font, letterSpacing: '0.03em',
                    transition: 'color 0.18s cubic-bezier(0.23, 1, 0.32, 1)',
                  }}>{st.label}</button>
                ))}
              </div>
            </div>

            {boardSubTab === 'mine' && (() => {
              const myPublic = myNotes.filter(n => n.visibility === 'public');
              return myPublic.length === 0 ? (
                <div style={{ padding: '0 16px' }}>
                  <div style={{
                    backgroundColor: t.surface, borderRadius: radius.xl, padding: '24px 20px',
                    minHeight: '360px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill={t.textMuted}/>
                      <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill={t.textMuted}/>
                      <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill={t.textMuted}/>
                      <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill={t.textMuted}/>
                      <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill={t.textMuted}/>
                    </svg>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font }}>No posts yet</p>
                      <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textMuted, fontFamily: font, lineHeight: '1.5' }}>Share a moment with the crowd to start creating connections</p>
                    </div>
                    <button onClick={() => { setVibeCreating(true); setVibeStep(0); setVibeText(''); setVibeArtist(null); }} style={{
                      padding: '12px 24px', borderRadius: radius.md, border: 'none',
                      backgroundColor: t.primary, color: '#fff', cursor: 'pointer',
                      fontSize: '14px', fontWeight: '700', fontFamily: font,
                    }}>Create a post <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginLeft: '2px' }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0 16px 24px' }}>
                  <VibesFeed
                    key={activeFestivalId}
                    notes={myPublic}
                    noteAuthors={noteAuthors}
                    onSendRequest={handleSendRequest}
                    onLike={handleLikePublic}
                    onDelete={handleDeleteNote}
                    myUserId={userId}
                    onNavigateToConnections={() => { setMatchSubTab('requests'); navigateTo('matches'); }}
                  />
                </div>
              );
            })()}

            {boardSubTab === 'everyone' && (
              <div style={{ padding: '0 0 24px' }}>
                <VibesFeed
                  key={activeFestivalId}
                  notes={publicNotes}
                  noteAuthors={noteAuthors}
                  onSendRequest={handleSendRequest}
                  onLike={handleLikePublic}
                  onDelete={handleDeleteNote}
                  myUserId={userId}
                  onCreatePost={() => { setVibeCreating(true); setVibeStep(0); setVibeText(''); setVibeArtist(null); }}
                  onNavigateToConnections={() => { setMatchSubTab('requests'); navigateTo('matches'); }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CROWD — inline creation ── */}
        {tab === 'public' && vibeCreating && (() => {
          const resetVibe = () => {
            setVibeCreating(false);
            setVibeStep(0); setVibeText(''); setVibeArtist(null);
          };
          const submitVibe = () => {
            handleSaveNote({
              visibility: 'public', description: vibeText, artist: vibeArtist,
              location: null, time: null, ownDesc: null,
              instagram: null, searchIntent: false,
            });
            resetVibe();
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 130px)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: t.dark, fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em' }}>
                  {vibeStep === 0 ? 'Share your moment' : vibeStep === 1 ? 'What were you watching?' : vibeStep === 2 ? 'Where were you?' : vibeStep === 3 ? 'When?' : 'About you'}
                </h1>
                <button onClick={resetVibe} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: t.textMuted, fontSize: '20px', lineHeight: 1 }}>✕</button>
              </div>
              {/* Fade gradient below title — only on steps with a scrollable list */}
              {vibeStep === 1 && <div style={{
                flexShrink: 0, height: '28px', marginBottom: '-28px',
                background: `linear-gradient(to bottom, ${t.bg}, transparent)`,
                zIndex: 1, pointerEvents: 'none', position: 'relative',
              }} />}

              {/* Step 0: text */}
              {vibeStep === 0 && (
                <>
                  <p style={{ fontSize: '13px', color: t.textMuted, margin: '0 0 16px', fontFamily: font }}>
                    Share a moment with everyone at the festival — visible to all on the Crowd wall. To find a specific person, use Search instead.
                  </p>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      autoFocus
                      value={vibeText}
                      onChange={e => setVibeText(e.target.value)}
                      placeholder="Four Tet dropped that track and everyone just went silent. Still thinking about it."
                      style={{
                        width: '100%', minHeight: '180px', padding: '14px 14px 48px', borderRadius: radius.lg,
                        fontSize: '14px', fontFamily: font, border: 'none',
                        color: t.dark, backgroundColor: t.white, boxSizing: 'border-box',
                        resize: 'none', outline: 'none', lineHeight: '1.65',
                      }}
                    />
                    {/* Public indicator — bottom left */}
                    <div style={{ position: 'absolute', bottom: '14px', left: '14px', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: 'none' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>Public · visible to everyone</span>
                    </div>
                    {/* Arrow button — bottom right */}
                    <button
                      onClick={() => setVibeStep(1)}
                      disabled={!vibeText.trim()}
                      style={{
                        position: 'absolute', bottom: '12px', right: '12px',
                        width: '36px', height: '36px', borderRadius: radius.circle, border: 'none',
                        backgroundColor: vibeText.trim() ? t.dark : t.borderDark,
                        color: '#fff', cursor: vibeText.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)', flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}

              {/* Step 1: artist */}
              {vibeStep === 1 && (
                <>
                  <p style={{ fontSize: '13px', color: t.textMuted, margin: '0 0 16px', fontFamily: font }}>
                    Which artist were you at?
                  </p>
                  <div style={{
                    flex: 1, minHeight: 0, maxHeight: '42vh',
                    WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                    overflowY: 'auto',
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start', paddingBottom: '48px' }}>
                      {(activeFestival?.artists || []).filter(a => a !== 'Otro').slice().sort((a, b) => a.localeCompare(b)).map(artist => (
                        <button key={artist} onClick={() => setVibeArtist(vibeArtist === artist ? null : artist)} style={{
                          padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer',
                          border: 'none',
                          backgroundColor: vibeArtist === artist ? t.primaryBg : t.white,
                          fontSize: '12px', color: vibeArtist === artist ? t.primary : t.textSec,
                          fontWeight: vibeArtist === artist ? '600' : '400', fontFamily: font,
                          transition: 'background-color 0.15s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.15s cubic-bezier(0.23, 1, 0.32, 1), color 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                        }}>{artist}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', paddingTop: '20px' }}>
                    <button onClick={() => setVibeStep(0)} style={{
                      flex: 1, padding: '14px', borderRadius: radius.md, border: 'none',
                      backgroundColor: t.white,
                      color: t.dark, fontSize: '14px', fontWeight: '500', fontFamily: font, cursor: 'pointer',
                    }}>← Back</button>
                    <button onClick={submitVibe} style={{
                      flex: 2, padding: '14px', borderRadius: radius.md, border: 'none',
                      backgroundColor: t.primary, color: '#fff',
                      fontSize: '14px', fontWeight: '700', fontFamily: font, cursor: 'pointer',
                    }}>Share ✓</button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── TAB: PROFILE ── */}
        {tab === 'profile' && (() => {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: t.dark, letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>Profile</h1>

              {/* User card */}
              {(() => {
                const displayName = userName.trim() || user.email.split('@')[0];
                const saveName = () => {
                  const v = nameDraft.trim();
                  setUserName(v);
                  if (v) localStorage.setItem('fulmi_user_name', v);
                  else localStorage.removeItem('fulmi_user_name');
                  if (v && userId) supabase.updateUser(userId, { name: v });
                  setEditingName(false);
                };
                return (
              <div style={{ ...cardStyle, boxShadow: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: radius.lg,
                    backgroundColor: t.primaryBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', fontWeight: '700', color: t.primary, flexShrink: 0,
                  }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {editingName ? (
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={e => setNameDraft(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                        placeholder="Your name"
                        style={{ width: '100%', padding: '2px 0', border: 'none', borderBottom: `1.5px solid ${t.primary}`, outline: 'none', background: 'none', fontSize: '16px', fontWeight: '700', fontFamily: font, color: t.dark, boxSizing: 'border-box' }}
                      />
                    ) : (
                      <button
                        onClick={() => { setNameDraft(userName); setEditingName(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', maxWidth: '100%' }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
                        </svg>
                      </button>
                    )}
                    <p style={{ fontSize: '13px', fontWeight: '400', margin: '2px 0 0', color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { value: myNotes.filter(n => n.visibility === 'targeted' || n.visibility === 'private').length, label: 'Searches' },
                    { value: myNotes.filter(n => n.visibility === 'public').length, label: 'Posts' },
                    { value: confirmedMatches.length, label: 'Connections' },
                  ].map(({ value, label }) => (
                    <div key={label} style={{ backgroundColor: t.surface, padding: '12px', borderRadius: radius.md, textAlign: 'center' }}>
                      <p style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 2px', color: t.dark }}>{value}</p>
                      <p style={{ fontSize: '11px', color: t.textMuted, margin: 0 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
                );
              })()}

              {/* Legal + account actions */}
              {(() => {
                const profileBtnStyle = {
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: t.white, border: 'none', borderRadius: radius.md,
                  padding: '10px 14px', cursor: 'pointer', color: t.textMuted,
                  fontSize: '13px', fontFamily: font, fontWeight: '500', width: '100%',
                  textDecoration: 'none',
                };
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={profileBtnStyle}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      Terms of Service
                    </a>
                    <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={profileBtnStyle}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Privacy Policy
                    </a>
                    <button
                      onClick={() => setShowDeleteAccountModal(true)}
                      style={profileBtnStyle}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                      Delete account
                    </button>
                    <button
                      onClick={() => setShowSignOutModal(true)}
                      style={{ ...profileBtnStyle, marginTop: '12px' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign out
                    </button>
                  </div>
                );
              })()}

            </div>
          );
        })()}
      </div>

      <CreateNoteFlow isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveNote} days={activeFestival?.days || []} />

      {/* Delete account modal */}
      {showDeleteAccountModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }} onClick={() => setShowDeleteAccountModal(false)}>
          <div style={{
            backgroundColor: t.border, borderRadius: radius.xxl,
            padding: '24px', width: '100%', maxWidth: '360px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: t.dark, fontFamily: font }}>Delete account?</span>
              <button onClick={() => setShowDeleteAccountModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: t.textMuted, display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontFamily: font, fontSize: '14px', color: t.textSec, margin: '0 0 24px', lineHeight: '1.5' }}>To delete your account, email <strong>hello@otra.social</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => { window.location.href = 'mailto:hello@otra.social?subject=Delete%20my%20account'; setShowDeleteAccountModal(false); }}
                style={{ width: '100%', padding: '13px', background: t.primary, border: 'none', borderRadius: radius.md, fontSize: '15px', fontWeight: '700', color: '#fff', cursor: 'pointer', fontFamily: font }}
              >
                Send email
              </button>
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                style={{ width: '100%', padding: '13px', background: t.white, border: 'none', borderRadius: radius.md, fontSize: '15px', fontWeight: '500', color: t.dark, cursor: 'pointer', fontFamily: font }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign out modal */}
      {showSignOutModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }} onClick={() => setShowSignOutModal(false)}>
          <div style={{
            backgroundColor: t.border, borderRadius: radius.xxl,
            padding: '24px', width: '100%', maxWidth: '360px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: t.dark, fontFamily: font }}>Sign out?</span>
              <button onClick={() => setShowSignOutModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: t.textMuted, display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontFamily: font, fontSize: '14px', color: t.textSec, margin: '0 0 24px', lineHeight: '1.5' }}>You'll need to log in again to access your account.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => { setShowSignOutModal(false); localStorage.removeItem('fulmi_user_email'); localStorage.removeItem('fulmi_user_id'); supabase.clearSession(); setUser(null); setUserId(null); setSearchCards([]); setMyNotes([]); setPublicNotes([]); setConfirmedMatches([]); setReceivedRequests([]); setSentRequests([]); setSeenCrowdIds(new Set()); setSeenAIIds(new Set()); setAuthStep('splash'); }}
                style={{ width: '100%', padding: '13px', background: t.primary, border: 'none', borderRadius: radius.md, fontSize: '15px', fontWeight: '700', color: '#fff', cursor: 'pointer', fontFamily: font }}
              >
                Sign out
              </button>
              <button
                onClick={() => setShowSignOutModal(false)}
                style={{ width: '100%', padding: '13px', background: t.white, border: 'none', borderRadius: radius.md, fontSize: '15px', fontWeight: '500', color: t.dark, cursor: 'pointer', fontFamily: font }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Festival switcher full-page */}
      {festivalSwitcherOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: t.bg, zIndex: 50,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Sticky header */}
          <div style={{ maxWidth: '480px', width: '100%', margin: '0 auto', padding: '16px 20px 12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
              <p style={{ fontSize: '28px', fontWeight: '700', color: t.dark, margin: 0, fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em' }}>Switch festival</p>
              <button onClick={() => setFestivalSwitcherOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: t.textMuted, display: 'flex', alignItems: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          {/* Fade gradient below header */}
          <div style={{
            flexShrink: 0, height: '24px', marginBottom: '-24px',
            background: `linear-gradient(to bottom, ${t.bg}, transparent)`,
            zIndex: 1, pointerEvents: 'none', position: 'relative',
          }} />
          {/* Scrollable list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            maxWidth: '480px', margin: '0 auto',
            padding: '4px 20px 48px', display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {FESTIVAL_LIST.map(f => {
              const upcoming = f.start && new Date() < new Date(f.start);
              return (
                <button key={f.id} onClick={() => {
                  if (upcoming) return;
                  localStorage.setItem('fulmi_festival_id', f.id);
                  setActiveFestivalId(f.id);
                  setFestivalSwitcherOpen(false);
                  navigateTo('home');
                }} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: '14px 16px', borderRadius: radius.md,
                  backgroundColor: f.id === activeFestivalId ? t.primaryBg : t.white,
                  cursor: upcoming ? 'default' : 'pointer', textAlign: 'left', border: 'none', outline: 'none',
                  opacity: upcoming ? 0.5 : 1,
                }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: f.id === activeFestivalId ? t.primary : t.dark, fontFamily: font, margin: 0 }}>{f.fullName}</p>
                    <p style={{ fontSize: '12px', color: t.textMuted, fontFamily: font, margin: '2px 0 0' }}>{f.city} · {f.dates}</p>
                  </div>
                  {upcoming && <span style={{ fontSize: '10px', fontWeight: '700', color: t.textMuted, backgroundColor: t.border, borderRadius: radius.pill, padding: '2px 7px', fontFamily: font, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Coming soon</span>}
                  {f.id === activeFestivalId && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
            <div style={{ marginTop: '6px', paddingTop: '14px', borderTop: `1px solid ${t.border}` }}>
              {festivalRequestStatus === 'sent' ? (
                <p style={{ fontSize: '13px', color: t.textMuted, fontFamily: font, margin: 0 }}>Thanks! We'll let you know if it's added.</p>
              ) : (
                <>
                  <p style={{ fontSize: '12px', color: t.textMuted, fontFamily: font, margin: '0 0 8px' }}>Can't find it?</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text" placeholder="Your festival"
                      value={festivalRequestInput} onChange={(e) => setFestivalRequestInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitFestivalRequest(); }}
                      style={{
                        flex: 1, height: '44px', padding: '0 14px', borderRadius: radius.lg,
                        border: 'none', fontSize: '14px', backgroundColor: t.white,
                        color: t.dark, outline: 'none', fontFamily: font,
                      }}
                    />
                    <button
                      onClick={submitFestivalRequest}
                      disabled={!festivalRequestInput.trim() || festivalRequestStatus === 'submitting'}
                      style={{
                        height: '44px', padding: '0 16px', borderRadius: radius.lg,
                        border: 'none', backgroundColor: t.dark, color: '#FFFFFF',
                        fontSize: '13px', fontWeight: '700', fontFamily: font, cursor: 'pointer',
                        opacity: (!festivalRequestInput.trim() || festivalRequestStatus === 'submitting') ? 0.5 : 1,
                      }}
                    >
                      {festivalRequestStatus === 'submitting' ? '…' : 'Request'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation — flowing fade */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px',
        background: 'linear-gradient(to top, #F8FAFB 60%, rgba(248,250,251,0))',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '20px 16px 16px', zIndex: 20,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: '448px',
          backgroundColor: t.white, borderRadius: radius.pill,
          display: 'flex', alignItems: 'flex-end',
          padding: '6px 8px 10px', gap: '4px',
          pointerEvents: 'auto',
        }}>
        {/* Home */}
        <button onClick={() => navigateTo('home')} style={{
          flex: 1, background: 'none', border: 'none', padding: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: tab === 'home' ? t.primary : t.textMuted,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>

        {/* AI Search */}
        <button onClick={() => navigateTo('notes')} style={{
          flex: 1, background: 'none', border: 'none', padding: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg width="22" height="23" viewBox="0 0 23 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.29037 2.32259C9.71812 2.32259 10.0646 2.67 10.0646 3.09678C10.0646 3.52453 9.71812 3.87097 9.29037 3.87097C5.01483 3.87097 1.54842 7.33737 1.54842 11.6129C1.54842 15.8894 5.01483 19.3548 9.29037 19.3548C12.9698 19.3548 16.05 16.7875 16.8368 13.3461C16.9327 12.929 17.3488 12.6687 17.7659 12.7645C18.182 12.8593 18.4423 13.2745 18.3475 13.6906C17.9236 15.5448 16.9433 17.187 15.5943 18.4344L19.175 22.7302C19.4479 23.0583 19.4043 23.547 19.0763 23.8208C18.7482 24.0938 18.2604 24.0502 17.9866 23.7221L14.374 19.3867C12.9137 20.3447 11.168 20.9031 9.29034 20.9031C4.15935 20.9031 0 16.7438 0 11.6128C0 6.4828 4.15938 2.32259 9.29037 2.32259Z" fill={tab === 'notes' ? t.primary : t.textMuted}/>
            <path d="M17.552 0.211931C17.6032 -0.0706435 18.0097 -0.0706435 18.0591 0.211931C18.4307 2.34677 20.102 4.01997 22.2387 4.39158C22.5223 4.4419 22.5223 4.84837 22.2387 4.89772C20.1029 5.2703 18.4307 6.94255 18.0591 9.07737C18.0107 9.36091 17.6023 9.36091 17.552 9.07737C17.1803 6.94253 15.509 5.27032 13.3743 4.89772C13.0907 4.84836 13.0907 4.44192 13.3743 4.39158C15.5091 4.01997 17.1803 2.34675 17.552 0.211931Z" fill={tab === 'notes' ? t.primary : t.textMuted}/>
          </svg>
        </button>

        {/* Vibes */}
        <button onClick={() => navigateTo('public')} style={{
          flex: 1, background: 'none', border: 'none', padding: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill={tab === 'public' ? t.primary : t.textMuted}/>
            <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill={tab === 'public' ? t.primary : t.textMuted}/>
            <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill={tab === 'public' ? t.primary : t.textMuted}/>
            <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill={tab === 'public' ? t.primary : t.textMuted}/>
            <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill={tab === 'public' ? t.primary : t.textMuted}/>
          </svg>
        </button>

        {/* Connections — thunder icon */}
        <button onClick={() => navigateTo('matches')} style={{
          flex: 1, background: 'none', border: 'none', padding: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: tab === 'matches' ? t.primary : t.textMuted,
          position: 'relative',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          {totalConnectionsNotif > 0 && (
            <span style={{
              position: 'absolute', top: '6px', right: 'calc(50% - 22px)',
              backgroundColor: t.primary, color: '#fff',
              fontSize: '9px', fontWeight: '700',
              borderRadius: radius.pill, padding: '1px 5px',
              fontFamily: font, lineHeight: '1.4',
              pointerEvents: 'none',
            }}>{totalConnectionsNotif}</span>
          )}
        </button>

        {/* Profile */}
        <button onClick={() => navigateTo('profile')} style={{
          flex: 1, background: 'none', border: 'none', padding: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: tab === 'profile' ? t.primary : t.textMuted,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </button>
        </div>
      </div>
    </div>
  );
};

// ─── Shared card + button styles ───────────────────────────────────────────

const cardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: radius.lg, padding: '14px',
  boxShadow: '0 1px 6px rgba(29,29,47,0.07)',
};

// ─── Hourglass SVG (shared) ────────────────────────────────────────────────
const HourglassIcon = ({ size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14"/><path d="M5 2h14"/>
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
  </svg>
);

// ─── Shared Connections state modules (used by both AI Search & Crowd cards) ──
// Waiting status — hourglass in a (non-interactive) circle frame + label below.
const StatusRow = ({ theme, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
    <div style={{
      width: '60px', height: '60px', borderRadius: radius.circle,
      backgroundColor: theme.tint, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <HourglassIcon size={24} color={theme.accent} />
    </div>
    <span style={{ fontSize: '13px', fontWeight: '600', color: theme.accent, fontFamily: font }}>{label}</span>
  </div>
);

// Decline / Accept as circular icon buttons (X + thunder), tinted in the category color.
const DecisionButtons = ({ theme, onNo, onYes }) => (
  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
    <button onClick={onNo} style={{
      width: '60px', height: '60px', borderRadius: radius.circle,
      backgroundColor: t.white, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(29,29,47,0.08)',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <button onClick={onYes} style={{
      width: '60px', height: '60px', borderRadius: radius.circle, border: 'none',
      backgroundColor: theme.accent, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 4px 16px ${theme.shadow}`,
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    </button>
  </div>
);

// Instagram icon (shared) — used by both the contact input and reveal.
const InstagramIcon = ({ color, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

// Contact (Instagram) input — styled as the shared "INSTAGRAM / WHATSAPP" field bar.
const ContactInput = ({ theme, value, onChange, onSubmit }) => (
  <div style={{ backgroundColor: t.white, borderRadius: radius.md, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
    <InstagramIcon color={theme.accent} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: '0 0 1px', fontSize: '10px', color: theme.accent, fontWeight: '700', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Instagram / WhatsApp</p>
      <input
        type="text" placeholder="@your_instagram"
        value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && value.trim() && onSubmit(value.trim())}
        style={{ width: '100%', padding: 0, border: 'none', outline: 'none', background: 'none', fontSize: '17px', fontWeight: '700', fontFamily: font, color: t.dark, boxSizing: 'border-box' }}
      />
    </div>
    <button
      onClick={() => value.trim() && onSubmit(value.trim())}
      disabled={!value.trim()}
      style={{ width: '38px', height: '38px', borderRadius: radius.circle, border: 'none', flexShrink: 0, backgroundColor: value.trim() ? theme.accent : t.borderDark, cursor: value.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
);

// Revealed contact handle — same field bar, with copy-to-clipboard.
const ContactRevealed = ({ theme, handle }) => {
  const h = String(handle).replace(/^@+/, '');
  const [copied, setCopied] = React.useState(false);
  return (
    <div style={{ backgroundColor: t.white, borderRadius: radius.md, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <InstagramIcon color={theme.accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 1px', fontSize: '10px', color: theme.accent, fontWeight: '700', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Instagram / WhatsApp</p>
        <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis' }}>@{h}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard?.writeText('@' + h); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0, color: theme.accent, display: 'flex', alignItems: 'center' }}
        title="Copy"
      >
        {copied ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        )}
      </button>
    </div>
  );
};

// ─── NoSearchCard ──────────────────────────────────────────────────────────
const NoSearchCard = ({ onCreateSearch }) => (
  <div style={{
    backgroundColor: t.surface,
    borderRadius: radius.xl, padding: '24px 20px',
    minHeight: '360px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center',
  }}>
    <svg width="32" height="32" viewBox="0 0 23 24" fill="none">
      <path d="M9.29037 2.32259C9.71812 2.32259 10.0646 2.67 10.0646 3.09678C10.0646 3.52453 9.71812 3.87097 9.29037 3.87097C5.01483 3.87097 1.54842 7.33737 1.54842 11.6129C1.54842 15.8894 5.01483 19.3548 9.29037 19.3548C12.9698 19.3548 16.05 16.7875 16.8368 13.3461C16.9327 12.929 17.3488 12.6687 17.7659 12.7645C18.182 12.8593 18.4423 13.2745 18.3475 13.6906C17.9236 15.5448 16.9433 17.187 15.5943 18.4344L19.175 22.7302C19.4479 23.0583 19.4043 23.547 19.0763 23.8208C18.7482 24.0938 18.2604 24.0502 17.9866 23.7221L14.374 19.3867C12.9137 20.3447 11.168 20.9031 9.29034 20.9031C4.15935 20.9031 0 16.7438 0 11.6128C0 6.4828 4.15938 2.32259 9.29037 2.32259Z" fill={t.textMuted}/>
      <path d="M17.552 0.211931C17.6032 -0.0706435 18.0097 -0.0706435 18.0591 0.211931C18.4307 2.34677 20.102 4.01997 22.2387 4.39158C22.5223 4.4419 22.5223 4.84837 22.2387 4.89772C20.1029 5.2703 18.4307 6.94255 18.0591 9.07737C18.0107 9.36091 17.6023 9.36091 17.552 9.07737C17.1803 6.94253 15.509 5.27032 13.3743 4.89772C13.0907 4.84836 13.0907 4.44192 13.3743 4.39158C15.5091 4.01997 17.1803 2.34675 17.552 0.211931Z" fill={t.textMuted}/>
    </svg>
    <div>
      <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font }}>No search active</p>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textMuted, fontFamily: font, lineHeight: '1.5' }}>Create an AI search to start finding your match</p>
    </div>
    <button onClick={onCreateSearch} style={{
      padding: '12px 24px', borderRadius: radius.md, border: 'none',
      backgroundColor: t.primary, color: '#fff', cursor: 'pointer',
      fontSize: '14px', fontWeight: '700', fontFamily: font,
    }}>Create search →</button>
  </div>
);

// ─── SearchingCard ─────────────────────────────────────────────────────────
const SearchingCard = ({ text, sub, flatTop } = {}) => (
  <div style={{
    backgroundColor: text ? t.surface : t.primaryBg,
    borderRadius: flatTop ? `0 0 ${radius.xl} ${radius.xl}` : radius.xl, padding: '24px 20px',
    minHeight: '360px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center',
  }}>
    {!text && (
      <OtraLogoMark color={t.primary} size={52} animatePupil />
    )}
    <div>
      <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font }}>
        {text || 'Looking for matches…'}
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, fontFamily: font }}>
        {sub || 'Finding people who shared the same moment'}
      </p>
    </div>
  </div>
);

// ─── UnifiedMatchCard ──────────────────────────────────────────────────────
const UnifiedMatchCard = ({ item, authorName, myNote, onNo, onYes, onAddInstagram, flatTop }) => {
  const [igInput, setIgInput] = React.useState('');
  const { match, state, confirmed } = item;
  const theme = CATEGORY_THEME.ai;
  const isMutual = state.startsWith('mutual');

  const [showSelfDesc, setShowSelfDesc] = React.useState(false);

  const chips = [
    match.artist && match.artist !== 'Otro' ? { label: match.artist, key: 'artist' } : null,
    match.time ? { label: match.time.replace(/_/g, ' ').replace(/\s*\(.*?\)/g, '').trim(), key: 'time' } : null,
    match.location ? { label: match.location.replace(/_/g, ' '), key: 'location' } : null,
  ].filter(Boolean);

  const isCommon = (key) => {
    if (!myNote) return false;
    if (key === 'artist') return myNote.artist && myNote.artist === match.artist;
    if (key === 'time') return myNote.time && myNote.time === match.time;
    if (key === 'location') return myNote.location && myNote.location === match.location;
    return false;
  };

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      borderRadius: flatTop ? `0 0 ${radius.xl} ${radius.xl}` : radius.xl, padding: '24px 20px 20px',
      minHeight: '360px', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font }}>
              {authorName || 'Someone'}
            </span>
            {match.ownDesc && (
              <button onClick={() => setShowSelfDesc(v => !v)} style={{
                width: '20px', height: '20px', borderRadius: radius.circle, border: 'none',
                backgroundColor: showSelfDesc ? theme.accent : 'rgba(29,29,47,0.08)',
                color: showSelfDesc ? '#fff' : t.textMuted,
                fontSize: '13px', fontWeight: '700', lineHeight: 1,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.2s, color 0.2s',
                padding: 0, flexShrink: 0,
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  {showSelfDesc
                    ? <line x1="1" y1="5" x2="9" y2="5" />
                    : <><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></>
                  }
                </svg>
              </button>
            )}
          </div>
          <span style={{ fontSize: '12px', color: theme.accent, fontWeight: '600', fontFamily: font }}>Matched by AI</span>
        </div>
        {isMutual && (
          <Badge label="Connected" color={theme.accent} bg={theme.tint} border={theme.border} />
        )}
      </div>

      {/* Self-description (expandable) */}
      {showSelfDesc && match.ownDesc && (
        <p style={{
          fontSize: '13px', lineHeight: '1.5', color: t.textMuted, margin: '0 0 14px',
          fontFamily: font, fontStyle: 'italic',
          backgroundColor: 'rgba(29,29,47,0.03)', borderRadius: radius.md, padding: '10px 12px',
        }}>
          "{match.ownDesc}"
        </p>
      )}

      {/* "They want to connect" indicator */}
      {state === 'they_want' && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px', alignSelf: 'flex-start',
          backgroundColor: theme.tint, borderRadius: radius.sm, padding: '5px 10px', marginBottom: '12px',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill={theme.accent} stroke="none">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '600', color: theme.accent, fontFamily: font }}>They already want to connect</span>
        </div>
      )}

      {/* Context chips */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {chips.map(({ label, key }) => {
            const common = isCommon(key);
            return (
              <span key={key} style={{
                fontSize: '11px', fontFamily: font, textTransform: 'capitalize',
                borderRadius: radius.sm, padding: '4px 10px',
                backgroundColor: common ? theme.tintStrong : 'rgba(29,29,47,0.05)',
                color: common ? theme.accent : t.textMuted,
                fontWeight: common ? '600' : '400',
                border: 'none',
              }}>
                {common && '✦ '}{label}
              </span>
            );
          })}
        </div>
      )}

      {/* Description */}
      <p style={{ flex: 1, fontSize: '15px', lineHeight: '1.65', color: t.text, margin: '0 0 20px', fontFamily: font }}>
        {match.description}
      </p>

      {/* ── State-specific bottom ── */}

      {(state === 'pending' || state === 'they_want') && (
        <DecisionButtons theme={theme} onNo={onNo} onYes={onYes} />
      )}

      {state === 'requested' && (
        <StatusRow theme={theme} label="Request sent — waiting for reply" />
      )}

      {state === 'mutual_add_ig' && (
        <ContactInput theme={theme} value={igInput} onChange={setIgInput} onSubmit={onAddInstagram} />
      )}

      {state === 'mutual_wait_theirs' && (
        <StatusRow theme={theme} label="Waiting for their contact…" />
      )}

      {state === 'mutual_done' && confirmed?.note?.instagram && (
        <ContactRevealed theme={theme} handle={confirmed.note.instagram} />
      )}
    </div>
  );
};

// ─── VibesFeed ─────────────────────────────────────────────────────────────

const VibesFeed = ({ notes, noteAuthors, onSendRequest, onLike, myUserId, onDelete, onCreatePost, onNavigateToConnections }) => {
  const [shareNote, setShareNote] = useState(null);
  const [connectNote, setConnectNote] = useState(null);
  const [connectComment, setConnectComment] = useState('');
  const [connectSent, setConnectSent] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState(null);
  const connectTextareaRef = React.useRef(null);

  const autoResizeConnectTextarea = () => {
    const el = connectTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  };

  const closeConnectModal = () => {
    setConnectNote(null);
    setConnectComment('');
    setConnectSent(false);
  };

  if (notes.length === 0) {
    return (
      <div style={{
        backgroundColor: t.surface, borderRadius: radius.xl, padding: '24px 20px', margin: '0 16px',
        minHeight: '360px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill={t.textMuted}/>
          <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill={t.textMuted}/>
          <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill={t.textMuted}/>
          <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill={t.textMuted}/>
          <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill={t.textMuted}/>
        </svg>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font }}>The Crowd is still silent</p>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textMuted, fontFamily: font, lineHeight: '1.5' }}>Be the first to share a festival moment and create connections</p>
        </div>
        {onCreatePost && (
          <button onClick={onCreatePost} style={{
            padding: '12px 24px', borderRadius: radius.md, border: 'none',
            backgroundColor: t.primary, color: '#fff', cursor: 'pointer',
            fontSize: '14px', fontWeight: '700', fontFamily: font,
          }}>Create a post <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginLeft: '2px' }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
        )}
      </div>
    );
  }

  const handleShare = (note) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${note.id}`;
    if (navigator.share) {
      navigator.share({ title: 'Otra — Post', text: `Someone at the festival is looking for a connection 👀\n\n"${note.description}"`, url: shareUrl }).catch(() => {});
    } else {
      setShareNote({ ...note, shareUrl });
    }
  };

  const iconBtn = {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'none', border: 'none', padding: '6px 4px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '500',
    color: t.textMuted, fontFamily: font,
  };

  React.useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  const sortedNotes = [...notes].sort((a, b) =>
    new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
  );

  return (
    <div style={{ backgroundColor: t.bg }}>
      {sortedNotes.map((note, idx) => {
        const chips = [
          note.artist && note.artist !== 'Otro' ? note.artist : null,
        ].filter(Boolean);
        const postedAgo = timeAgo(note.createdAt || note.created_at);

        return (
          <div key={note.id} style={{
            padding: '16px',
            borderTop: idx === 0 ? 'none' : `1px solid ${t.border}`,
          }}>
            {/* Author + chips */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', fontFamily: font,
                    color: note.user_id === myUserId ? t.primary : t.dark }}>
                    {note.user_id === myUserId ? 'You' : (noteAuthors[note.user_id] || 'Someone')}
                  </p>
                  {postedAgo && (
                    <span style={{ fontSize: '12px', color: t.textMuted, fontFamily: font }}>· {postedAgo}</span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === note.id ? null : note.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: t.textMuted, display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </button>
                  {openMenuId === note.id && (
                    <div
                      style={{
                        position: 'absolute', top: '100%', right: 0, zIndex: 50,
                        backgroundColor: t.white, borderRadius: radius.md,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                        minWidth: '120px', overflow: 'hidden',
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      {note.user_id === myUserId ? (
                        <button
                          onClick={() => { setOpenMenuId(null); setDeleteConfirmNoteId(note.id); }}
                          style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '14px', color: t.danger, cursor: 'pointer', fontFamily: font }}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            const subject = encodeURIComponent(`Report: post ${note.id}`);
                            const body = encodeURIComponent(`I'd like to report this post:\n\nPost ID: ${note.id}\nContent: ${note.description}\n\nReason:`);
                            window.location.href = `mailto:safety@otra.social?subject=${subject}&body=${body}`;
                          }}
                          style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '14px', color: t.danger, cursor: 'pointer', fontFamily: font }}
                        >
                          Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {chips.map((chip, i) => (
                    <span key={i} style={{
                      fontSize: '10px', color: t.textMuted, backgroundColor: t.surface,
                      borderRadius: radius.xs, padding: '2px 7px', fontFamily: font,
                      textTransform: 'capitalize',
                    }}>{chip}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: t.text, margin: '0 0 12px', fontFamily: font }}>
              {note.description}
            </p>

            {/* Action row — icon-only, no frames */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Vibe — sound wave icon */}
              <button onClick={() => onLike(note.id)} style={{
                ...iconBtn,
                color: note.liked ? t.primary : t.textMuted,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill="currentColor"/>
                  <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill="currentColor"/>
                  <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill="currentColor"/>
                  <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill="currentColor"/>
                  <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill="currentColor"/>
                </svg>
                {note.likes || 0}
              </button>

              {/* Share */}
              <button onClick={() => handleShare(note)} style={iconBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>

              <div style={{ flex: 1 }} />

              {/* Connect — thunder icon */}
              <button
                onClick={() => { if (!note.requested && note.user_id !== myUserId) { setConnectNote(note); setConnectComment(''); setConnectSent(false); } }}
                disabled={note.requested || note.user_id === myUserId}
                style={{
                  ...iconBtn,
                  color: note.requested ? t.primary : t.textMuted,
                  opacity: note.user_id === myUserId ? 0 : 1,
                  pointerEvents: note.user_id === myUserId ? 'none' : 'auto',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={note.requested ? t.primary : 'none'} stroke={note.requested ? t.primary : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </button>
            </div>
          </div>
        );
      })}

      {/* Connect modal */}
      {connectNote && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }} onClick={closeConnectModal}>
          <div style={{
            backgroundColor: t.border, borderRadius: radius.xxl,
            padding: '24px', width: '100%', maxWidth: '360px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: connectSent ? 'center' : 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: t.dark, fontFamily: font, textAlign: connectSent ? 'center' : 'left' }}>
                {connectSent ? 'Connection requested' : 'Send connection request'}
              </span>
              <button onClick={closeConnectModal} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: t.textMuted, display: 'flex', alignItems: 'center',
                ...(connectSent ? { position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' } : {}),
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {!connectSent ? (
              <>
                {/* Post preview */}
                <div style={{
                  backgroundColor: t.surface, borderRadius: radius.lg, padding: '14px', marginBottom: '16px',
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.dark, fontFamily: font }}>
                        {noteAuthors[connectNote.user_id] || 'Someone'}
                      </p>
                      {timeAgo(connectNote.createdAt || connectNote.created_at) && (
                        <span style={{ fontSize: '12px', color: t.textMuted, fontFamily: font }}>· {timeAgo(connectNote.createdAt || connectNote.created_at)}</span>
                      )}
                    </div>
                    {connectNote.artist && connectNote.artist !== 'Otro' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        <span style={{
                          fontSize: '10px', color: t.textMuted, backgroundColor: t.white,
                          borderRadius: radius.xs, padding: '2px 7px', fontFamily: font, textTransform: 'capitalize',
                        }}>{connectNote.artist}</span>
                      </div>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: t.textSec, fontFamily: font }}>
                    {connectNote.description}
                  </p>
                </div>

                {/* Comment field + send button */}
                <div style={{ position: 'relative' }}>
                  <textarea
                    ref={connectTextareaRef}
                    value={connectComment}
                    onChange={e => { setConnectComment(e.target.value); autoResizeConnectTextarea(); }}
                    placeholder="Write a message…"
                    autoFocus
                    style={{
                      width: '100%', minHeight: '110px', maxHeight: '240px', padding: '14px 14px 60px',
                      borderRadius: radius.md, border: 'none',
                      fontSize: '14px', fontFamily: font, color: t.dark,
                      backgroundColor: t.white, resize: 'none', outline: 'none', overflowY: 'auto',
                      lineHeight: '1.5', boxSizing: 'border-box',
                      transition: 'border-color 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                    }}
                    onFocus={e => e.target.style.borderColor = t.primary}
                    onBlur={e => e.target.style.borderColor = t.border}
                  />
                  <button
                    disabled={!connectComment.trim()}
                    onClick={() => {
                      onSendRequest(connectNote, connectComment.trim());
                      setConnectSent(true);
                    }}
                    style={{
                      position: 'absolute', bottom: '12px', right: '12px',
                      width: '48px', height: '48px', borderRadius: radius.circle, border: 'none',
                      backgroundColor: connectComment.trim() ? t.primary : t.borderDark,
                      cursor: connectComment.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                      boxShadow: connectComment.trim() ? '0 4px 16px rgba(181,11,242,0.35)' : 'none',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              /* Confirmation */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '4px 8px 8px' }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: radius.xxl,
                  backgroundColor: t.primaryBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textSec, fontFamily: font, lineHeight: '1.6', maxWidth: '260px' }}>
                  If the request gets accepted, you'll both be able to swap contacts.
                </p>
                <button
                  onClick={() => { closeConnectModal(); onNavigateToConnections && onNavigateToConnections(); }}
                  style={{
                    padding: '13px 28px', borderRadius: radius.md, border: 'none',
                    backgroundColor: t.dark, color: '#fff', cursor: 'pointer',
                    fontSize: '14px', fontWeight: '700', fontFamily: font,
                  }}
                >View Connections</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share sheet fallback */}
      {shareNote && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 100,
        }} onClick={() => setShareNote(null)}>
          <div style={{
            backgroundColor: t.white, borderRadius: `${radius.xl} ${radius.xl} 0 0`,
            padding: '24px 20px 36px', width: '100%', maxWidth: '480px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '36px', height: '4px', backgroundColor: t.border, borderRadius: radius.xs, margin: '0 auto 20px' }} />
            <p style={{ fontSize: '15px', fontWeight: '700', color: t.dark, margin: '0 0 6px', fontFamily: font }}>Share this post</p>
            <p style={{ fontSize: '13px', color: t.textSec, margin: '0 0 20px', lineHeight: '1.5', fontFamily: font }}>
              {shareNote.description?.substring(0, 80)}{shareNote.description?.length > 80 ? '…' : ''}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                {
                  label: 'Copy link',
                  action: () => { navigator.clipboard?.writeText(shareNote.shareUrl); setShareNote(null); },
                  svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
                },
                {
                  label: 'WhatsApp',
                  action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(`Someone at the festival is looking for a connection 👀\n\n"${shareNote.description}"\n\n${shareNote.shareUrl}`)}`); setShareNote(null); },
                  svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
                },
                {
                  label: 'Instagram',
                  action: () => { navigator.clipboard?.writeText(shareNote.shareUrl); setShareNote(null); },
                  svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
                },
              ].map(({ label, svg, action }) => (
                <button key={label} onClick={action} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  backgroundColor: t.surface, border: 'none', borderRadius: radius.md, padding: '14px 8px',
                  cursor: 'pointer', fontSize: '11px', color: t.textSec, fontFamily: font, fontWeight: '500',
                }}>
                  {svg}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {deleteConfirmNoteId && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }} onClick={() => setDeleteConfirmNoteId(null)}>
          <div style={{
            backgroundColor: t.border, borderRadius: radius.xxl,
            padding: '24px', width: '100%', maxWidth: '360px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: t.dark, fontFamily: font }}>Delete post?</span>
              <button onClick={() => setDeleteConfirmNoteId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: t.textMuted, display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontFamily: font, fontSize: '14px', color: t.textSec, margin: '0 0 24px', lineHeight: '1.5' }}>This action can't be undone.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => { onDelete(deleteConfirmNoteId); setDeleteConfirmNoteId(null); }}
                style={{ width: '100%', padding: '13px', background: t.primary, border: 'none', borderRadius: radius.md, fontSize: '15px', fontWeight: '700', color: '#fff', cursor: 'pointer', fontFamily: font }}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirmNoteId(null)}
                style={{ width: '100%', padding: '13px', background: t.white, border: 'none', borderRadius: radius.md, fontSize: '15px', fontWeight: '500', color: t.dark, cursor: 'pointer', fontFamily: font }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── RequestCard ───────────────────────────────────────────────────────────
const RequestCard = ({ direction = 'received', req, isAccepted, myVibeNote, theirVibeNote, onDecline, onAccept, onAddInstagram, flatTop }) => {
  const [igInput, setIgInput] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const isSent = direction === 'sent';

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);
  const iHaveIg = !!myVibeNote?.instagram;
  const theyHaveIg = !!theirVibeNote?.instagram;
  const theme = CATEGORY_THEME.crowd;

  // Prominent direction arrow — the differentiator between sent (→) and received (←)
  const DirectionArrow = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {isSent ? (
        <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>
      ) : (
        <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>
      )}
    </svg>
  );

  return (
    <div style={{
      backgroundColor: theme.cardBg,
      borderRadius: flatTop ? `0 0 ${radius.xl} ${radius.xl}` : radius.xl,
      padding: '20px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — [direction arrow] author on the left; Mutual + menu on the right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DirectionArrow />
          <span style={{ fontSize: '15px', fontWeight: '700', color: t.dark, fontFamily: font }}>
            {isSent ? 'You' : (req.authorName || 'Someone')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAccepted && <Badge label="Mutual match" color={theme.accent} bg={theme.tint} border={theme.border} />}
          {!isSent && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: t.textMuted, display: 'flex', alignItems: 'center' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
              </button>
              {menuOpen && (
                <div
                  style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, backgroundColor: t.white, borderRadius: radius.md, border: `1px solid ${t.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: '120px', overflow: 'hidden' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      const subject = encodeURIComponent(`Report: connection request ${req.matchId}`);
                      const body = encodeURIComponent(`I'd like to report this connection request:\n\nFrom: ${req.authorName || 'Unknown'}\nMessage: ${req.message || '(no message)'}\n\nReason:`);
                      window.location.href = `mailto:safety@otra.social?subject=${subject}&body=${body}`;
                    }}
                    style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '14px', color: t.textSec, cursor: 'pointer', fontFamily: font }}
                  >
                    Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Message — their outreach (received) or yours (sent) */}
      {req.message && (
        <p style={{ fontSize: '14px', lineHeight: '1.6', color: t.text, margin: '0 0 16px', fontFamily: font }}>
          {req.message}
        </p>
      )}

      {/* Bottom action */}
      {isSent ? (
        // Outgoing card states
        !isAccepted ? (
          <StatusRow theme={theme} label="Waiting for their reply" />
        ) : theyHaveIg ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ContactRevealed theme={theme} handle={theirVibeNote.instagram} />
            {!iHaveIg && onAddInstagram && (
              <ContactInput theme={theme} value={igInput} onChange={setIgInput} onSubmit={onAddInstagram} />
            )}
          </div>
        ) : (
          <StatusRow theme={theme} label="Connected — waiting for their Instagram" />
        )
      ) : (
        // Incoming card states
        !isAccepted ? (
          <DecisionButtons theme={theme} onNo={onDecline} onYes={onAccept} />
        ) : iHaveIg ? (
          <StatusRow theme={theme} label="Contact shared — waiting for theirs" />
        ) : (
          <ContactInput theme={theme} value={igInput} onChange={setIgInput} onSubmit={onAddInstagram} />
        )
      )}
    </div>
  );
};

// ─── EmptyState ────────────────────────────────────────────────────────────

const EmptyState = ({ text, sub }) => (
  <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9E9A93' }}>
    <p style={{ fontSize: '14px', margin: '0 0 4px', fontFamily: font }}>{text}</p>
    {sub && <p style={{ fontSize: '12px', margin: 0, fontFamily: font }}>{sub}</p>}
  </div>
);

export { ErrorBoundary };
export default PrimaveraApp;
