import React, { useState } from 'react';
import { radius } from './radius';

const CreateNoteModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    description: '',
    artist: '',
    time: '',
    location: '',
    otherPersonDesc: '',
    ownDesc: '',
    companions: '',
    instagram: '',
    visibility: 'private'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      alert('La descripción es obligatoria');
      return;
    }
    onSave(formData);
    setFormData({
      description: '',
      artist: '',
      time: '',
      location: '',
      otherPersonDesc: '',
      ownDesc: '',
      companions: '',
      instagram: '',
      visibility: 'private'
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 1000
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        backgroundColor: '#fff',
        borderRadius: `${radius.lg} ${radius.lg} 0 0`,
        padding: '1.5rem',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0', color: '#333' }}>Nueva nota</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Descripción * (obligatorio)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Cuéntanos qué pasó, dónde, con quién..."
              style={{ width: '100%', minHeight: '100px', padding: '12px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Artista / Escenario
            </label>
            <input
              type="text"
              name="artist"
              value={formData.artist}
              onChange={handleChange}
              placeholder="ej: Rosalía, Main Stage, etc."
              style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Hora aproximada
            </label>
            <input
              type="text"
              name="time"
              value={formData.time}
              onChange={handleChange}
              placeholder="ej: viernes 21:30, sábado tarde, etc."
              style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Lugar específico
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="ej: barra, mosh pit, zona VIP, etc."
              style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Descripción física (de la otra persona)
            </label>
            <input
              type="text"
              name="otherPersonDesc"
              value={formData.otherPersonDesc}
              onChange={handleChange}
              placeholder="ej: chica, pelo rojo, vestido negro, tatuaje..."
              style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Descripción propia
            </label>
            <input
              type="text"
              name="ownDesc"
              value={formData.ownDesc}
              onChange={handleChange}
              placeholder="ej: chico, camiseta blanca, gafas, tatuaje..."
              style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Acompañantes
            </label>
            <input
              type="text"
              name="companions"
              value={formData.companions}
              onChange={handleChange}
              placeholder="ej: estaba solo, con dos amigas, con pareja..."
              style={{ width: '100%', padding: '10px', border: '0.5px solid #ddd', borderRadius: radius.sm, fontSize: '14px' }}
            />
          </div>

          <div style={{ backgroundColor: '#f0f7ff', padding: '12px', borderRadius: radius.sm, border: '0.5px solid #b3d9ff' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#1976d2', display: 'block', marginBottom: '6px' }}>
              📱 Mi Instagram (opcional pero recomendado)
            </label>
            <input
              type="text"
              name="instagram"
              value={formData.instagram}
              onChange={handleChange}
              placeholder="ej: @tusername (sin arroba también vale)"
              style={{ width: '100%', padding: '10px', border: '0.5px solid #b3d9ff', borderRadius: radius.sm, fontSize: '14px', backgroundColor: '#fff' }}
            />
            <p style={{ fontSize: '11px', color: '#1976d2', margin: '6px 0 0 0' }}>
              💡 Solo se revela si hay match mutuo
            </p>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
              Tipo de nota
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" name="visibility" value="private" checked={formData.visibility === 'private'} onChange={handleChange} />
                🔒 Privada (solo aparece si hay match)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" name="visibility" value="public" checked={formData.visibility === 'public'} onChange={handleChange} />
                🌍 Pública (todos pueden verla)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', border: '0.5px solid #ddd', borderRadius: radius.sm, backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: radius.sm, backgroundColor: '#1976d2', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
            >
              Publicar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNoteModal;
