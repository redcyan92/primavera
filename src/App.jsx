import React, { useState, useEffect, useCallback, useRef } from 'react';
import CreateNoteFlow from './CreateNoteFlow';
import Onboarding from './Onboarding';
import SearchWithAI from './SearchWithAI';
import { findMatches, calculateMatchScore } from './matchingAlgorithm';

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
  async createNote(userId, note)  { return this.request('notes', 'POST', { user_id: userId, ...note }); },
  async getNotes(userId)          { return this.request('notes', 'GET', null, `user_id=eq.${userId}`); },
  async getAllNotes()              { return this.request('notes', 'GET'); },
  async createMatch(match)        { return this.request('matches', 'POST', match); },
  async getMatches(userId)        { return this.request('matches', 'GET', null, `or=(user_1_id.eq.${userId},user_2_id.eq.${userId})`); },
  async updateMatch(matchId, data){ return this.request('matches', 'PATCH', data, `id=eq.${matchId}`); },
  async getMatchByNotes(n1, n2) {
    const r1 = await this.request('matches', 'GET', null, `note_1_id=eq.${n1}&note_2_id=eq.${n2}`);
    if (r1 && r1.length > 0) return r1;
    return this.request('matches', 'GET', null, `note_1_id=eq.${n2}&note_2_id=eq.${n1}`);
  },
};

const toSnakeCase = (note) => ({
  description:      note.description,
  artist:           note.artist,
  time:             note.time,
  location:         note.location,
  other_person_desc: note.otherPersonDesc ?? null,
  own_desc:         note.ownDesc ?? null,
  companions:       note.companions ?? null,
  instagram:        note.instagram ?? null,
  visibility:       note.visibility,
  user_id:          note.user_id,
});

const toCamelCase = (note) => ({
  ...note,
  otherPersonDesc: note.other_person_desc,
  ownDesc:         note.own_desc,
});

