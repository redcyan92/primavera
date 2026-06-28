import React, { useState, useEffect, useCallback, useRef } from 'react';
import CreateNoteFlow from './CreateNoteFlow';
import Onboarding from './Onboarding';
import SearchWithAI from './SearchWithAI';
import { findMatches, calculateMatchScore } from './matchingAlgorithm';
import { LOCATION_OPTIONS, TIME_OPTIONS } from './defaultOptions';
import { FESTIVALS, FESTIVAL_LIST, DEFAULT_FESTIVAL_ID } from './festivals';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'YOUR_SUPABASE_KEY';

const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,

  async request(table, method = 'GET', data = null, filter = null) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
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
    return res.ok ? data : null;
  },
  async createNote(userId, note)  { return this.request('notes', 'POST', { user_id: userId, ...note }); },
  async getNotes(userId)          { return this.request('notes', 'GET', null, `user_id=eq.${userId}`); },
  async getAllNotes(festivalId)    { return this.request('notes', 'GET', null, festivalId ? `festival_id=eq.${festivalId}` : null); },
  async createMatch(match)        { return this.request('matches', 'POST', match); },
  async getMatches(userId)        { return this.request('matches', 'GET', null, `or=(user_1_id.eq.${userId},user_2_id.eq.${userId})`); },
  async updateMatch(matchId, data){ return this.request('matches', 'PATCH', data, `id=eq.${matchId}`); },
  async updateNote(noteId, data)  { return this.request('notes', 'PATCH', data, `id=eq.${noteId}`); },
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

