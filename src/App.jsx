import React, { useState, useEffect } from 'react';
import CreateNoteModal from './CreateNoteModal';
import { findMatches, calculateMatchScore } from './matchingAlgorithm';

// Supabase config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'YOUR_SUPABASE_KEY';

// Simple Supabase client
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

    const options = {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    };

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

  async getUser(email) {
    return this.request('users', 'GET', null, `email=eq.${email}`);
  },

  async createUser(email) {
    return this.request('users', 'POST', { email });
  },

  async createNote(userId, note) {
    return this.request('notes', 'POST', { user_id: userId, ...note });
  },

  async getNotes(userId) {
    return this.request('notes', 'GET', null, `user_id=eq.${userId}`);
  },

  async getAllNotes() {
    return this.request('notes', 'GET');
  },

  async createMatch(match) {
    return this.request('matches', 'POST', match);
  },

  async getMatches(userId) {
    return this.request('matches', 'GET', null, `or=(user_1_id.eq.${userId},user_2_id.eq.${userId})`);
  },

  async getMatchByNotes(note1Id, note2Id) {
    const r1 = await this.request('matches', 'GET', null, `note_1_id=eq.${note1Id}&note_2_id=eq.${note2Id}`);
    if (r1 && r1.length > 0) return r1;
    const r2 = await this.request('matches', 'GET', null, `note_1_id=eq.${note2Id}&note_2_id=eq.${note1Id}`);
    return r2;
  },

  async updateMatch(matchId, data) {
    return this.request('matches', 'PATCH', data, `id=eq.${matchId}`);
  }
};

const toSnakeCase = (note) => ({
  description: note.description,
  artist: note.artist,
  time: note.time,
  location: note.location,
  other_person_desc: note.otherPersonDesc,
  own_desc: note.ownDesc,
  companions: note.companions,
  instagram: note.instagram,
  visibility: note.visibility,
  user_id: note.user_id
});

const toCamelCase = (note) => ({
  ...note,
  otherPersonDesc: note.other_person_desc,
  ownDesc: note.own_desc
});

