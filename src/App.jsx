import React, { useState, useEffect } from 'react';
import CreateNoteFlow from './CreateNoteFlow';
import Onboarding from './Onboarding';
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

// ─── Shared style tokens (mirrors CSS vars for inline use) ─────────────────
const t = {
  primary:        '#F7602E',
  primaryLight:   '#FAA284',
  primaryBg:      '#FFF0EB',
  primaryBorder:  '#FABB96',
  bg:             '#FEFBF6',
  white:          '#FFFFFF',
  surface:        '#F7F5F2',
  dark:           '#1D1D2F',
  darkBlue:       '#24223B',
  third:          '#DDA488',
  thirdLight:     '#F5E8DF',
  border:         '#EDE8DF',
  borderDark:     '#DDD9D1',
  text:           '#1D1D2F',
  textSec:        '#56524E',
  textMuted:      '#9E9A93',
  success:        '#05C270',
  successBg:      '#E6FAF2',
  successBorder:  '#A8E6CF',
  successDark:    '#036B42',
  danger:         '#FF4B4B',
  dangerBg:       '#FFF0F0',
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
  const [onboardingDone, setOnboardingDone] = useState(() => !!localStorage.getItem('fulmi_onboarding_done'));
  const [user, setUser]                     = useState(null);
  const [userId, setUserId]                 = useState(null);
  const [tab, setTab]                       = useState('notes');
  const [email, setEmail]                   = useState('');
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [loading, setLoading]               = useState(false);
  const [myNotes, setMyNotes]               = useState([]);
  const [publicNotes, setPublicNotes]       = useState([]);
  const [dismissedNotes, setDismissedNotes] = useState(new Set());
  const [suggestedMatches, setSuggestedMatches] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [confirmedMatches, setConfirmedMatches] = useState([]);
  const [boardSubTab, setBoardSubTab]           = useState('everyone');

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
        const notes = await supabase.getNotes(uid);
        const camelNotes = notes ? notes.map(toCamelCase) : [];
        if (camelNotes.length) setMyNotes(camelNotes);
        const allNotes = await supabase.getAllNotes();
        if (allNotes) {
          const camelAll = allNotes.map(toCamelCase);
          setPublicNotes(camelAll.filter(n => n.visibility === 'public'));
          if (camelNotes.length > 0) {
            const userPrivateNotes = camelNotes.filter(n => n.visibility === 'private');
            if (userPrivateNotes.length > 0) {
              const privateNotes = camelAll.filter(n => n.visibility === 'private' && n.user_id !== uid);
              const matches = findMatches(userPrivateNotes[0], privateNotes);
              setSuggestedMatches(matches);
            }
          }
        }
        const ourNoteId = camelNotes.find(n => n.visibility === 'private')?.id;
        const existingMatches = await supabase.getMatches(uid);
        if (existingMatches && existingMatches.length > 0) {
          // Update response state on AI-suggested matches
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

          const allN = await supabase.getAllNotes();
          const camelAll = allN ? allN.map(toCamelCase) : [];

          // Requests received: someone connected to one of my public notes, awaiting my response
          const received = existingMatches.filter(r => {
            const isUser2 = r.user_2_id === uid;
            const myResp = isUser2 ? r.user_2_response : null;
            return isUser2 && !myResp && r.user_1_response === 'yes';
          }).map(r => {
            const theirNote = camelAll.find(n => n.id === r.note_1_id);
            return { matchId: r.id, note: theirNote, createdAt: r.created_at };
          }).filter(r => r.note);
          setReceivedRequests(received);

          // Confirmed bilateral matches (both said yes)
          const confirmed = existingMatches.filter(r => r.revealed).map(r => {
            const isUser1 = r.user_1_id === uid;
            const theirNoteId = isUser1 ? r.note_2_id : r.note_1_id;
            const theirNote = camelAll.find(n => n.id === theirNoteId);
            return { matchId: r.id, note: theirNote, score: r.score, quality: r.quality };
          }).filter(r => r.note);
          setConfirmedMatches(confirmed);
        }
        setEmail('');
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
        if (formData.visibility === 'private') {
          setMyNotes(prev => [...prev, newNote]);
          const allNotes = await supabase.getAllNotes();
          if (allNotes) {
            const privateNotes = allNotes.map(toCamelCase).filter(n => n.visibility === 'private' && n.user_id !== userId);
            const matches = findMatches(newNote, privateNotes);
            setSuggestedMatches(matches);
          }
        } else {
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
    const ourNoteId = myNotes.find(n => n.visibility === 'private')?.id;
    setSuggestedMatches(prev => prev.map(m => m.id === matchId ? { ...m, userResponse: response } : m));
    if (response === 'yes' && userId && ourNoteId && match) {
      const existing = await supabase.getMatchByNotes(ourNoteId, matchId);
      let revealed = false;
      if (existing && existing.length > 0) {
        const record = existing[0];
        const isUser1 = record.user_1_id === userId;
        const otherResponse = isUser1 ? record.user_2_response : record.user_1_response;
        revealed = otherResponse === 'yes';
        const updateData = isUser1
          ? { user_1_response: 'yes', revealed }
          : { user_2_response: 'yes', revealed };
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

  // ── Login screen ─────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ maxWidth: '380px', margin: '0 auto', padding: '2rem 1.25rem', fontFamily: font, backgroundColor: t.bg, minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', paddingTop: '3rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: t.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
            ⚡
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', margin: '0 0 6px', color: t.dark, letterSpacing: '-0.5px' }}>
            Fulmi
          </h1>
          <p style={{ fontSize: '14px', color: t.textMuted, margin: 0 }}>
            Find the person you can't forget
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email" placeholder="your email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            required disabled={loading}
            style={{
              height: '48px', padding: '0 14px', borderRadius: '12px',
              border: `1.5px solid ${t.border}`, fontSize: '14px',
              backgroundColor: t.white, color: t.dark, outline: 'none',
              fontFamily: font,
            }}
          />
          <button type="submit" disabled={loading} style={{
            height: '48px', cursor: 'pointer', borderRadius: '12px',
            border: 'none', backgroundColor: loading ? t.primaryLight : t.primary,
            fontSize: '14px', fontWeight: '600', color: t.white,
            transition: 'opacity 0.2s', fontFamily: font,
          }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', padding: '16px', backgroundColor: t.white, borderRadius: '12px', border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: t.dark, margin: '0 0 10px' }}>How it works</p>
          <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              'Write a targeted search about a specific encounter',
              'AI automatically finds compatible matches',
              'On a mutual match: contacts are revealed',
              'Or shout your moment on the public board',
            ].map((text, i) => (
              <li key={i} style={{ fontSize: '12px', color: t.textSec, lineHeight: '1.5' }}>{text}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────

  if (!onboardingDone) {
    return (
      <Onboarding onComplete={() => {
        localStorage.setItem('fulmi_onboarding_done', '1');
        setOnboardingDone(true);
      }} />
    );
  }

  return (
    <div style={{ maxWidth: '380px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: t.bg, fontFamily: font }}>

      {/* Header */}
      <div style={{ backgroundColor: t.white, borderBottom: `1px solid ${t.border}`, padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚡</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: t.dark }}>Fulmi</span>
          </div>
          <button onClick={() => { setUser(null); setUserId(null); setSuggestedMatches([]); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: '12px', fontFamily: font }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>

        {/* ── TAB: MY SEARCHES ── */}
        {tab === 'notes' && (() => {
          const searches = myNotes.filter(n => n.visibility === 'targeted' || n.visibility === 'private');
          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: t.dark }}>My Searches</h3>
                <button onClick={() => setIsModalOpen(true)} disabled={loading} style={{
                  background: t.primary, border: 'none', borderRadius: '10px',
                  padding: '8px 14px', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', color: t.white, opacity: loading ? 0.5 : 1,
                  fontFamily: font,
                }}>
                  + Create
                </button>
              </div>

              {searches.length === 0 ? (
                <EmptyState text="No searches yet." sub="Create one to find someone special. 🔍" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {searches.map(note => (
                    <div key={note.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Badge label="🔍 Searching" color={t.darkBlue} bg="#EEEDF5" border="#C5C3D8" />
                        {note.artist && <span style={{ fontSize: '11px', color: t.textMuted }}>{note.artist}</span>}
                      </div>
                      <p style={{ fontSize: '13px', color: t.textSec, margin: '0 0 8px', lineHeight: '1.55' }}>
                        {note.description.substring(0, 100)}{note.description.length > 100 ? '…' : ''}
                      </p>
                      {note.instagram && (
                        <div style={{ fontSize: '12px', color: t.primary, backgroundColor: t.primaryBg, padding: '6px 10px', borderRadius: '8px', display: 'inline-block' }}>
                          📱 {note.instagram}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── TAB: MATCHES ── */}
        {tab === 'matches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── Solicitudes recibidas (carousel, solo si hay) ── */}
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
                      {req.note?.artist && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: t.primary,
                          textTransform: 'uppercase', letterSpacing: '0.07em',
                          display: 'block', marginBottom: '8px', fontFamily: font,
                        }}>{req.note.artist}</span>
                      )}
                      <p style={{
                        fontSize: '14px', lineHeight: '1.6', color: t.text,
                        margin: '0 0 16px', fontFamily: font,
                      }}>
                        {req.note?.description?.substring(0, 120)}{req.note?.description?.length > 120 ? '…' : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRequestResponse(req.matchId, false)}
                          style={{ ...btnGhost, flex: 1, fontSize: '12px' }}
                        >Decline</button>
                        <button
                          onClick={() => handleRequestResponse(req.matchId, true)}
                          style={{ ...btnPrimary, flex: 1, fontSize: '12px' }}
                        >⚡ Accept</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ minWidth: '4px', flexShrink: 0 }} />
                </div>
              </div>
            )}

            {/* ── Conexiones confirmadas ── */}
            {confirmedMatches.length > 0 && (
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 12px', color: t.dark }}>
                  Connected ✅
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {confirmedMatches.map(cm => (
                    <div key={cm.matchId} style={{ ...cardStyle, borderColor: t.successBorder, backgroundColor: t.successBg }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <Badge label="Mutual match" color={t.successDark} bg={t.successBg} border={t.successBorder} />
                        {cm.score && <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>{cm.score}%</span>}
                      </div>
                      {cm.note?.artist && (
                        <span style={{ fontSize: '11px', color: t.primary, fontWeight: '600', display: 'block', marginBottom: '6px', fontFamily: font }}>
                          {cm.note.artist}
                        </span>
                      )}
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

            {/* ── Sugeridos por IA ── */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 12px', color: t.dark }}>Suggested by AI</h3>
              {suggestedMatches.length === 0 ? (
                <EmptyState text="No connections yet." sub="Create a search or post to find someone." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {suggestedMatches.map(match => (
                    <div key={match.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <Badge
                          label={`${match.quality} · ${match.score}%`}
                          color={match.score >= 70 ? t.successDark : t.textSec}
                          bg={match.score >= 70 ? t.successBg : t.surface}
                          border={match.score >= 70 ? t.successBorder : t.border}
                        />
                      </div>
                      <p style={{ fontSize: '13px', color: t.textSec, margin: '0 0 12px', lineHeight: '1.55', fontFamily: font }}>
                        {match.description}
                      </p>
                      {match.userResponse === 'yes' && (
                        <div style={{ backgroundColor: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                          <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: '600', color: t.successDark, fontFamily: font }}>✅ Request sent</p>
                          <p style={{ margin: 0, fontSize: '12px', color: t.textSec, fontFamily: font }}>Waiting for their response…</p>
                        </div>
                      )}
                      {match.userResponse === null ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleMatchResponse(match.id, 'no')} style={btnGhost}>No</button>
                          <button onClick={() => handleMatchResponse(match.id, 'maybe')} style={btnOutline}>Quizás</button>
                          <button onClick={() => handleMatchResponse(match.id, 'yes')} style={btnPrimary}>Sí ⚡</button>
                        </div>
                      ) : match.userResponse !== 'yes' ? (
                        <div style={{ padding: '8px 12px', backgroundColor: t.surface, borderRadius: '8px', fontSize: '12px', color: t.textMuted, textAlign: 'center', fontFamily: font }}>
                          {match.userResponse === 'maybe' ? '~ Quizás' : '✗ No'}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── TAB: BOARD ── */}
        {tab === 'public' && (
          <div style={{ margin: '0 -16px' }}>
            {/* Sub-tab switcher */}
            <div style={{ padding: '0 16px 14px', display: 'flex', gap: '8px' }}>
              {[
                { id: 'everyone', label: "Everyone's Posts" },
                { id: 'mine', label: 'My Posts' },
              ].map(st => (
                <button key={st.id} onClick={() => setBoardSubTab(st.id)} style={{
                  padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
                  border: boardSubTab === st.id ? 'none' : `1px solid ${t.border}`,
                  backgroundColor: boardSubTab === st.id ? t.primary : t.white,
                  color: boardSubTab === st.id ? t.white : t.textMuted,
                  fontSize: '12px', fontWeight: boardSubTab === st.id ? '600' : '400',
                  fontFamily: font,
                }}>{st.label}</button>
              ))}
            </div>

            {/* Sub-tab: My Posts */}
            {boardSubTab === 'mine' && (() => {
              const myPublic = myNotes.filter(n => n.visibility === 'public');
              return myPublic.length === 0 ? (
                <div style={{ padding: '0 16px' }}>
                  <EmptyState text="No posts yet." sub="Share a festival moment. 📣" />
                </div>
              ) : (
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myPublic.map(note => (
                    <div key={note.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Badge label="📣 Public" color={t.primary} bg={t.primaryBg} border={t.primaryBorder} />
                        {note.artist && <span style={{ fontSize: '11px', color: t.textMuted }}>{note.artist}</span>}
                      </div>
                      <p style={{ fontSize: '13px', color: t.textSec, margin: '0 0 8px', lineHeight: '1.55' }}>
                        {note.description.substring(0, 120)}{note.description.length > 120 ? '…' : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: t.textMuted, fontFamily: font }}>
                        <span>❤️ {note.likes || 0} likes</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Sub-tab: Everyone's Posts */}
            {boardSubTab === 'everyone' && publicNotes.filter(n => !dismissedNotes.has(n.id)).length === 0 ? (
              <div style={{ padding: '0 16px' }}>
                <EmptyState text="No posts yet." sub="Be the first to shout your moment! 📣" />
              </div>
            ) : boardSubTab === 'everyone' && (
              <div style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                padding: '4px 16px 20px',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}>
                {publicNotes.filter(n => !dismissedNotes.has(n.id)).map(note => (
                  <div key={note.id} style={{
                    minWidth: '82%',
                    maxWidth: '300px',
                    scrollSnapAlign: 'start',
                    flexShrink: 0,
                    backgroundColor: t.white,
                    borderRadius: '20px',
                    border: `1px solid ${t.border}`,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '460px',
                    boxShadow: '0 2px 8px rgba(29,29,47,0.06)',
                  }}>
                    {/* Card header: artist + dismiss */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {note.artist && (
                          <span style={{
                            fontSize: '11px', fontWeight: '700', color: t.primary,
                            textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: font,
                          }}>{note.artist}</span>
                        )}
                        <span style={{ fontSize: '11px', color: t.textMuted, fontFamily: font }}>
                          @{note.anonId || 'anon'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDismissNote(note.id)}
                        style={{
                          width: '30px', height: '30px', borderRadius: '50%',
                          border: `1px solid ${t.border}`, backgroundColor: t.surface,
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '13px', color: t.textMuted,
                          flexShrink: 0,
                        }}
                      >✕</button>
                    </div>

                    {/* Main text — takes all available space */}
                    <p style={{
                      flex: 1,
                      fontSize: '16px', lineHeight: '1.65',
                      color: t.text, margin: 0,
                      fontFamily: font, fontWeight: '400',
                      overflowY: 'auto',
                    }}>
                      {note.description}
                    </p>

                    {/* Actions */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      paddingTop: '16px', marginTop: '16px',
                      borderTop: `1px solid ${t.border}`,
                    }}>
                      {/* Send request (lightning bolt) */}
                      <button
                        onClick={() => handleSendRequest(note)}
                        disabled={note.requested}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          backgroundColor: note.requested ? t.surface : t.primary,
                          border: 'none', borderRadius: '10px',
                          padding: '9px 16px', cursor: note.requested ? 'default' : 'pointer',
                          fontSize: '13px', fontWeight: '600',
                          color: note.requested ? t.textMuted : t.white,
                          fontFamily: font, transition: 'all 0.15s',
                        }}
                      >
                        ⚡ {note.requested ? 'Sent' : 'Connect'}
                      </button>

                      {/* Like */}
                      <button
                        onClick={() => handleLikePublic(note.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '13px', color: note.liked ? t.danger : t.textMuted,
                          fontFamily: font, padding: '9px 4px',
                        }}
                      >
                        {note.liked ? '❤️' : '🤍'} {note.likes || 0}
                      </button>
                    </div>
                  </div>
                ))}
                {/* Trailing spacer so last card isn't flush with edge */}
                <div style={{ minWidth: '4px', flexShrink: 0 }} />
              </div>
            )}
          </div>
        )}




        {/* ── TAB: PERFIL ── */}
        {tab === 'profile' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px', color: t.dark }}>Profile</h3>
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
                  { value: myNotes.filter(n => n.visibility === 'public').length, label: 'Posts' },
                  { value: confirmedMatches.length, label: 'Connections' },
                ].map(({ value, label }) => (
                  <div key={label} style={{ backgroundColor: t.surface, padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                    <p style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 2px', color: t.dark }}>{value}</p>
                    <p style={{ fontSize: '11px', color: t.textMuted, margin: 0 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Note creation wizard */}
      <CreateNoteFlow isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveNote} />

      {/* Bottom Navigation */}
      <div style={{
        backgroundColor: t.white,
        borderTop: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'flex-end',
        padding: '6px 8px 10px',
        position: 'sticky',
        bottom: 0,
        gap: '4px',
      }}>
        {/* Mis Notas */}
        {[
          { id: 'notes', label: 'My Searches', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          )},
          { id: 'public', label: 'Board', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l19-9-9 19-2-8-8-2z"/>
            </svg>
          )},
        ].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1,
            background: 'none', border: 'none', padding: '6px 0 2px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            cursor: 'pointer',
            color: tab === item.id ? t.primary : t.textMuted,
            fontFamily: font, fontSize: '10px',
            fontWeight: tab === item.id ? '600' : '400',
          }}>
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* Center: + button (raised) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              width: '52px', height: '52px',
              backgroundColor: t.primary,
              border: 'none', borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(247,96,46,0.40)',
              marginTop: '-20px',
              flexShrink: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span style={{ fontSize: '10px', color: t.textMuted, fontFamily: font }}>Create</span>
        </div>

        {/* Matches + Perfil */}
        {[
          { id: 'matches', label: 'Connections', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill={tab === 'matches' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          )},
          { id: 'profile', label: 'Profile', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          )},
        ].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1,
            background: 'none', border: 'none', padding: '6px 0 2px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            cursor: 'pointer',
            color: tab === item.id ? t.primary : t.textMuted,
            fontFamily: font, fontSize: '10px',
            fontWeight: tab === item.id ? '600' : '400',
          }}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Shared card + button styles ───────────────────────────────────────────

const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #EDE8DF',
  borderRadius: '14px',
  padding: '14px',
  boxShadow: '0 1px 3px rgba(29,29,47,0.05)',
};

const btnPrimary = {
  flex: 1, padding: '9px', border: 'none',
  backgroundColor: '#F7602E', borderRadius: '10px',
  cursor: 'pointer', fontSize: '13px', color: '#FFFFFF',
  fontWeight: '600', fontFamily: font,
};

const btnOutline = {
  flex: 1, padding: '9px',
  border: '1px solid #EDE8DF', backgroundColor: '#F7F5F2',
  borderRadius: '10px', cursor: 'pointer',
  fontSize: '13px', color: '#1D1D2F',
  fontWeight: '500', fontFamily: font,
};

const btnGhost = {
  flex: 1, padding: '9px',
  border: '1px solid #EDE8DF', backgroundColor: '#FFFFFF',
  borderRadius: '10px', cursor: 'pointer',
  fontSize: '13px', color: '#9E9A93',
  fontFamily: font,
};

const EmptyState = ({ text, sub }) => (
  <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9E9A93' }}>
    <p style={{ fontSize: '14px', margin: '0 0 4px', fontFamily: font }}>{text}</p>
    {sub && <p style={{ fontSize: '12px', margin: 0, fontFamily: font }}>{sub}</p>}
  </div>
);

export default PrimaveraApp;
