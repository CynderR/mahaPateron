import React, { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import {
  buildDescription,
  parseMp3Metadata,
  pictureToCoverFile
} from '../utils/parseMp3Metadata';

interface UploadFormProps {
  onUploaded: () => void;
}

const UploadForm: React.FC<UploadFormProps> = ({ onUploaded }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [notes, setNotes] = useState('');
  const [audio, setAudio] = useState<File | null>(null);
  const [audioName, setAudioName] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleImage = (file: File | null) => {
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : '');
  };

  const reset = () => {
    setTitle('');
    setArtist('');
    setAlbum('');
    setYear('');
    setGenre('');
    setNotes('');
    setAudio(null);
    setAudioName('');
    setImage(null);
    setImagePreview('');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const applyMp3File = useCallback(async (file: File) => {
    setError('');
    if (file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) {
      setError('Please drop an MP3 file.');
      return;
    }

    setParsing(true);
    setAudio(file);
    setAudioName(file.name);

    try {
      const metadata = await parseMp3Metadata(file);
      setTitle(metadata.title);
      setArtist(metadata.artist);
      setAlbum(metadata.album);
      setYear(metadata.year);
      setGenre(metadata.genre);

      if (metadata.picture) {
        const coverFile = pictureToCoverFile(metadata.picture);
        setImage(coverFile);
        setImagePreview(URL.createObjectURL(coverFile));
      } else {
        setImage(null);
        setImagePreview('');
        if (coverInputRef.current) coverInputRef.current.value = '';
      }
    } catch {
      setError('Could not read tags from this MP3. You can still fill in the fields manually.');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) applyMp3File(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !audio) {
      setError('A title and an MP3 file are required.');
      return;
    }

    const description = buildDescription(artist, album, year, genre, notes);
    const form = new FormData();
    form.append('title', title.trim());
    form.append('description', description);
    form.append('audio', audio);
    if (image) form.append('image', image);

    setUploading(true);
    try {
      await axios.post('/admin/posts', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });
      reset();
      onUploaded();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="pod-card" onSubmit={handleSubmit}>
      <h3 style={{ marginTop: 0 }}>New Episode</h3>
      {error && <div className="pod-banner pod-banner-error">{error}</div>}

      <div className="pod-form-group">
        <label>Audio (MP3)</label>
        <div
          className={`pod-dropzone${dragActive ? ' pod-dropzone-active' : ''}${audioName ? ' pod-dropzone-filled' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          {parsing ? (
            <span>Reading tags…</span>
          ) : audioName ? (
            <>
              <strong>{audioName}</strong>
              <span className="pod-dropzone-hint">Drop another MP3 to replace, or click to browse</span>
            </>
          ) : (
            <>
              <span>Drop an MP3 here</span>
              <span className="pod-dropzone-hint">Title, cover, and tags will be filled in automatically</span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,.mp3"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) applyMp3File(file);
          }}
        />
      </div>

      <div className="pod-form-group">
        <label htmlFor="post-title">Title</label>
        <input
          id="post-title"
          className="pod-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="pod-form-grid">
        <div className="pod-form-group">
          <label htmlFor="post-artist">Artist</label>
          <input
            id="post-artist"
            className="pod-input"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
        <div className="pod-form-group">
          <label htmlFor="post-album">Album</label>
          <input
            id="post-album"
            className="pod-input"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
          />
        </div>
        <div className="pod-form-group">
          <label htmlFor="post-year">Year</label>
          <input
            id="post-year"
            className="pod-input"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className="pod-form-group">
          <label htmlFor="post-genre">Genre</label>
          <input
            id="post-genre"
            className="pod-input"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
        </div>
      </div>

      <div className="pod-form-group">
        <label htmlFor="post-notes">Notes (optional)</label>
        <textarea
          id="post-notes"
          className="pod-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Episode notes shown below the metadata"
        />
      </div>

      <div className="pod-form-group">
        <label>Cover image</label>
        {imagePreview ? (
          <img className="pod-image-preview" src={imagePreview} alt="Cover preview" />
        ) : (
          <p className="pod-dropzone-hint" style={{ margin: '0 0 0.5rem' }}>
            Embedded cover art will appear here when available.
          </p>
        )}
        <button
          type="button"
          className="pod-btn pod-btn-secondary"
          onClick={() => coverInputRef.current?.click()}
        >
          {imagePreview ? 'Replace cover' : 'Choose cover image'}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => handleImage(e.target.files ? e.target.files[0] : null)}
        />
      </div>

      {uploading && progress > 0 && (
        <div className="pod-banner pod-banner-info">Uploading… {progress}%</div>
      )}

      <button type="submit" className="pod-btn" disabled={uploading || parsing}>
        {uploading ? 'Uploading…' : 'Publish episode'}
      </button>
    </form>
  );
};

export default UploadForm;