const PrimaveraApp = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState('notes');
  const [email, setEmail] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [myNotes, setMyNotes] = useState([]);
  const [publicNotes, setPublicNotes] = useState([]);
  const [suggestedMatches, setSuggestedMatches] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);

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

        // Load existing match records
        const ourNoteId = camelNotes.find(n => n.visibility === 'private')?.id;
        const existingMatches = await supabase.getMatches(uid);
        if (existingMatches && existingMatches.length > 0) {
          // Mark already-responded suggestions
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

          // Populate history with confirmed matches
          const confirmed = existingMatches.filter(r => r.revealed);
          if (confirmed.length > 0) {
            const allNotes = await supabase.getAllNotes();
            const camelAll = allNotes ? allNotes.map(toCamelCase) : [];
            setMatchHistory(confirmed.map(r => {
              const isUser1 = r.user_1_id === uid;
              const otherNoteId = isUser1 ? r.note_2_id : r.note_1_id;
              const otherNote = camelAll.find(n => n.id === otherNoteId);
              return {
                id: r.id,
                matchedNoteId: otherNoteId,
                matchedWithUser: otherNote?.otherPersonDesc || 'Unknown',
                otherInstagram: otherNote?.instagram || null,
                score: r.score,
                quality: r.quality,
                status: 'bilateral',
                timestamp: r.created_at,
                revealed: true
              };
            }));
          }
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
    setPublicNotes(prev =>
      prev.map(n => n.id === note.id ? { ...n, requested: true } : n)
    );
  };

  const handleLikePublic = (noteId) => {
    setPublicNotes(prev =>
      prev.map(n =>
        n.id === noteId
          ? { ...n, liked: !n.liked, likes: (n.likes || 0) + (n.liked ? -1 : 1) }
          : n
      )
    );
  };

  const handleMatchResponse = async (matchId, response) => {
    const match = suggestedMatches.find(m => m.id === matchId);
    const ourNoteId = myNotes.find(n => n.visibility === 'private')?.id;

    setSuggestedMatches(prev =>
      prev.map(m => m.id === matchId ? { ...m, userResponse: response } : m)
    );

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
          note_1_id: ourNoteId,
          note_2_id: matchId,
          user_1_id: userId,
          user_2_id: match.user_id,
          score: match.score,
          quality: match.quality,
          user_1_response: 'yes'
        });
      }

      setMatchHistory(prev => [...prev, {
        id: 'match_' + matchId + '_' + Date.now(),
        matchedNoteId: matchId,
        matchedWithUser: match.otherPersonDesc,
        otherInstagram: revealed ? match.instagram : null,
        score: match.score,
        quality: match.quality,
        status: revealed ? 'bilateral' : 'pending',
        timestamp: new Date(),
        revealed
      }]);
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: '380px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
            Primavera Sound 🎵
          </h1>
          <p style={{ fontSize: '14px', color: '#999', margin: '0' }}>
            Encuentra esos ojos que no olvidaste
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="tu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            style={{ height: '44px', padding: '0 12px', borderRadius: '8px', border: '0.5px solid #ccc', fontSize: '14px' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ height: '44px', cursor: 'pointer', borderRadius: '8px', border: '0.5px solid #ccc', backgroundColor: '#f0f0f0', fontSize: '14px', fontWeight: '500', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '13px', color: '#999', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: '#333' }}>¿Cómo funciona?</p>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Escribe notas privadas sobre encuentros concretos</li>
            <li>El sistema busca matches automáticamente</li>
            <li>Cuando hay match mutuo: se revelan Instagram/WhatsApp</li>
            <li>O comparte historias públicas para que la comunidad chismee</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '380px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '0.5px solid #e0e0e0', padding: '1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '500', margin: '0', color: '#333' }}>
            Primavera Sound
          </h2>
          <button
            onClick={() => { setUser(null); setUserId(null); setSuggestedMatches([]); setMatchHistory([]); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '12px' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>

        {/* TAB 1: MIS NOTAS */}
        {tab === 'notes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', margin: '0', color: '#333' }}>Mis notas</h3>
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
                style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.5 : 1 }}
              >
                + Escribir
              </button>
            </div>

            {myNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#999' }}>
                <p style={{ fontSize: '14px', margin: '0' }}>Sin notas aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myNotes.map(note => (
                  <div key={note.id} style={{ backgroundColor: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '500', backgroundColor: '#e3f2fd', color: '#1976d2', padding: '3px 8px', borderRadius: '8px', marginRight: '6px' }}>
                        {note.visibility === 'private' ? 'Privada' : 'Pública'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#999' }}>{note.artist}</span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#333', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                      {note.description.substring(0, 100)}...
                    </p>

                    {note.instagram && (
                      <div style={{ fontSize: '12px', color: '#1976d2', marginBottom: '8px', backgroundColor: '#f0f7ff', padding: '6px 8px', borderRadius: '6px' }}>
                        📱 {note.instagram}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MATCHES */}
        {tab === 'matches' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 1.5rem 0', color: '#333' }}>Matches sugeridos</h3>

            {suggestedMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#999' }}>
                <p style={{ fontSize: '14px', margin: '0' }}>No hay matches aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suggestedMatches.map(match => (
                  <div key={match.id} style={{ backgroundColor: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '500', backgroundColor: match.score >= 70 ? '#e8f5e9' : '#e3f2fd', color: match.score >= 70 ? '#388e3c' : '#1976d2', padding: '3px 8px', borderRadius: '8px' }}>
                        {match.quality} • {match.score}%
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#333', margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      {match.description}
                    </p>

                    {match.userResponse === 'yes' && (
                      <div style={{ backgroundColor: '#e8f5e9', border: '0.5px solid #a5d6a7', borderRadius: '8px', padding: '10px', marginBottom: '12px', fontSize: '13px', color: '#1b5e20' }}>
                        <p style={{ margin: '0 0 6px 0', fontWeight: '500' }}>✅ ¡MATCH CONFIRMADO!</p>
                        <p style={{ margin: '0 0 6px 0' }}>Instagram: <strong>@otheruser123</strong></p>
                      </div>
                    )}

                    {match.userResponse === null ? (
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                        <button onClick={() => handleMatchResponse(match.id, 'no')} style={{ flex: 1, padding: '8px', border: '0.5px solid #e0e0e0', backgroundColor: '#fff', borderRadius: '8px', cursor: 'pointer', color: '#999' }}>No</button>
                        <button onClick={() => handleMatchResponse(match.id, 'maybe')} style={{ flex: 1, padding: '8px', border: '0.5px solid #ddd', backgroundColor: '#f5f5f5', borderRadius: '8px', cursor: 'pointer', color: '#333' }}>Puede ser</button>
                        <button onClick={() => handleMatchResponse(match.id, 'yes')} style={{ flex: 1, padding: '8px', border: '0.5px solid #1976d2', backgroundColor: '#e3f2fd', borderRadius: '8px', cursor: 'pointer', color: '#1976d2', fontWeight: '500' }}>Sí</button>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: '8px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                        Respondiste: {match.userResponse === 'yes' ? '✓ Sí' : match.userResponse === 'maybe' ? '~ Puede ser' : '✗ No'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PÚBLICO */}
        {tab === 'public' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 1.5rem 0', color: '#333' }}>Historias públicas</h3>

            {publicNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#999' }}>
                <p style={{ fontSize: '14px', margin: '0' }}>Sin historias aún</p>
                <p style={{ fontSize: '12px', margin: '8px 0 0 0' }}>Sé el primero en compartir</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {publicNotes.map(note => (
                  <div key={note.id} style={{ backgroundColor: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#999' }}>@{note.anonId || 'anon'}</span>
                      <span style={{ fontSize: '11px', color: '#999' }}>{note.artist}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#333', margin: '0 0 12px 0', lineHeight: '1.6' }}>
                      {note.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#999' }}>
                      <button
                        onClick={() => handleLikePublic(note.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: note.liked ? '#1976d2' : '#999', padding: '0' }}
                      >
                        {note.liked ? '❤️' : '🤍'} {note.likes || 0}
                      </button>
                      <button
                        onClick={() => handleSendRequest(note)}
                        style={{ background: 'none', border: note.requested ? 'none' : '0.5px solid #1976d2', borderRadius: '6px', padding: note.requested ? '0' : '4px 8px', cursor: note.requested ? 'default' : 'pointer', color: note.requested ? '#999' : '#1976d2', fontSize: '12px' }}
                      >
                        {note.requested ? '✓ Solicitud enviada' : 'Send request'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HISTORIAL */}
        {tab === 'history' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 1.5rem 0', color: '#333' }}>Historial de matches</h3>

            {matchHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: '#999' }}>
                <p style={{ fontSize: '14px', margin: '0' }}>Sin matches confirmados aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {matchHistory.map(entry => (
                  <div key={entry.id} style={{ backgroundColor: '#fff', border: '0.5px solid #a5d6a7', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '500', backgroundColor: '#e8f5e9', color: '#388e3c', padding: '3px 8px', borderRadius: '8px' }}>
                        ✅ Match confirmado
                      </span>
                      <span style={{ fontSize: '11px', color: '#999' }}>{entry.quality}</span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#333', margin: '0 0 12px 0' }}>{entry.matchedWithUser}</p>

                    {entry.revealed && (
                      <div style={{ backgroundColor: '#f0f7ff', border: '0.5px solid #b3d9ff', borderRadius: '8px', padding: '10px', marginBottom: '12px', fontSize: '12px', color: '#1976d2' }}>
                        <p style={{ margin: '0 0 6px 0', fontWeight: '500' }}>📱 Instagram del otro:</p>
                        <p style={{ margin: '0', fontSize: '13px', fontWeight: '500' }}>{entry.otherInstagram}</p>
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: '#999' }}>
                      Score: {entry.score}% • {new Date(entry.timestamp).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PERFIL */}
        {tab === 'profile' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 1.5rem 0', color: '#333' }}>Mi perfil</h3>

            <div style={{ backgroundColor: '#fff', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '500', color: '#1976d2' }}>
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', margin: '0', color: '#333' }}>{user.email}</p>
                  <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0 0' }}>Plan: Free</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: '500', margin: '0', color: '#333' }}>{myNotes.length}</p>
                  <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>Notas</p>
                </div>
                <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: '500', margin: '0', color: '#333' }}>{suggestedMatches.length}</p>
                  <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>Sugeridos</p>
                </div>
                <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: '500', margin: '0', color: '#333' }}>{matchHistory.length}</p>
                  <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>Confirmados</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <CreateNoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveNote}
      />

      {/* Bottom Navigation */}
      <div style={{ backgroundColor: '#fff', borderTop: '0.5px solid #e0e0e0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '0.5rem 0', position: 'sticky', bottom: 0 }}>
        {[
          { id: 'notes', label: 'Notas', emoji: '📝' },
          { id: 'matches', label: 'Matches', emoji: '❤️' },
          { id: 'public', label: 'Público', emoji: '🌍' },
          { id: 'history', label: 'Historial', emoji: '📊' },
          { id: 'profile', label: 'Perfil', emoji: '👤' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{ background: 'none', border: 'none', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', color: tab === item.id ? '#1976d2' : '#999', fontSize: '10px', fontWeight: tab === item.id ? '500' : '400', borderTop: tab === item.id ? '2px solid #1976d2' : 'none' }}
          >
            <span style={{ fontSize: '16px' }}>{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PrimaveraApp;
