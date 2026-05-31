import React, { useState } from 'react';
import axios from 'axios';

interface UploadFormProps {
  onUploaded: () => void;
}

const UploadForm: React.FC<UploadFormProps> = ({ onUploaded }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleImage = (file: File | null) => {
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : '');
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setAudio(null);
    setImage(null);
    setImagePreview('');
    setProgress(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title || !audio) {
      setError('A title and an MP3 file are required.');
      return;
    }

    const form = new FormData();
    form.append('title', title);
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
        <label htmlFor="post-title">Title</label>
        <input id="post-title" className="pod-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="pod-form-group">
        <label htmlFor="post-desc">Description</label>
        <textarea
          id="post-desc"
          className="pod-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="pod-form-group">
        <label htmlFor="post-image">Cover image (JPG, PNG, WebP)</label>
        <input
          id="post-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleImage(e.target.files ? e.target.files[0] : null)}
        />
        {imagePreview && <img className="pod-image-preview" src={imagePreview} alt="Cover preview" />}
      </div>

      <div className="pod-form-group">
        <label htmlFor="post-audio">Audio (MP3)</label>
        <input
          id="post-audio"
          type="file"
          accept="audio/mpeg"
          onChange={(e) => setAudio(e.target.files ? e.target.files[0] : null)}
        />
      </div>

      {uploading && progress > 0 && (
        <div className="pod-banner pod-banner-info">Uploading… {progress}%</div>
      )}

      <button type="submit" className="pod-btn" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Publish episode'}
      </button>
    </form>
  );
};

export default UploadForm;