// ─── Shared style tokens ───────────────────────────────────────────────────
const t = {
  primary:       '#F7602E',
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
  const [showSplash, setShowSplash]         = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(() => !!localStorage.getItem('fulmi_onboarding_done'));
  const [user, setUser]                     = useState(null);
  const [userId, setUserId]                 = useState(null);
  const [tab, setTab]                       = useState('notes');
  const [email, setEmail]                   = useState('');
  const [name, setName]                     = useState('');
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [vibeModalOpen, setVibeModalOpen]   = useState(false);
  const [loading, setLoading]               = useState(false);
  const [myNotes, setMyNotes]               = useState([]);
  const [publicNotes, setPublicNotes]       = useState([]);
  const [dismissedNotes, setDismissedNotes] = useState(new Set());
  const [suggestedMatches, setSuggestedMatches] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [confirmedMatches, setConfirmedMatches] = useState([]);
  const [boardSubTab, setBoardSubTab]           = useState('everyone');
  const [noteAuthors, setNoteAuthors]           = useState({});

  // ── Load / refresh all data from DB ──────────────────────────────────────
  const lastRefresh = useRef(0);

  const loadData = useCallback(async (uid) => {
    if (!uid) return;
    // Debounce: skip if refreshed within the last 10 seconds
    const now = Date.now();
    if (now - lastRefresh.current < 10_000) return;
    lastRefresh.current = now;

    try {
      const [notes, allNotes, existingMatches] = await Promise.all([
        supabase.getNotes(uid),
        supabase.getAllNotes(),
        supabase.getMatches(uid),
      ]);

      const camelNotes = notes ? notes.map(toCamelCase) : [];
      setMyNotes(camelNotes);

      if (allNotes) {
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

        // AI-suggested matches
        const userTargeted = camelNotes.filter(n => n.visibility === 'targeted' || n.visibility === 'private');
        if (userTargeted.length > 0) {
          const otherNotes = camelAll.filter(n => (n.visibility === 'targeted' || n.visibility === 'private') && n.user_id !== uid);
          setSuggestedMatches(findMatches(userTargeted[0], otherNotes));
        } else {
          setSuggestedMatches([]);
        }

        // Existing match records
        if (existingMatches && existingMatches.length > 0) {
          const ourNoteId = userTargeted[0]?.id;

          setSuggestedMatches(prev => prev.map(m => {
            const record = existingMatches.find(r =>
              (r.note_1_id === ourNoteId && r.note_2_id === m.id) ||
              (r.note_2_id === ourNoteId && r.note_1_id === m.id)
            );
            if (!record) return m;
            const isUser1 = record.user_1_id === uid;
            const myResponse = isUser1 ? record.user_1_response : record.user_2_response;
            return myResponse ? { ...m, userResponse: myResponse } : m;
          }));

          // Pending received requests — only keep if the note still exists
          const receivedRaw = existingMatches.filter(r =>
            r.user_2_id === uid && !r.user_2_response && r.user_1_response === 'yes'
          );
          const received = (await Promise.all(receivedRaw.map(async r => {
            const theirNote = camelAll.find(n => n.id === r.note_1_id);
            if (!theirNote) return null;
            const userRes = await supabase.getUserById(r.user_1_id);
            return { matchId: r.id, note: theirNote, createdAt: r.created_at, authorName: userRes?.[0]?.email?.split('@')[0] || '' };
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

  // Re-fetch whenever the tab becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(userId); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, loadData]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const users = await supabase.getUser(email);
      let uid;
      if (users && users.length > 0) {
        uid = users[0].id;
      } else {
        const newUser = await supabase.createUser(email);
        uid = newUser[0]?.id;
      }
      if (uid) {
        setUser({ email });
        setUserId(uid);
        lastRefresh.current = 0; // force a full load on login
        await loadData(uid);
        setEmail('');
        setName('');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Error logging in');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (formData) => {
    if (!userId) return;
    setLoading(true);
    try {
      const noteData = toSnakeCase({ ...formData, user_id: userId });
      const created = await supabase.createNote(userId, noteData);
      if (created) {
        const newNote = toCamelCase(created[0]);
        if (formData.visibility === 'targeted' || formData.visibility === 'private') {
          setMyNotes(prev => [...prev, newNote]);
          const allNotes = await supabase.getAllNotes();
          if (allNotes) {
            const otherNotes = allNotes.map(toCamelCase).filter(n => (n.visibility === 'targeted' || n.visibility === 'private') && n.user_id !== userId);
            setSuggestedMatches(findMatches(newNote, otherNotes));
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

  const handleSendRequest = (note) => {
    setPublicNotes(prev => prev.map(n => n.id === note.id ? { ...n, requested: true } : n));
  };

  const handleLikePublic = (noteId) => {
    setPublicNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, liked: !n.liked, likes: (n.likes || 0) + (n.liked ? -1 : 1) } : n
    ));
  };

  const handleDismissNote = (noteId) => {
    setDismissedNotes(prev => new Set([...prev, noteId]));
  };

  const handleMatchResponse = async (matchId, response) => {
    const match = suggestedMatches.find(m => m.id === matchId);
    const ourNoteId = myNotes.find(n => n.visibility === 'targeted' || n.visibility === 'private')?.id;
    setSuggestedMatches(prev => prev.map(m => m.id === matchId ? { ...m, userResponse: response } : m));
    if (response === 'yes' && userId && ourNoteId && match) {
      const existing = await supabase.getMatchByNotes(ourNoteId, matchId);
      if (existing && existing.length > 0) {
        const record = existing[0];
        const isUser1 = record.user_1_id === userId;
        const otherResponse = isUser1 ? record.user_2_response : record.user_1_response;
        const revealed = otherResponse === 'yes';
        const updateData = isUser1 ? { user_1_response: 'yes', revealed } : { user_2_response: 'yes', revealed };
        await supabase.updateMatch(record.id, updateData);
      } else {
        await supabase.createMatch({
          note_1_id: ourNoteId, note_2_id: matchId,
          user_1_id: userId, user_2_id: match.user_id,
          score: match.score, quality: match.quality,
          user_1_response: 'yes',
        });
      }
    }
  };

  const handleRequestResponse = async (matchId, accept) => {
    setReceivedRequests(prev => prev.filter(r => r.matchId !== matchId));
    const record = (await supabase.getMatches(userId) || []).find(r => r.id === matchId);
    if (!record) return;
    const revealed = accept && record.user_1_response === 'yes';
    await supabase.updateMatch(matchId, { user_2_response: accept ? 'yes' : 'no', revealed });
    if (revealed) {
      const allN = await supabase.getAllNotes();
      const camelAll = allN ? allN.map(toCamelCase) : [];
      const theirNote = camelAll.find(n => n.id === record.note_1_id);
      if (theirNote) {
        setConfirmedMatches(prev => [...prev, { matchId, note: theirNote, score: record.score, quality: record.quality }]);
      }
    }
  };

  // ── Splash screen ────────────────────────────────────────────────────────

  if (showSplash) {
    return (
      <div style={{
        maxWidth: '380px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.primary, fontFamily: font,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px 52px',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{
            width: '88px', height: '88px', borderRadius: '28px',
            backgroundColor: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px',
          }}>⚡</div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '42px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 8px', letterSpacing: '-1px' }}>Fulmi</h1>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.75)', margin: 0, fontWeight: '400' }}>
              Find that person you vibed with
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSplash(false)}
          style={{
            width: '100%', padding: '17px', border: 'none',
            backgroundColor: '#FFFFFF', borderRadius: '50px',
            fontSize: '16px', fontWeight: '700', color: t.primary,
            cursor: 'pointer', fontFamily: font,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
        >Get started</button>
      </div>
    );
  }

  // ── Login screen ─────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{
        maxWidth: '380px', margin: '0 auto', minHeight: '100vh',
        backgroundColor: t.primary, fontFamily: font,
        display: 'flex', flexDirection: 'column',
        padding: '0 24px 48px',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingTop: '48px' }}>
          <span style={{ fontSize: '36px' }}>⚡</span>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#FFFFFF', margin: '4px 0 6px', letterSpacing: '-0.5px' }}>Fulmi</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.70)', margin: 0 }}>
            Find that person you vibed with
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text" placeholder="Your name"
            value={name} onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="fulmi-input"
            style={{
              height: '52px', padding: '0 16px', borderRadius: '14px',
              border: 'none', fontSize: '15px',
              backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
              outline: 'none', fontFamily: font,
            }}
          />
          <input
            type="email" placeholder="Your email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            required disabled={loading}
            className="fulmi-input"
            style={{
              height: '52px', padding: '0 16px', borderRadius: '14px',
              border: 'none', fontSize: '15px',
              backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF',
              outline: 'none', fontFamily: font,
            }}
          />
          <button type="submit" disabled={loading} style={{
            height: '52px', cursor: 'pointer', borderRadius: '50px',
            border: 'none', backgroundColor: '#FFFFFF',
            fontSize: '15px', fontWeight: '700', color: t.primary,
            transition: 'opacity 0.2s', fontFamily: font, marginTop: '4px',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  if (!onboardingDone) {
    return (
      <Onboarding onComplete={() => {
        localStorage.setItem('fulmi_onboarding_done', '1');
        setOnboardingDone(true);
      }} />
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '380px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: t.bg, fontFamily: font }}>

      {/* Top header */}
      <div style={{ backgroundColor: t.white, borderBottom: `1px solid ${t.border}`, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              backgroundColor: t.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span style={{ fontSize: '16px', fontWeight: '800', color: t.primary, letterSpacing: '-0.3px' }}>Fulmi</span>
          </div>
          <button
            onClick={() => { setUser(null); setUserId(null); setSuggestedMatches([]); setShowSplash(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Sign out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', backgroundColor: '#FFFFFF' }}>

        {/* ── TAB: AI SEARCH ── */}
        {tab === 'notes' && (
          <SearchWithAI onSave={handleSaveNote} />
        )}

        {/* ── TAB: CONNECTIONS ── */}
        {tab === 'matches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0', color: t.dark, letterSpacing: '-0.5px' }}>Connections</h1>

            {/* Pending requests carousel */}
            {receivedRequests.length > 0 && (
              <div style={{ margin: '0 -16px' }}>
                <div style={{ padding: '0 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: t.dark }}>Pending</h3>
                    <span style={{
                      backgroundColor: t.primary, color: t.white,
                      fontSize: '10px', fontWeight: '700',
                      borderRadius: '99px', padding: '1px 7px', fontFamily: font,
                    }}>{receivedRequests.length}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>from public posts</span>
                </div>
                <div style={{
                  display: 'flex', gap: '10px', overflowX: 'auto',
                  scrollSnapType: 'x mandatory', padding: '4px 16px 12px',
                  scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
                }}>
                  {receivedRequests.map(req => (
                    <div key={req.matchId} style={{
                      minWidth: '78%', maxWidth: '280px', scrollSnapAlign: 'start', flexShrink: 0,
                      backgroundColor: t.white, borderRadius: '16px',
                      border: `1px solid ${t.primaryBorder}`,
                      padding: '16px', boxShadow: '0 2px 8px rgba(247,96,46,0.08)',
                    }}>
                      <div style={{ marginBottom: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: t.dark, fontFamily: font }}>
                          {req.authorName || 'Someone'}
                        </span>
                        <span style={{ fontSize: '13px', color: t.textMuted, fontFamily: font }}> wants to connect</span>
                      </div>
                      {[
                        req.note?.location && req.note.location.replace(/_/g, ' '),
                        req.note?.time,
                        req.note?.artist && req.note.artist !== 'Otro' ? req.note.artist : null,
                      ].filter(Boolean).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                          {[
                            req.note?.location && req.note.location.replace(/_/g, ' '),
                            req.note?.time,
                            req.note?.artist && req.note.artist !== 'Otro' ? req.note.artist : null,
                          ].filter(Boolean).map((chip, i) => (
                            <span key={i} style={{
                              fontSize: '10px', color: t.textMuted, backgroundColor: t.surface,
                              borderRadius: '6px', padding: '3px 8px', fontFamily: font,
                              textTransform: 'capitalize',
                            }}>{chip}</span>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: '13px', lineHeight: '1.55', color: t.textSec, margin: '0 0 14px', fontFamily: font }}>
                        {req.note?.description?.substring(0, 100)}{req.note?.description?.length > 100 ? '…' : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleRequestResponse(req.matchId, false)} style={{ ...btnGhost, flex: 1, fontSize: '12px' }}>Decline</button>
                        <button onClick={() => handleRequestResponse(req.matchId, true)} style={{ ...btnPrimary, flex: 1, fontSize: '12px' }}>Accept</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ minWidth: '4px', flexShrink: 0 }} />
                </div>
              </div>
            )}

            {/* Confirmed / Connected */}
            {confirmedMatches.length > 0 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 12px', color: t.dark }}>Connected ✅</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {confirmedMatches.map(cm => (
                    <div key={cm.matchId} style={{ ...cardStyle, borderColor: t.successBorder, backgroundColor: t.successBg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <Badge label="Mutual match" color={t.successDark} bg={t.successBg} border={t.successBorder} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {cm.authorName && <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>@{cm.authorName}</span>}
                          {cm.score && <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>{cm.score}%</span>}
                        </div>
                      </div>
                      {cm.note?.instagram ? (
                        <div style={{
                          backgroundColor: t.white, border: `1px solid ${t.successBorder}`,
                          borderRadius: '10px', padding: '10px 14px',
                          display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                          <span style={{ fontSize: '16px' }}>📱</span>
                          <div>
                            <p style={{ margin: '0 0 1px', fontSize: '10px', color: t.successDark, fontWeight: '600', fontFamily: font }}>INSTAGRAM / WHATSAPP</p>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: t.dark, fontFamily: font }}>@{cm.note.instagram}</p>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: '12px', color: t.textMuted, margin: 0, fontFamily: font }}>No contact shared</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested by AI — Tinder deck */}
            {(() => {
              const activeDeck = suggestedMatches.filter(m => m.userResponse === null);
              const waitingMatches = suggestedMatches.filter(m => m.userResponse === 'yes' && !confirmedMatches.find(cm => cm.note?.id === m.id));
              const connectedFromSuggested = suggestedMatches
                .map(m => confirmedMatches.find(cm => cm.note?.id === m.id))
                .filter(Boolean);
              const currentCard = activeDeck[0] || null;
              const remaining = activeDeck.length;
              const myTargetedNote = myNotes.find(n => n.visibility === 'targeted' || n.visibility === 'private');

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: t.dark }}>Suggested by AI</h3>
                    {remaining > 0 && <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>{remaining} left</span>}
                  </div>

                  {suggestedMatches.length === 0 ? (
                    <EmptyState text="No connections yet." sub="Create a search or post to find someone." />
                  ) : currentCard ? (
                    <AIMatchCard
                      key={currentCard.id}
                      match={currentCard}
                      authorName={noteAuthors[currentCard.user_id]}
                      myNote={myTargetedNote}
                      onNo={() => handleMatchResponse(currentCard.id, 'no')}
                      onYes={() => handleMatchResponse(currentCard.id, 'yes')}
                    />
                  ) : (
                    <div style={{
                      background: 'linear-gradient(160deg, #FFF5F0 0%, #FFEEE5 100%)',
                      border: `1px solid ${t.primaryBorder}`,
                      borderRadius: '20px', padding: '36px 24px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>✨</div>
                      <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: t.dark, fontFamily: font }}>You've seen them all</p>
                      <p style={{ margin: 0, fontSize: '13px', color: t.textMuted, fontFamily: font }}>New matches appear as more people post</p>
                    </div>
                  )}

                  {waitingMatches.length > 0 && (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {waitingMatches.map(m => (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          backgroundColor: 'rgba(247,96,46,0.07)', border: `1px solid ${t.primaryBorder}`,
                          borderRadius: '14px', padding: '12px 14px',
                        }}>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: t.dark, fontFamily: font }}>
                              {noteAuthors[m.user_id] || 'Someone'}
                            </span>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: t.textMuted, fontFamily: font }}>Waiting for their response…</p>
                          </div>
                          <span style={{ fontSize: '18px' }}>⏳</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {connectedFromSuggested.map(cm => (
                    <div key={cm.matchId} style={{
                      marginTop: '16px',
                      backgroundColor: t.successBg, border: `1px solid ${t.successBorder}`,
                      borderRadius: '18px', padding: '20px',
                      boxShadow: '0 4px 16px rgba(5,194,112,0.12)',
                    }}>
                      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
                        <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '800', color: t.successDark, fontFamily: font }}>You connected!</p>
                        <p style={{ margin: 0, fontSize: '13px', color: t.textSec, fontFamily: font }}>{cm.authorName || 'Someone'} also said yes</p>
                      </div>
                      {cm.note?.instagram ? (
                        <div style={{
                          backgroundColor: t.white, border: `1px solid ${t.successBorder}`,
                          borderRadius: '12px', padding: '12px 16px',
                          display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                          <span style={{ fontSize: '22px' }}>📱</span>
                          <div>
                            <p style={{ margin: '0 0 1px', fontSize: '10px', color: t.successDark, fontWeight: '700', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Instagram / WhatsApp</p>
                            <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font }}>@{cm.note.instagram}</p>
                          </div>
                        </div>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '12px', color: t.textMuted, margin: 0, fontFamily: font }}>No contact shared yet</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── TAB: VIBES ── */}
        {tab === 'public' && (
          <div style={{ margin: '0 -16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: t.dark, letterSpacing: '-0.5px' }}>Vibes</h1>
              <button onClick={() => setVibeModalOpen(true)} style={{
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
                backgroundColor: '#C4B9AE', borderRadius: '12px',
                padding: '4px', gap: '0',
              }}>
                {/* sliding pill */}
                <div style={{
                  position: 'absolute', top: '4px', bottom: '4px',
                  left: boardSubTab === 'everyone' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents: 'none',
                }} />
                {[{ id: 'everyone', label: 'All' }, { id: 'mine', label: 'Mine' }].map(st => (
                  <button key={st.id} onClick={() => setBoardSubTab(st.id)} style={{
                    position: 'relative', zIndex: 1,
                    padding: '6px 24px', borderRadius: '8px', cursor: 'pointer',
                    border: 'none', background: 'transparent',
                    color: boardSubTab === st.id ? t.dark : '#fff',
                    fontSize: '12px', fontWeight: boardSubTab === st.id ? '700' : '500',
                    fontFamily: font, letterSpacing: '0.03em',
                    transition: 'color 0.22s, font-weight 0.1s',
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

        {/* ── TAB: PROFILE ── */}
        {tab === 'profile' && (() => {
          const searches = myNotes.filter(n => n.visibility === 'targeted' || n.visibility === 'private');
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: t.dark, letterSpacing: '-0.5px' }}>Profile</h1>

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
                    { value: searches.length, label: 'Searches' },
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

              {/* My Searches list */}
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 12px', color: t.dark, fontFamily: font }}>My Searches</h3>
                {searches.length === 0 ? (
                  <EmptyState text="No searches yet." sub="Use AI Search to find someone. 🔍" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {searches.map(note => {
                      const metaParts = [
                        note.location && note.location.replace(/_/g, ' '),
                        note.time,
                        note.artist && note.artist !== 'Otro' ? note.artist : null,
                      ].filter(Boolean);
                      return (
                        <div key={note.id} style={cardStyle}>
                          {metaParts.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                              {metaParts.map((m, i) => (
                                <span key={i} style={{
                                  fontSize: '10px', color: t.textMuted, backgroundColor: t.surface,
                                  borderRadius: '6px', padding: '3px 8px', fontFamily: font,
                                  textTransform: 'capitalize',
                                }}>{m}</span>
                              ))}
                            </div>
                          )}
                          <p style={{ fontSize: '14px', color: t.text, margin: 0, lineHeight: '1.6' }}>
                            {note.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <CreateNoteFlow isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveNote} />
      <CreateNoteFlow isOpen={vibeModalOpen} onClose={() => setVibeModalOpen(false)} onSave={handleSaveNote} initialVisibility="public" />

      {/* Bottom Navigation — icon only */}
      <div style={{
        backgroundColor: t.white, borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'flex-end',
        padding: '6px 8px 10px', position: 'sticky', bottom: 0, gap: '4px',
      }}>
        {/* AI Search */}
        <button onClick={() => setTab('notes')} style={{
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
        <button onClick={() => setTab('public')} style={{
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
        <button onClick={() => setTab('matches')} style={{
          flex: 1, background: 'none', border: 'none', padding: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: tab === 'matches' ? t.primary : t.textMuted,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={tab === 'matches' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </button>

        {/* Profile */}
        <button onClick={() => setTab('profile')} style={{
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
  backgroundColor: '#F7602E', borderRadius: '10px',
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

// ─── AIMatchCard ───────────────────────────────────────────────────────────

const AIMatchCard = ({ match, authorName, myNote, onNo, onYes }) => {
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
      background: 'linear-gradient(160deg, #FFF5F0 0%, #FFEADE 100%)',
      border: `1px solid ${t.primaryBorder}`,
      borderRadius: '20px', padding: '24px 20px 20px',
      minHeight: '460px', display: 'flex', flexDirection: 'column',
      boxShadow: '0 4px 20px rgba(247,96,46,0.08)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '17px', fontWeight: '700', color: t.dark, fontFamily: font, display: 'block' }}>
            {authorName || 'Someone'}
          </span>
          <span style={{ fontSize: '12px', color: t.textMuted, fontFamily: font }}>Matched by AI</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          backgroundColor: 'rgba(247,96,46,0.10)', borderRadius: '99px', padding: '4px 10px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span style={{ fontSize: '13px', fontWeight: '700', color: t.primary, fontFamily: font }}>{match.score}%</span>
        </div>
      </div>

      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {chips.map(({ label, key }) => {
            const common = isCommon(key);
            return (
              <span key={key} style={{
                fontSize: '11px', fontFamily: font, textTransform: 'capitalize',
                borderRadius: '6px', padding: '4px 10px',
                backgroundColor: common ? 'rgba(247,96,46,0.13)' : t.surface,
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

      <p style={{
        flex: 1, fontSize: '16px', lineHeight: '1.65',
        color: t.text, margin: '0 0 20px', fontFamily: font, fontWeight: '400',
      }}>
        {match.description}
      </p>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <button onClick={onNo} style={{
          width: '60px', height: '60px', borderRadius: '50%',
          border: `1.5px solid ${t.borderDark}`, backgroundColor: t.white,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(29,29,47,0.08)',
        }} title="Pass">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button onClick={onYes} style={{
          width: '60px', height: '60px', borderRadius: '50%',
          border: 'none', backgroundColor: t.primary,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(247,96,46,0.35)',
        }} title="Connect">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

// ─── VibesFeed ─────────────────────────────────────────────────────────────

const VibesFeed = ({ notes, noteAuthors, onSendRequest, onLike, myUserId }) => {
  const [shareNote, setShareNote] = useState(null);

  if (notes.length === 0) {
    return <EmptyState text="No vibes yet." sub="Be the first to share your moment! ⚡" />;
  }

  const handleShare = (note) => {
    if (navigator.share) {
      navigator.share({ title: 'Fulmi — Vibe', text: note.description, url: window.location.href }).catch(() => {});
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

              {/* Connect — thunder icon, grey */}
              <button onClick={() => onSendRequest(note)} disabled={note.requested} style={{
                ...iconBtn,
                opacity: note.requested ? 0.4 : 1,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </button>
            </div>
          </div>
        );
      })}

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
                { label: 'Copy link', icon: '🔗', action: () => { navigator.clipboard?.writeText(window.location.href); setShareNote(null); } },
                { label: 'WhatsApp', icon: '💬', action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareNote.description)}`); setShareNote(null); } },
                { label: 'Instagram', icon: '📸', action: () => setShareNote(null) },
              ].map(({ label, icon, action }) => (
                <button key={label} onClick={action} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  backgroundColor: t.surface, border: 'none', borderRadius: '12px', padding: '14px 8px',
                  cursor: 'pointer', fontSize: '11px', color: t.textSec, fontFamily: font, fontWeight: '500',
                }}>
                  <span style={{ fontSize: '22px' }}>{icon}</span>
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

// ─── EmptyState ────────────────────────────────────────────────────────────

const EmptyState = ({ text, sub }) => (
  <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9E9A93' }}>
    <p style={{ fontSize: '14px', margin: '0 0 4px', fontFamily: font }}>{text}</p>
    {sub && <p style={{ fontSize: '12px', margin: 0, fontFamily: font }}>{sub}</p>}
  </div>
);

export default PrimaveraApp;
