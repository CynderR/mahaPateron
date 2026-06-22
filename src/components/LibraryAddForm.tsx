import React, { useState } from 'react';
import axios from 'axios';
import {
  buildDescription,
  parseMp3Metadata,
  pictureToCoverFile,
  publishedAtFromFilename
} from '../utils/parseMp3Metadata';

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
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [notes, setNotes] = useState('');
  const [publishedAt, setPublishedAt] = useState(toDatetimeLocal(new Date()));
  const [isPublished, setIsPublished] = useState(true);
  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setArtist('');
    setAlbum('');
    setYear('');
    setGenre('');
    setNotes('');
    setPublishedAt(toDatetimeLocal(new Date()));
    setIsPublished(true);
    setAudio(null);
    setImage(null);
  };

  const handleAudioChange = async (file: File | null) => {
    setAudio(file);
    if (!file) return;

    setParsing(true);
    setError('');
    try {
      const metadata = await parseMp3Metadata(file);
      if (metadata.title) setTitle(metadata.title);
      setArtist(metadata.artist);
      setAlbum(metadata.album);
      setYear(metadata.year);
      setGenre(metadata.genre);
      setDescription(buildDescription(metadata.artist, metadata.album, metadata.year, metadata.genre, notes));

      const filenameDate = publishedAtFromFilename(file.name);
      if (filenameDate) {
        setPublishedAt(toDatetimeLocal(new Date(filenameDate)));
      }

      if (metadata.picture && !image) {
        setImage(pictureToCoverFile(metadata.picture));
      }
    } catch (e) {
      setError('Could not read MP3 tags from this file.');
    } finally {
      setParsing(false);
    }
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setDescription(buildDescription(artist, album, year, genre, value));
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
    form.append('description', buildDescription(artist, album, year, genre, notes));
    form.append('artist', artist.trim());
    form.append('album', album.trim());
    form.append('year', year.trim());
    form.append('genre', genre.trim());
    form.append('notes', notes.trim());
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
        Upload an MP3 to auto-fill tags from the file. Set the publish date to backdate older posts.
      </p>

      {error && <div className="pod-banner pod-banner-error">{error}</div>}

      <div className="pod-form-group">
        <label htmlFor="library-audio">Audio (MP3)</label>
        <input
          id="library-audio"
          className="pod-input"
          type="file"
          accept="audio/mpeg,.mp3"
          onChange={(e) => handleAudioChange(e.target.files?.[0] || null)}
          required
        />
        {parsing && <p style={{ margin: '0.35rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Reading MP3 tags…</p>}
      </div>

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

      <div className="pod-form-grid">
        <div className="pod-form-group">
          <label htmlFor="library-artist">Artist</label>
          <input
            id="library-artist"
            className="pod-input"
            value={artist}
            onChange={(e) => {
              setArtist(e.target.value);
              setDescription(buildDescription(e.target.value, album, year, genre, notes));
            }}
          />
        </div>
        <div className="pod-form-group">
          <label htmlFor="library-album">Album</label>
          <input
            id="library-album"
            className="pod-input"
            value={album}
            onChange={(e) => {
              setAlbum(e.target.value);
              setDescription(buildDescription(artist, e.target.value, year, genre, notes));
            }}
          />
        </div>
        <div className="pod-form-group">
          <label htmlFor="library-year">Year</label>
          <input
            id="library-year"
            className="pod-input"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setDescription(buildDescription(artist, album, e.target.value, genre, notes));
            }}
          />
        </div>
        <div className="pod-form-group">
          <label htmlFor="library-genre">Genre</label>
          <input
            id="library-genre"
            className="pod-input"
            value={genre}
            onChange={(e) => {
              setGenre(e.target.value);
              setDescription(buildDescription(artist, album, year, e.target.value, notes));
            }}
          />
        </div>
      </div>

      <div className="pod-form-group">
        <label htmlFor="library-notes">Notes</label>
        <textarea
          id="library-notes"
          className="pod-textarea"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Episode notes shown below the metadata"
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
        <label htmlFor="library-image">Cover image (optional)</label>
        <input
          id="library-image"
          className="pod-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
        />
      </div>

      <button type="submit" className="pod-btn" disabled={submitting || parsing}>
        {submitting ? 'Adding…' : 'Add to library'}
      </button>
    </form>
  );
};

export default LibraryAddForm;