// ─── Shared style tokens ───────────────────────────────────────────────────
const t = {
  primary:       '#FF5B1B',
  primaryLight:  '#FAA284',
  primaryBg:     '#FFF0EB',
  primaryBorder: '#FABB96',
  bg:            '#FEFBF6',
  white:         '#FFFFFF',
  surface:       '#F7F5F2',
  dark:          '#1D1D2F',
  darkBlue:      '#24223B',
  third:         '#DDA488',
  thirdLight:    '#F5E8DF',
  border:        '#EDE8DF',
  borderDark:    '#DDD9D1',
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

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const OtraLogo = ({ color = '#FFFFFF', style }) => (
  <svg viewBox="0 0 82 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M78.5149 24V20.4051L71.9757 16.5706L67.5934 24H64.3066L78.4122 0.0343018H81.3565V24H78.5149ZM73.3794 14.1398L78.5149 17.1184V5.40946L73.3794 14.1398Z" fill={color}/>
    <path d="M46.499 24V0.0343018H56.7016C60.3991 0.0343018 63.4119 3.04713 63.4119 6.74469C63.4119 10.4423 60.3991 13.4208 56.7016 13.4208H50.1624L63.4462 21.6034L61.974 24L49.3064 16.2283V24H46.499ZM49.3064 10.6134H56.7016C58.8585 10.6134 60.6045 8.86737 60.6045 6.74469C60.6045 4.58778 58.8585 2.84171 56.7016 2.84171H49.3064V10.6134Z" fill={color}/>
    <path d="M32.9014 23.9999V2.80741H28.6903V9.86017H25.8486V0H42.7616V9.86017H39.9541V2.80741H35.7088V23.9999H32.9014Z" fill={color}/>
    <path d="M11.9828 24C8.80519 24 5.7562 22.7377 3.50926 20.4907C1.26232 18.2438 0 15.1948 0 12.0171C0 8.83949 1.26232 5.7905 3.50926 3.54356C5.7562 1.29662 8.80519 0.0343018 11.9828 0.0343018C15.1605 0.0343018 18.2095 1.29662 20.4564 3.54356C22.7034 5.7905 23.9657 8.83949 23.9657 12.0171C23.9657 15.1948 22.7034 18.2438 20.4564 20.4907C18.2095 22.7377 15.1605 24 11.9828 24ZM2.84165 12.0171C2.84165 14.4329 3.79732 16.7792 5.50004 18.4929C7.21704 20.2209 9.55391 21.1926 11.9899 21.1926C14.4177 21.1926 16.751 20.2247 18.4677 18.508C20.1882 16.7874 21.1583 14.4504 21.1583 12.0171C21.1583 9.58387 20.1882 7.24684 18.4677 5.52626C16.751 3.80955 14.4177 2.84171 11.9899 2.84171C9.55391 2.84171 7.21704 3.81343 5.50004 5.54144C3.79732 7.25508 2.84165 9.6014 2.84165 12.0171Z" fill={color}/>
  </svg>
);

// ─── Small reusable UI pieces ──────────────────────────────────────────────

const Badge = ({ label, color, bg, border }) => (
  <span style={{
    display: 'inline-block', fontSize: '10px', fontWeight: '600',
    color, backgroundColor: bg,
    border: `0.5px solid ${border}`,
    padding: '3px 8px', borderRadius: '999px',
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
  const activeFestival = activeFestivalId ? FESTIVALS[activeFestivalId] : null;

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
  const [isModalOpen, setIsModalOpen]       = useState(false);
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
  const [confirmedMatches, setConfirmedMatches] = useState([]);
  const [boardSubTab, setBoardSubTab]           = useState('everyone');
  const [matchSubTab, setMatchSubTab]           = useState('ai');
  const [carouselIndexes, setCarouselIndexes]   = useState({});
  const [noteAuthors, setNoteAuthors]           = useState({});
  const [acceptedRequestIds, setAcceptedRequestIds] = useState(new Set());

  // ── Load / refresh all data from DB ──────────────────────────────────────
  const lastRefresh = useRef(0);
  const touchStartX = useRef(null);

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
          if (res?.[0]?.email) authorsMap[id] = res[0].email.split('@')[0];
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
            return { matchId: r.id, myVibeNote, createdAt: r.created_at, authorName: userRes?.[0]?.email?.split('@')[0] || '', message: r.message || null };
          }))).filter(Boolean);
          setReceivedRequests(received);

          // Confirmed matches — only keep if the note still exists
          const confirmedRaw = existingMatches.filter(r => r.revealed);
          const confirmed = (await Promise.all(confirmedRaw.map(async r => {
            const isUser1 = r.user_1_id === uid;
            const theirNoteId = isUser1 ? r.note_2_id : r.note_1_id;
            const theirUserId = isUser1 ? r.user_2_id : r.user_1_id;
            const theirNote = camelAll.find(n => n.id === theirNoteId);
            if (!theirNote) return null;
            const userRes = await supabase.getUserById(theirUserId);
            return { matchId: r.id, note: theirNote, score: r.score, quality: r.quality, authorName: userRes?.[0]?.email?.split('@')[0] || '' };
          }))).filter(Boolean);
          setConfirmedMatches(confirmed);
        } else {
          setReceivedRequests([]);
          setConfirmedMatches([]);
        }

      }
    } catch (err) {
      console.error('loadData error:', err);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (userId && activeFestivalId) { lastRefresh.current = 0; loadData(userId, activeFestivalId); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      else if (authStep === 'age')   { /* can't go back — already logged in */ history.pushState({ authStep: 'age' }, ''); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [authStep]);

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
      setAcceptedRequestIds(prev => new Set([...prev, matchId]));
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

  // ── Splash screen ────────────────────────────────────────────────────────

  // ── Splash ────────────────────────────────────────────────────────────────

  if (authStep === 'splash') {
    return (
      <div style={{
        maxWidth: '380px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: '#EDE8DF', fontFamily: font,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '140%', height: '82svh',
          background: 'radial-gradient(ellipse 80% 100% at 50% 8%, #FF5B1B 0%, #FF5B1B 62%, rgba(120,195,238,0.85) 76%, transparent 88%)',
          filter: 'blur(22px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '24px 24px 0' }}>
          <OtraLogo color='#FFF0EB' style={{ width: '100%', height: 'auto' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, height: '42svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
          <h1 style={{
            fontSize: '40px', fontWeight: '500', color: '#FFF0EB',
            marginTop: '58px', marginRight: 'auto', marginBottom: 0, marginLeft: 'auto',
            lineHeight: '1.15', textAlign: 'center',
            fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em',
          }}>
            Find the people you vibed with
          </h1>
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', padding: '0 24px 64px' }}>
          <button
            onClick={() => setAuthStep('onboarding')}
            style={{
              width: '100%', padding: '17px', border: 'none',
              backgroundColor: t.dark, borderRadius: '14px',
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
      <Onboarding onComplete={() => setAuthStep('email')} />
    );
  }

  // ── Email entry ───────────────────────────────────────────────────────────

  if (authStep === 'email') {
    return (
      <div style={{
        maxWidth: '380px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.primary, fontFamily: font,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <OtraLogo style={{ width: '100%', height: 'auto' }} />
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
                height: '52px', padding: '0 16px', borderRadius: '14px',
                border: 'none', fontSize: '15px',
                backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
                outline: 'none', fontFamily: font,
              }}
            />
            {otpError && <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{otpError}</p>}
            <button type="submit" disabled={loading || !pendingEmail} style={{
              height: '52px', cursor: 'pointer', borderRadius: '14px',
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
        maxWidth: '380px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.primary, fontFamily: font,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <OtraLogo style={{ width: '100%', height: 'auto' }} />
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
                height: '52px', padding: '0 16px', borderRadius: '14px',
                border: 'none', fontSize: '22px', letterSpacing: '0.25em', textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
                outline: 'none', fontFamily: font,
              }}
            />
            {otpError && <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{otpError}</p>}
            <button type="submit" disabled={loading || otpCode.length < 6} style={{
              height: '52px', cursor: 'pointer', borderRadius: '14px',
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
    return (
      <div style={{
        maxWidth: '380px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.bg, fontFamily: font,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <OtraLogo color={t.primary} style={{ width: '100%', height: 'auto' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px 48px', gap: '28px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: t.dark, margin: '0 0 8px', letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif", lineHeight: '1.3' }}>
              Quick check
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: t.textSec, lineHeight: '1.5' }}>
              Confirm the following to get started.
            </p>
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
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
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
            disabled={!ageChecked || !termsChecked || loading}
            style={{
              height: '52px', cursor: 'pointer', borderRadius: '14px',
              border: 'none', backgroundColor: t.dark,
              fontSize: '15px', fontWeight: '700', color: '#FFFFFF',
              fontFamily: font,
              opacity: (!ageChecked || !termsChecked || loading) ? 0.4 : 1,
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

  if (!activeFestivalId) {
    return (
      <div style={{ maxWidth: '380px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#EDE8DF', fontFamily: font, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Blurred blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {[
            { color: '#FF5B1B', x: '18%',  y: '12%', w: '65%', h: '48%' },
            { color: '#FF6A40', x: '78%',  y: '8%',  w: '60%', h: '44%' },
            { color: '#C090C8', x: '45%',  y: '40%', w: '50%', h: '38%' },
            { color: '#E8B0A0', x: '30%',  y: '55%', w: '40%', h: '30%' },
          ].map((b, i) => (
            <div key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, backgroundColor: b.color, borderRadius: '50%', filter: 'blur(52px)', transform: 'translate(-50%, -50%)' }} />
          ))}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, #EDE8DF 68%)' }} />
        </div>
        {/* Content anchored to bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 48px', zIndex: 5 }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: t.dark, margin: '0 0 8px', fontFamily: "'HealTheWeb', system-ui, sans-serif", letterSpacing: '0.01em' }}>Pick your festival</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FESTIVAL_LIST.map(f => (
              <button key={f.id} onClick={() => {
                localStorage.setItem('fulmi_festival_id', f.id);
                setActiveFestivalId(f.id);
                setTab('home');
                lastRefresh.current = 0;
                loadData(userId, f.id);
              }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', padding: '18px 20px', borderRadius: '16px',
                border: 'none', backgroundColor: t.dark,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', fontFamily: font }}>{f.fullName}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontFamily: font, marginTop: '4px' }}>{f.dates}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '380px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: t.bg, fontFamily: font }}>

      {/* Top header */}
      <div style={{ backgroundColor: t.white, borderBottom: `1px solid ${t.border}`, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <OtraLogo color={t.primary} style={{ height: '22px', width: 'auto' }} />
          </div>
          {/* Festival pill */}
          <button onClick={() => setFestivalSwitcherOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            backgroundColor: t.surface, border: `1px solid ${t.border}`,
            borderRadius: '8px', padding: '7px 10px 7px 12px',
            cursor: 'pointer', color: t.textMuted,
          }}>
            <span style={{ fontSize: '11px', fontWeight: '500', fontFamily: font, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>{activeFestival?.fullName || 'Select festival'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', backgroundColor: '#FFFFFF' }}>

        {/* ── TAB: HOME ── */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px', height: 'calc(100svh - 174px)', boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 20px', color: t.dark, letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>
              What are you looking for?
            </h1>

            {/* Card 1 — Find Someone */}
            <button onClick={() => navigateTo('notes')} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              flex: 1, width: '100%', padding: '28px 24px', borderRadius: '20px',
              border: `1.5px solid ${t.primaryBorder}`, backgroundColor: t.primaryBg,
              cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
              boxShadow: '0 2px 12px rgba(255,91,27,0.10)',
            }}>
              {/* Icon row + pill */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="23" viewBox="0 0 23 24" fill="none">
                    <path d="M9.29037 2.32259C9.71812 2.32259 10.0646 2.67 10.0646 3.09678C10.0646 3.52453 9.71812 3.87097 9.29037 3.87097C5.01483 3.87097 1.54842 7.33737 1.54842 11.6129C1.54842 15.8894 5.01483 19.3548 9.29037 19.3548C12.9698 19.3548 16.05 16.7875 16.8368 13.3461C16.9327 12.929 17.3488 12.6687 17.7659 12.7645C18.182 12.8593 18.4423 13.2745 18.3475 13.6906C17.9236 15.5448 16.9433 17.187 15.5943 18.4344L19.175 22.7302C19.4479 23.0583 19.4043 23.547 19.0763 23.8208C18.7482 24.0938 18.2604 24.0502 17.9866 23.7221L14.374 19.3867C12.9137 20.3447 11.168 20.9031 9.29034 20.9031C4.15935 20.9031 0 16.7438 0 11.6128C0 6.4828 4.15938 2.32259 9.29037 2.32259Z" fill={t.primary}/>
                    <path d="M17.552 0.211931C17.6032 -0.0706435 18.0097 -0.0706435 18.0591 0.211931C18.4307 2.34677 20.102 4.01997 22.2387 4.39158C22.5223 4.4419 22.5223 4.84837 22.2387 4.89772C20.1029 5.2703 18.4307 6.94255 18.0591 9.07737C18.0107 9.36091 17.6023 9.36091 17.552 9.07737C17.1803 6.94253 15.509 5.27032 13.3743 4.89772C13.0907 4.84836 13.0907 4.44192 13.3743 4.39158C15.5091 4.01997 17.1803 2.34675 17.552 0.211931Z" fill={t.primary}/>
                  </svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'rgba(255,91,27,0.08)', borderRadius: '999px', padding: '5px 10px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: t.primary, fontFamily: font, whiteSpace: 'nowrap' }}>Compatible only</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <p style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font, lineHeight: '1.3' }}>Find your missed connection</p>
                <p style={{ margin: 0, fontSize: '14px', color: t.textSec, fontFamily: font, lineHeight: '1.6' }}>
                  Describe who you're looking for. Our AI finds them quietly — nothing posted publicly.
                </p>
              </div>
            </button>

            {/* Card 2 — Share a Moment */}
            <button onClick={() => navigateTo('public')} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              flex: 1, width: '100%', padding: '28px 24px', borderRadius: '20px',
              border: `1px solid ${t.border}`, backgroundColor: t.surface,
              cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
            }}>
              {/* Icon row + pill */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12.0002 0C12.6628 0 13.2005 0.537736 13.2005 1.20035V22.7997C13.2005 23.4623 12.6628 24 12.0002 24C11.3375 24 10.7998 23.4623 10.7998 22.7997V1.20035C10.7998 0.537736 11.3375 0 12.0002 0Z" fill={t.dark}/>
                    <path d="M7.19986 6.00058C7.19986 5.33797 6.66325 4.80023 6.00064 4.80023C5.33803 4.80023 4.80029 5.33797 4.80029 6.00058V17.9994C4.80029 18.662 5.33803 19.1998 6.00064 19.1998C6.66325 19.1998 7.19986 18.662 7.19986 17.9994V6.00058Z" fill={t.dark}/>
                    <path d="M1.20035 9.60046C1.86295 9.60046 2.40069 10.1371 2.40069 10.7997V13.2003C2.40069 13.863 1.86295 14.3996 1.20035 14.3996C0.537736 14.3996 0 13.863 0 13.2003V10.7997C0 10.1371 0.537736 9.60046 1.20035 9.60046Z" fill={t.dark}/>
                    <path d="M22.7995 9.60046C23.4621 9.60046 23.9998 10.1371 23.9998 10.7997V13.2003C23.9998 13.863 23.4621 14.3996 22.7995 14.3996C22.1369 14.3996 21.5991 13.863 21.5991 13.2003V10.7997C21.5991 10.1371 22.1369 9.60046 22.7995 9.60046Z" fill={t.dark}/>
                    <path d="M19.1999 6.00058C19.1999 5.33797 18.6621 4.80023 17.9995 4.80023C17.3369 4.80023 16.8003 5.33797 16.8003 6.00058V17.9994C16.8003 18.662 17.3369 19.1998 17.9995 19.1998C18.6621 19.1998 19.1999 18.662 19.1999 17.9994V6.00058Z" fill={t.dark}/>
                  </svg>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'rgba(29,29,47,0.07)', borderRadius: '999px', padding: '5px 10px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: t.textSec, fontFamily: font, whiteSpace: 'nowrap' }}>Public</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <p style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font, lineHeight: '1.3' }}>Share a moment with the crowd</p>
                <p style={{ margin: 0, fontSize: '14px', color: t.textSec, fontFamily: font, lineHeight: '1.6' }}>
                  Post to the Crowd wall. Anyone at the festival can see it and reach out to you.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── TAB: AI SEARCH ── */}
        {tab === 'notes' && (
          <SearchWithAI
            onSave={handleSaveNote}
            artists={activeFestival?.artists || []}
            days={activeFestival?.days || []}
            mySearches={searchCards.map(c => c.note)}
            suggestedMatches={searchCards.flatMap(c => c.matches)}
            confirmedMatches={confirmedMatches}
            onNavigateToConnections={() => navigateTo('matches')}
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
                display: 'inline-flex', position: 'relative',
                backgroundColor: t.surface, borderRadius: '12px', border: `1px solid ${t.border}`,
                padding: '4px', gap: '0',
              }}>
                <div style={{
                  position: 'absolute', top: '4px', bottom: '4px',
                  left: matchSubTab === 'ai' ? '4px' : '114px',
                  width: '110px',
                  backgroundColor: t.white,
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'left 0.22s cubic-bezier(0.23, 1, 0.32, 1)',
                  pointerEvents: 'none',
                }} />
                {[{ id: 'ai', label: 'AI Found' }, { id: 'requests', label: 'Requests' }].map(st => (
                  <button key={st.id} onClick={() => setMatchSubTab(st.id)} style={{
                    position: 'relative', zIndex: 1,
                    width: '110px', padding: '6px 0', borderRadius: '8px', cursor: 'pointer',
                    border: 'none', background: 'transparent', textAlign: 'center',
                    color: matchSubTab === st.id ? t.dark : t.textSec,
                    fontSize: '12px', fontWeight: matchSubTab === st.id ? '700' : '400',
                    fontFamily: font, letterSpacing: '0.03em',
                    transition: 'color 0.18s cubic-bezier(0.23, 1, 0.32, 1)', whiteSpace: 'nowrap',
                  }}>
                    {st.label}
                    {st.id === 'requests' && receivedRequests.length > 0 && (
                      <span style={{
                        marginLeft: '5px',
                        backgroundColor: matchSubTab === 'requests' ? 'rgba(255,255,255,0.35)' : t.primary,
                        color: '#fff',
                        fontSize: '9px', fontWeight: '700',
                        borderRadius: '99px', padding: '1px 5px', fontFamily: font,
                        verticalAlign: 'middle',
                      }}>{receivedRequests.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── SUB-TAB: AI FOUND ── */}
            {matchSubTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {searchCards.length === 0 ? (
                  <NoSearchCard onCreateSearch={() => navigateTo('notes')} />
                ) : searchCards.map(({ note: myNote, matches }) => {
                  const carouselItems = matches
                    .filter(m => m.userResponse !== 'no')
                    .map(m => {
                      const confirmed = confirmedMatches.find(cm => cm.note?.id === m.id);
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

                  const idx = carouselIndexes[myNote.id] || 0;
                  const clampedIdx = Math.min(idx, Math.max(0, carouselItems.length - 1));
                  const currentItem = carouselItems[clampedIdx] || null;
                  const setIdx = (val) => setCarouselIndexes(prev => ({ ...prev, [myNote.id]: typeof val === 'function' ? val(prev[myNote.id] || 0) : val }));

                  const metaChips = [
                    myNote.artist && myNote.artist !== 'Otro' ? myNote.artist : null,
                    myNote.location && myNote.location.replace(/_/g, ' '),
                    myNote.time && myNote.time.replace(/_/g, ' '),
                  ].filter(Boolean);

                  return (
                    <div key={myNote.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Search label */}
                      <div>
                        {metaChips.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                            {metaChips.map((chip, i) => (
                              <span key={i} style={{ fontSize: '10px', color: t.textMuted, backgroundColor: t.white, borderRadius: '6px', padding: '3px 8px', border: `1px solid ${t.border}`, textTransform: 'capitalize' }}>{chip}</span>
                            ))}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '13px', color: t.textSec, fontFamily: font, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {myNote.description}
                        </p>
                      </div>

                      {/* Match carousel */}
                      {carouselItems.length === 0 ? (
                        <SearchingCard />
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
                                  height: '6px', borderRadius: '3px', border: 'none',
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

            {/* ── SUB-TAB: REQUESTS ── */}
            {matchSubTab === 'requests' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {receivedRequests.length === 0 ? (
                  <SearchingCard text="No pending requests" sub="When someone reaches out through a post, they'll appear here." />
                ) : (
                  receivedRequests.map(req => {
                    const isAccepted = acceptedRequestIds.has(req.matchId);
                    const myVibeNote = req.myVibeNote;
                    const chips = [
                      myVibeNote?.location && myVibeNote.location.replace(/_/g, ' '),
                      myVibeNote?.time,
                      myVibeNote?.artist && myVibeNote.artist !== 'Otro' ? myVibeNote.artist : null,
                    ].filter(Boolean);

                    return (
                      <RequestCard
                        key={req.matchId}
                        req={req}
                        chips={chips}
                        isAccepted={isAccepted}
                        myVibeNote={myVibeNote}
                        onDecline={() => handleRequestResponse(req.matchId, false)}
                        onAccept={() => handleRequestResponse(req.matchId, true)}
                        onAddInstagram={async (ig) => {
                          if (!myVibeNote) return;
                          await supabase.updateNote(myVibeNote.id, { instagram: ig });
                          setMyNotes(prev => prev.map(n => n.id === myVibeNote.id ? { ...n, instagram: ig } : n));
                        }}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CROWD ── */}
        {tab === 'public' && !vibeCreating && (
          <div style={{ margin: '0 -16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: t.dark, letterSpacing: '0.01em', fontFamily: "'HealTheWeb', system-ui, sans-serif" }}>Crowd</h1>
              <button onClick={() => { setVibeCreating(true); setVibeStep(0); setVibeText(''); setVibeArtist(null); }} style={{
                width: '38px', height: '38px', backgroundColor: t.primary,
                border: 'none', borderRadius: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(247,96,46,0.35)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            <div style={{ padding: '0 16px 14px' }}>
              <div style={{
                display: 'inline-flex', position: 'relative',
                backgroundColor: t.surface, borderRadius: '12px', border: `1px solid ${t.border}`,
                padding: '4px', gap: '0',
              }}>
                {/* sliding pill */}
                <div style={{
                  position: 'absolute', top: '4px', bottom: '4px',
                  left: boardSubTab === 'everyone' ? '4px' : '68px',
                  width: '64px',
                  backgroundColor: t.white,
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'left 0.22s cubic-bezier(0.23, 1, 0.32, 1)',
                  pointerEvents: 'none',
                }} />
                {[{ id: 'everyone', label: 'All' }, { id: 'mine', label: 'Mine' }].map(st => (
                  <button key={st.id} onClick={() => setBoardSubTab(st.id)} style={{
                    position: 'relative', zIndex: 1,
                    width: '64px', padding: '6px 0', borderRadius: '8px', cursor: 'pointer',
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
                  <EmptyState text="No vibes yet." sub="Share a festival moment. ⚡" />
                </div>
              ) : (
                <div style={{ padding: '0 16px 24px' }}>
                  <VibesFeed
                    notes={myPublic}
                    noteAuthors={noteAuthors}
                    onSendRequest={handleSendRequest}
                    onLike={handleLikePublic}
                    myUserId={userId}
                  />
                </div>
              );
            })()}

            {boardSubTab === 'everyone' && (
              <div style={{ padding: '0 16px 24px' }}>
                <VibesFeed
                  notes={publicNotes}
                  noteAuthors={noteAuthors}
                  onSendRequest={handleSendRequest}
                  onLike={handleLikePublic}
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
                        width: '100%', minHeight: '180px', padding: '14px 14px 48px', borderRadius: '14px',
                        border: `1px solid ${t.border}`, fontSize: '14px', fontFamily: font,
                        color: t.dark, backgroundColor: t.white, boxSizing: 'border-box',
                        resize: 'none', outline: 'none', lineHeight: '1.65',
                      }}
                    />
                    {/* Public indicator — bottom left */}
                    <div style={{ position: 'absolute', bottom: '14px', left: '14px', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: 'none' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>Public · visible to everyone</span>
                    </div>
                    {/* Arrow button — bottom right */}
                    <button
                      onClick={() => setVibeStep(1)}
                      disabled={!vibeText.trim()}
                      style={{
                        position: 'absolute', bottom: '12px', right: '12px',
                        width: '36px', height: '36px', borderRadius: '50%', border: 'none',
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
                    flex: 1, minHeight: 0,
                    WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)',
                    overflowY: 'auto',
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start', paddingBottom: '48px' }}>
                      {(activeFestival?.artists || []).filter(a => a !== 'Otro').slice().sort((a, b) => a.localeCompare(b)).map(artist => (
                        <button key={artist} onClick={() => setVibeArtist(vibeArtist === artist ? null : artist)} style={{
                          padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
                          border: vibeArtist === artist ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
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
                      flex: 1, padding: '14px', borderRadius: '12px',
                      border: `1px solid ${t.border}`, backgroundColor: t.white,
                      color: t.dark, fontSize: '14px', fontWeight: '500', fontFamily: font, cursor: 'pointer',
                    }}>← Back</button>
                    <button onClick={submitVibe} style={{
                      flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
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
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    backgroundColor: t.primaryBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', fontWeight: '700', color: t.primary,
                  }}>
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 2px', color: t.dark }}>{user.email}</p>
                    <p style={{ fontSize: '12px', color: t.textMuted, margin: 0 }}>Plan: Free</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { value: myNotes.filter(n => n.visibility === 'targeted' || n.visibility === 'private').length, label: 'Searches' },
                    { value: myNotes.filter(n => n.visibility === 'public').length, label: 'Vibes' },
                    { value: confirmedMatches.length, label: 'Connections' },
                  ].map(({ value, label }) => (
                    <div key={label} style={{ backgroundColor: t.surface, padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                      <p style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 2px', color: t.dark }}>{value}</p>
                      <p style={{ fontSize: '11px', color: t.textMuted, margin: 0 }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={() => { localStorage.removeItem('fulmi_user_email'); localStorage.removeItem('fulmi_user_id'); setUser(null); setUserId(null); setSearchCards([]); setMyNotes([]); setPublicNotes([]); setConfirmedMatches([]); setReceivedRequests([]); setAuthStep('splash'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'none', border: `1px solid ${t.border}`, borderRadius: '10px',
                  padding: '10px 14px', cursor: 'pointer', color: t.textMuted,
                  fontSize: '13px', fontFamily: font, fontWeight: '500', width: '100%',
                }}
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

      <CreateNoteFlow isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveNote} days={activeFestival?.days || []} />

      {/* Festival switcher bottom sheet */}
      {festivalSwitcherOpen && (
        <div onClick={() => setFestivalSwitcherOpen(false)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '380px', margin: '0 auto',
            backgroundColor: t.white, borderRadius: '20px 20px 0 0',
            padding: '20px 20px 36px', display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <div style={{ width: '36px', height: '4px', backgroundColor: t.border, borderRadius: '2px', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '12px', fontWeight: '600', color: t.textMuted, fontFamily: font, margin: '0 0 4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Switch festival</p>
            {FESTIVAL_LIST.map(f => (
              <button key={f.id} onClick={() => {
                localStorage.setItem('fulmi_festival_id', f.id);
                setActiveFestivalId(f.id);
                setFestivalSwitcherOpen(false);
                lastRefresh.current = 0;
                setMyNotes([]); setPublicNotes([]); setSuggestedMatches([]); setConfirmedMatches([]); setReceivedRequests([]);
                loadData(userId, f.id);
              }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '14px 16px', borderRadius: '12px',
                border: f.id === activeFestivalId ? `1.5px solid ${t.primary}` : `1px solid ${t.border}`,
                backgroundColor: f.id === activeFestivalId ? t.primaryBg : t.white,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: f.id === activeFestivalId ? t.primary : t.dark, fontFamily: font, margin: 0 }}>{f.fullName}</p>
                  <p style={{ fontSize: '12px', color: t.textMuted, fontFamily: font, margin: '2px 0 0' }}>{f.dates}</p>
                </div>
                {f.id === activeFestivalId && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Navigation — icon only */}
      <div style={{
        backgroundColor: t.white, borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'flex-end',
        padding: '6px 8px 10px', position: 'sticky', bottom: 0, gap: '4px',
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
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
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
  );
};

// ─── Shared card + button styles ───────────────────────────────────────────

const cardStyle = {
  backgroundColor: '#FFFFFF', border: '1px solid #EDE8DF',
  borderRadius: '14px', padding: '14px',
  boxShadow: '0 1px 3px rgba(29,29,47,0.05)',
};

const btnPrimary = {
  flex: 1, padding: '9px', border: 'none',
  backgroundColor: '#FF5B1B', borderRadius: '10px',
  cursor: 'pointer', fontSize: '13px', color: '#FFFFFF',
  fontWeight: '600', fontFamily: font,
};

const btnOutline = {
  flex: 1, padding: '9px', border: '1px solid #EDE8DF', backgroundColor: '#F7F5F2',
  borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#1D1D2F',
  fontWeight: '500', fontFamily: font,
};

const btnGhost = {
  flex: 1, padding: '9px', border: '1px solid #EDE8DF', backgroundColor: '#FFFFFF',
  borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#9E9A93',
  fontFamily: font,
};

// ─── Hourglass SVG (shared) ────────────────────────────────────────────────
const HourglassIcon = ({ size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14"/><path d="M5 2h14"/>
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
  </svg>
);

// ─── NoSearchCard ──────────────────────────────────────────────────────────
const NoSearchCard = ({ onCreateSearch }) => (
  <div style={{
    backgroundColor: t.surface, border: `1px solid ${t.border}`,
    borderRadius: '20px', padding: '24px 20px',
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
      padding: '12px 24px', borderRadius: '12px', border: 'none',
      backgroundColor: t.primary, color: '#fff', cursor: 'pointer',
      fontSize: '14px', fontWeight: '700', fontFamily: font,
    }}>Create search →</button>
  </div>
);

// ─── SearchingCard ─────────────────────────────────────────────────────────
const SearchingCard = ({ text, sub } = {}) => (
  <div style={{
    backgroundColor: text ? t.surface : t.primaryBg,
    border: `1px solid ${text ? t.border : t.primaryBorder}`,
    borderRadius: '20px', padding: '24px 20px',
    minHeight: '360px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center',
  }}>
    {!text && (
      <div style={{
        width: '44px', height: '44px',
        border: `3px solid ${t.primaryBorder}`, borderTop: `3px solid ${t.primary}`,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
    )}
    <div>
      <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: t.dark, fontFamily: font }}>
        {text || 'Looking for matches…'}
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, fontFamily: font }}>
        {sub || 'Checking with people at the same spot'}
      </p>
    </div>
  </div>
);

// ─── UnifiedMatchCard ──────────────────────────────────────────────────────
const UnifiedMatchCard = ({ item, authorName, myNote, onNo, onYes, onAddInstagram }) => {
  const [igInput, setIgInput] = React.useState('');
  const { match, state, confirmed } = item;
  const isGreen = state.startsWith('mutual');

  const accent = isGreen ? t.successDark : t.primary;
  const accentBg = isGreen ? t.successBg : '#FFF5F0';
  const accentBorder = isGreen ? t.successBorder : t.primaryBorder;
  const accentShadow = isGreen ? 'rgba(5,194,112,0.08)' : 'rgba(247,96,46,0.08)';

  const chips = [
    match.artist && match.artist !== 'Otro' ? { label: match.artist, key: 'artist' } : null,
    match.time ? { label: match.time, key: 'time' } : null,
  ].filter(Boolean);

  const isCommon = (key) => {
    if (!myNote) return false;
    if (key === 'artist') return myNote.artist && myNote.artist === match.artist;
    if (key === 'time') return myNote.time && myNote.time === match.time;
    return false;
  };

  return (
    <div style={{
      backgroundColor: accentBg, border: `1px solid ${accentBorder}`,
      borderRadius: '20px', padding: '24px 20px 20px',
      minHeight: '360px', display: 'flex', flexDirection: 'column',
      boxShadow: `0 4px 20px ${accentShadow}`,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font, display: 'block' }}>
            {authorName || 'Someone'}
          </span>
          <span style={{ fontSize: '12px', color: t.textMuted, fontFamily: font }}>Matched by AI</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          backgroundColor: isGreen ? 'rgba(5,194,112,0.12)' : 'rgba(247,96,46,0.10)',
          borderRadius: '99px', padding: '4px 10px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span style={{ fontSize: '13px', fontWeight: '700', color: accent, fontFamily: font }}>{match.score}%</span>
        </div>
      </div>

      {/* "They want to connect" indicator */}
      {state === 'they_want' && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px', alignSelf: 'flex-start',
          backgroundColor: 'rgba(247,96,46,0.10)', borderRadius: '8px', padding: '5px 10px', marginBottom: '12px',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill={t.primary} stroke="none">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '600', color: t.primary, fontFamily: font }}>They already want to connect</span>
        </div>
      )}

      {/* Mutual badge */}
      {isGreen && (
        <div style={{ marginBottom: '12px' }}>
          <Badge label="Mutual match" color={t.successDark} bg={t.successBg} border={t.successBorder} />
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
                borderRadius: '6px', padding: '4px 10px',
                backgroundColor: common ? 'rgba(247,96,46,0.13)' : 'rgba(29,29,47,0.05)',
                color: common ? t.primary : t.textMuted,
                fontWeight: common ? '600' : '400',
                border: common ? `1px solid ${t.primaryBorder}` : '1px solid transparent',
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
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button onClick={onNo} style={{
            width: '60px', height: '60px', borderRadius: '50%',
            border: `1.5px solid ${t.borderDark}`, backgroundColor: t.white,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(29,29,47,0.08)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <button onClick={onYes} style={{
            width: '60px', height: '60px', borderRadius: '50%', border: 'none',
            backgroundColor: t.primary, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(247,96,46,0.35)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </button>
        </div>
      )}

      {state === 'requested' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          backgroundColor: 'rgba(247,96,46,0.08)', borderRadius: '12px', padding: '13px',
        }}>
          <HourglassIcon size={16} color={t.primary} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: t.primary, fontFamily: font }}>Request sent — waiting for reply</span>
        </div>
      )}

      {state === 'mutual_add_ig' && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: t.successDark, fontWeight: '600', fontFamily: font }}>
            You connected! Add your contact to share it ↓
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text" placeholder="@your_instagram"
              value={igInput} onChange={e => setIgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && igInput.trim() && onAddInstagram(igInput.trim())}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: '12px',
                border: `1.5px solid ${t.successBorder}`, fontSize: '14px', fontFamily: font,
                backgroundColor: t.white, color: t.dark, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => igInput.trim() && onAddInstagram(igInput.trim())}
              disabled={!igInput.trim()}
              style={{
                width: '46px', height: '46px', borderRadius: '50%', border: 'none', flexShrink: 0,
                backgroundColor: igInput.trim() ? t.successDark : t.borderDark,
                cursor: igInput.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {state === 'mutual_wait_theirs' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          backgroundColor: 'rgba(5,194,112,0.10)', borderRadius: '12px', padding: '13px',
        }}>
          <HourglassIcon size={16} color={t.successDark} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: t.successDark, fontFamily: font }}>Waiting for their contact…</span>
        </div>
      )}

      {state === 'mutual_done' && confirmed?.note?.instagram && (
        <div style={{
          backgroundColor: t.white, border: `1px solid ${t.successBorder}`,
          borderRadius: '12px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.successDark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          <div>
            <p style={{ margin: '0 0 1px', fontSize: '10px', color: t.successDark, fontWeight: '700', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Instagram / WhatsApp</p>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font }}>@{confirmed.note.instagram}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── VibesFeed ─────────────────────────────────────────────────────────────

const VibesFeed = ({ notes, noteAuthors, onSendRequest, onLike, myUserId }) => {
  const [shareNote, setShareNote] = useState(null);
  const [connectNote, setConnectNote] = useState(null);
  const [connectComment, setConnectComment] = useState('');

  if (notes.length === 0) {
    return <EmptyState text="No vibes yet." sub="Be the first to share your moment! ⚡" />;
  }

  const handleShare = (note) => {
    if (navigator.share) {
      navigator.share({ title: 'otra — Vibe', text: note.description, url: window.location.href }).catch(() => {});
    } else {
      setShareNote(note);
    }
  };

  const iconBtn = {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'none', border: 'none', padding: '6px 4px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '500',
    color: t.textMuted, fontFamily: font,
  };

  return (
    <div style={{ backgroundColor: t.white }}>
      {notes.map((note, idx) => {
        const chips = [
          note.location && note.location.replace(/_/g, ' '),
          note.time,
          note.artist && note.artist !== 'Otro' ? note.artist : null,
        ].filter(Boolean);

        return (
          <div key={note.id} style={{
            padding: '16px',
            borderTop: idx === 0 ? 'none' : `1px solid ${t.border}`,
          }}>
            {/* Author + chips */}
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', fontFamily: font,
                color: note.user_id === myUserId ? t.primary : t.dark }}>
                {note.user_id === myUserId ? 'You' : (noteAuthors[note.user_id] || 'Someone')}
              </p>
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {chips.map((chip, i) => (
                    <span key={i} style={{
                      fontSize: '10px', color: t.textMuted, backgroundColor: t.surface,
                      borderRadius: '5px', padding: '2px 7px', fontFamily: font,
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>

              <div style={{ flex: 1 }} />

              {/* Connect — thunder icon */}
              <button
                onClick={() => { if (!note.requested && note.user_id !== myUserId) { setConnectNote(note); setConnectComment(''); } }}
                disabled={note.requested || note.user_id === myUserId}
                style={{
                  ...iconBtn,
                  color: note.requested ? t.primary : t.textMuted,
                  opacity: note.user_id === myUserId ? 0 : 1,
                  pointerEvents: note.user_id === myUserId ? 'none' : 'auto',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={note.requested ? t.primary : 'none'} stroke={note.requested ? t.primary : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        }} onClick={() => setConnectNote(null)}>
          <div style={{
            backgroundColor: t.white, borderRadius: '24px',
            padding: '24px', width: '100%', maxWidth: '360px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', color: t.dark, fontFamily: font }}>Connect</span>
              <button onClick={() => setConnectNote(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: t.textMuted, display: 'flex', alignItems: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Post preview */}
            <div style={{
              backgroundColor: t.surface, borderRadius: '14px', padding: '14px', marginBottom: '16px',
              border: `1px solid ${t.border}`,
            }}>
              <div style={{ marginBottom: '8px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '700', color: t.dark, fontFamily: font }}>
                  {noteAuthors[connectNote.user_id] || 'Someone'}
                </p>
                {[
                  connectNote.location && connectNote.location.replace(/_/g, ' '),
                  connectNote.time,
                  connectNote.artist && connectNote.artist !== 'Otro' ? connectNote.artist : null,
                ].filter(Boolean).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {[
                      connectNote.location && connectNote.location.replace(/_/g, ' '),
                      connectNote.time,
                      connectNote.artist && connectNote.artist !== 'Otro' ? connectNote.artist : null,
                    ].filter(Boolean).map((chip, i) => (
                      <span key={i} style={{
                        fontSize: '10px', color: t.textMuted, backgroundColor: t.white,
                        borderRadius: '5px', padding: '2px 7px', fontFamily: font, textTransform: 'capitalize',
                      }}>{chip}</span>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: t.textSec, fontFamily: font }}>
                {connectNote.description}
              </p>
            </div>

            {/* Comment field */}
            <textarea
              value={connectComment}
              onChange={e => setConnectComment(e.target.value)}
              placeholder="Write a message…"
              autoFocus
              style={{
                width: '100%', minHeight: '80px', padding: '12px 14px',
                borderRadius: '12px', border: `1px solid ${t.border}`,
                fontSize: '14px', fontFamily: font, color: t.dark,
                backgroundColor: t.white, resize: 'none', outline: 'none',
                lineHeight: '1.5', boxSizing: 'border-box',
                transition: 'border-color 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
              }}
              onFocus={e => e.target.style.borderColor = t.primary}
              onBlur={e => e.target.style.borderColor = t.border}
            />

            {/* Send button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                disabled={!connectComment.trim()}
                onClick={() => {
                  onSendRequest(connectNote, connectComment.trim());
                  setConnectNote(null);
                  setConnectComment('');
                }}
                style={{
                  width: '48px', height: '48px', borderRadius: '50%', border: 'none',
                  backgroundColor: connectComment.trim() ? t.primary : t.borderDark,
                  cursor: connectComment.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                  boxShadow: connectComment.trim() ? '0 4px 16px rgba(247,96,46,0.35)' : 'none',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </button>
            </div>
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
            backgroundColor: t.white, borderRadius: '20px 20px 0 0',
            padding: '24px 20px 36px', width: '100%', maxWidth: '380px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '36px', height: '4px', backgroundColor: t.border, borderRadius: '2px', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '15px', fontWeight: '700', color: t.dark, margin: '0 0 6px', fontFamily: font }}>Share this vibe</p>
            <p style={{ fontSize: '13px', color: t.textSec, margin: '0 0 20px', lineHeight: '1.5', fontFamily: font }}>
              {shareNote.description?.substring(0, 80)}{shareNote.description?.length > 80 ? '…' : ''}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                {
                  label: 'Copy link',
                  action: () => { navigator.clipboard?.writeText(window.location.href); setShareNote(null); },
                  svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
                },
                {
                  label: 'WhatsApp',
                  action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareNote.description)}`); setShareNote(null); },
                  svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
                },
                {
                  label: 'Instagram',
                  action: () => setShareNote(null),
                  svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
                },
              ].map(({ label, svg, action }) => (
                <button key={label} onClick={action} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  backgroundColor: t.surface, border: 'none', borderRadius: '12px', padding: '14px 8px',
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
    </div>
  );
};

// ─── RequestCard ───────────────────────────────────────────────────────────
const RequestCard = ({ req, chips, isAccepted, myVibeNote, onDecline, onAccept, onAddInstagram }) => {
  const [igInput, setIgInput] = React.useState('');
  const iHaveIg = !!myVibeNote?.instagram;

  return (
    <div style={{
      backgroundColor: isAccepted ? t.successBg : t.white,
      borderRadius: '20px',
      border: `1px solid ${isAccepted ? t.successBorder : t.border}`,
      padding: '20px',
      minHeight: '220px',
      display: 'flex', flexDirection: 'column',
      boxShadow: isAccepted ? '0 4px 20px rgba(5,194,112,0.08)' : '0 1px 3px rgba(29,29,47,0.05)',
      transition: 'background-color 0.25s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.25s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isAccepted ? t.successDark : t.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span style={{ fontSize: '15px', fontWeight: '700', color: t.dark, fontFamily: font }}>
            {req.authorName || 'Someone'}
          </span>
        </div>
        {isAccepted
          ? <Badge label="Mutual match" color={t.successDark} bg={t.successBg} border={t.successBorder} />
          : <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>wants to connect</span>
        }
      </div>

      {/* Context chips from User A's own Vibe */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
          {chips.map((chip, i) => (
            <span key={i} style={{
              fontSize: '10px', color: t.textMuted, backgroundColor: isAccepted ? 'rgba(5,194,112,0.10)' : t.surface,
              borderRadius: '6px', padding: '3px 8px', fontFamily: font, textTransform: 'capitalize',
            }}>{chip}</span>
          ))}
        </div>
      )}

      {/* User A's original Vibe — quoted context */}
      {myVibeNote?.description && (
        <div style={{
          backgroundColor: isAccepted ? 'rgba(5,194,112,0.08)' : t.surface,
          borderRadius: '10px', padding: '10px 12px',
          marginBottom: '14px',
          borderLeft: `3px solid ${isAccepted ? t.successBorder : t.primaryBorder}`,
        }}>
          <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: isAccepted ? t.successDark : t.textMuted, fontFamily: font }}>
            Your post
          </p>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: t.textSec, fontFamily: font, fontStyle: 'italic' }}>
            "{myVibeNote.description.substring(0, 100)}{myVibeNote.description.length > 100 ? '…' : ''}"
          </p>
        </div>
      )}

      {/* User B's reply message — shown below the quoted post */}
      {req.message && (
        <p style={{ fontSize: '14px', lineHeight: '1.6', color: t.text, margin: '0 0 12px', fontFamily: font, flex: 1 }}>
          {req.message}
        </p>
      )}

      {/* Bottom action */}
      {!isAccepted ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onDecline} style={{ ...btnGhost, flex: 1, fontSize: '12px' }}>Decline</button>
          <button onClick={onAccept} style={{ ...btnPrimary, flex: 1, fontSize: '12px' }}>Accept</button>
        </div>
      ) : iHaveIg ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          backgroundColor: 'rgba(5,194,112,0.10)', borderRadius: '12px', padding: '13px',
        }}>
          <HourglassIcon size={16} color={t.successDark} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: t.successDark, fontFamily: font }}>Contact shared — waiting for theirs</span>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: t.successDark, fontWeight: '600', fontFamily: font }}>
            You connected! Add your Instagram to share it ↓
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text" placeholder="@your_instagram"
              value={igInput} onChange={e => setIgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && igInput.trim() && onAddInstagram(igInput.trim())}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: '12px',
                border: `1.5px solid ${t.successBorder}`, fontSize: '14px', fontFamily: font,
                backgroundColor: t.white, color: t.dark, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => igInput.trim() && onAddInstagram(igInput.trim())}
              disabled={!igInput.trim()}
              style={{
                width: '46px', height: '46px', borderRadius: '50%', border: 'none', flexShrink: 0,
                backgroundColor: igInput.trim() ? t.successDark : t.borderDark,
                cursor: igInput.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
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

export default PrimaveraApp;
