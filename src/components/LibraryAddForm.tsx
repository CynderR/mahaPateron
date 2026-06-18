import React, { useState } from 'react';
import axios from 'axios';

interface LibraryAddFormProps {
  onAdded: () => void;
}

const toDatetimeLocal = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const LibraryAddForm: React.FC<LibraryAddFormProps> = ({ onAdded }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishedAt, setPublishedAt] = useState(toDatetimeLocal(new Date()));
  const [isPublished, setIsPublished] = useState(true);
  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setPublishedAt(toDatetimeLocal(new Date()));
    setIsPublished(true);
    setAudio(null);
    setImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!audio) {
      setError('An MP3 file is required.');
      return;
    }

    const form = new FormData();
    form.append('title', title.trim());
    form.append('description', description.trim());
    form.append('published_at', new Date(publishedAt).toISOString());
    form.append('is_published', String(isPublished));
    form.append('audio', audio);
    if (image) form.append('image', image);

    setSubmitting(true);
    try {
      await axios.post('/admin/library', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      reset();
      onAdded();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not add library entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="pod-card" onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>Add to Library</h3>
      <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
        Manually add a new or archived episode. Set the publish date to backdate older posts.
      </p>

      {error && <div className="pod-banner pod-banner-error">{error}</div>}

      <div className="pod-form-group">
        <label htmlFor="library-title">Title</label>
        <input
          id="library-title"
          className="pod-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="pod-form-group">
        <label htmlFor="library-description">Description</label>
        <textarea
          id="library-description"
          className="pod-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Episode description or notes"
        />
      </div>

      <div className="pod-form-grid">
        <div className="pod-form-group">
          <label htmlFor="library-published-at">Published date</label>
          <input
            id="library-published-at"
            className="pod-input"
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </div>
        <div className="pod-form-group" style={{ alignSelf: 'end' }}>
          <label>
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} /> Publish immediately
          </label>
        </div>
      </div>

      <div className="pod-form-group">
        <label htmlFor="library-audio">Audio (MP3)</label>
        <input
          id="library-audio"
          className="pod-input"
          type="file"
          accept="audio/mpeg,.mp3"
          onChange={(e) => setAudio(e.target.files?.[0] || null)}
          required
        />
      </div>

      <div className="pod-form-group">
        <label htmlFor="library-image">Cover image (optional)</label>
        <input
          id="library-image"
          className="pod-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
        />
      </div>

      <button type="submit" className="pod-btn" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add to library'}
      </button>
    </form>
  );
};

export default LibraryAddForm;
