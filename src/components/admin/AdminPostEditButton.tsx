import React, { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import { buildImageUrl } from '../../config';
import { buildDescription } from '../../utils/parseMp3Metadata';
import { AdminPostDetail, editableFieldsFromPost } from '../../utils/adminPostHelpers';

interface AdminPostEditButtonProps {
  postId: string;
  postTitle: string;
  onSaved?: () => void;
}

const AdminPostEditButton: React.FC<AdminPostEditButtonProps> = ({ postId, postTitle, onSaved }) => {
  const dialogTitleId = useId();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string>('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [notes, setNotes] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [currentImageFilename, setCurrentImageFilename] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const clearLocalPreview = () => {
    if (previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = '';
  };

  const setLocalPreview = (file: File | null) => {
    clearLocalPreview();
    if (!file) {
      setImageFile(null);
      setImagePreview(currentImageFilename ? buildImageUrl(currentImageFilename) : '');
      return;
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setImageFile(file);
    setImagePreview(url);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, saving]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setImageFile(null);
    clearLocalPreview();
    if (coverInputRef.current) coverInputRef.current.value = '';

    axios
      .get<{ post: AdminPostDetail }>(`/admin/posts/${encodeURIComponent(postId)}`)
      .then((res) => {
        if (cancelled) return;
        const fields = editableFieldsFromPost(res.data.post);
        setTitle(fields.title);
        setArtist(fields.artist);
        setAlbum(fields.album);
        setYear(fields.year);
        setGenre(fields.genre);
        setNotes(fields.notes);
        setIsPublished(fields.isPublished);
        const filename = res.data.post.image_filename || null;
        setCurrentImageFilename(filename);
        setImagePreview(filename ? buildImageUrl(filename) : '');
      })
      .catch(() => {
        if (!cancelled) setError('Could not load episode metadata.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  useEffect(() => {
    if (open) return;
    clearLocalPreview();
    setImageFile(null);
    setImagePreview('');
    setCurrentImageFilename(null);
  }, [open]);

  useEffect(
    () => () => {
      clearLocalPreview();
    },
    []
  );

  const handleOpen = () => {
    setError('');
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;
    setOpen(false);
  };

  const handleImageChange = (file: File | null) => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError('Cover image must be JPEG, PNG, or WebP.');
      if (coverInputRef.current) coverInputRef.current.value = '';
      return;
    }
    setError('');
    setLocalPreview(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    const description = buildDescription(artist, album, year, genre, notes);
    const form = new FormData();
    form.append('title', trimmedTitle);
    form.append('description', description);
    form.append('artist', artist.trim());
    form.append('album', album.trim());
    form.append('year', year.trim());
    form.append('genre', genre.trim());
    form.append('notes', notes);
    form.append('is_published', String(isPublished));
    if (imageFile) form.append('image', imageFile);

    setSaving(true);
    try {
      await axios.put(`/admin/posts/${encodeURIComponent(postId)}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setOpen(false);
      onSaved?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="pod-btn pod-btn-secondary pod-btn-sm"
        onClick={handleOpen}
        aria-haspopup="dialog"
      >
        Edit
      </button>
      {open && (
        <div className="admin-post-edit-overlay" onClick={handleClose}>
          <div
            className="admin-post-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-post-edit-header">
              <h3 id={dialogTitleId} className="admin-post-edit-title">
                Edit metadata
              </h3>
              <button
                type="button"
                className="admin-post-edit-close"
                onClick={handleClose}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {error && <div className="pod-banner pod-banner-error">{error}</div>}

            {loading ? (
              <p className="admin-post-edit-loading">Loading…</p>
            ) : (
              <form className="admin-post-edit-form" onSubmit={handleSubmit}>
                <p className="admin-post-edit-subtitle">{postTitle}</p>

                <div className="pod-form-group">
                  <label htmlFor={`${dialogTitleId}-title`}>Title</label>
                  <input
                    id={`${dialogTitleId}-title`}
                    className="pod-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="pod-form-grid">
                  <div className="pod-form-group">
                    <label htmlFor={`${dialogTitleId}-artist`}>Artist</label>
                    <input
                      id={`${dialogTitleId}-artist`}
                      className="pod-input"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                    />
                  </div>
                  <div className="pod-form-group">
                    <label htmlFor={`${dialogTitleId}-album`}>Album</label>
                    <input
                      id={`${dialogTitleId}-album`}
                      className="pod-input"
                      value={album}
                      onChange={(e) => setAlbum(e.target.value)}
                    />
                  </div>
                  <div className="pod-form-group">
                    <label htmlFor={`${dialogTitleId}-year`}>Year</label>
                    <input
                      id={`${dialogTitleId}-year`}
                      className="pod-input"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    />
                  </div>
                  <div className="pod-form-group">
                    <label htmlFor={`${dialogTitleId}-genre`}>Genre</label>
                    <input
                      id={`${dialogTitleId}-genre`}
                      className="pod-input"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pod-form-group">
                  <label htmlFor={`${dialogTitleId}-notes`}>Notes</label>
                  <textarea
                    id={`${dialogTitleId}-notes`}
                    className="pod-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Episode notes shown below the metadata"
                  />
                </div>

                <div className="pod-form-group admin-post-edit-cover">
                  <label>Cover image</label>
                  {imagePreview ? (
                    <img className="pod-image-preview" src={imagePreview} alt="Cover preview" />
                  ) : (
                    <p className="pod-dropzone-hint" style={{ margin: '0 0 0.5rem' }}>
                      No cover image yet. Choose one to add it.
                    </p>
                  )}
                  <div className="admin-post-edit-cover-actions">
                    <button
                      type="button"
                      className="pod-btn pod-btn-secondary"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={saving}
                    >
                      {imagePreview ? 'Change cover' : 'Add cover image'}
                    </button>
                    {imageFile && (
                      <button
                        type="button"
                        className="pod-btn pod-btn-secondary"
                        onClick={() => {
                          if (coverInputRef.current) coverInputRef.current.value = '';
                          setLocalPreview(null);
                        }}
                        disabled={saving}
                      >
                        Undo new cover
                      </button>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    id={`${dialogTitleId}-cover`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => handleImageChange(e.target.files ? e.target.files[0] : null)}
                  />
                </div>

                <label className="admin-post-edit-published">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                  />
                  Published
                </label>

                <div className="admin-post-edit-actions">
                  <button type="button" className="pod-btn pod-btn-secondary" onClick={handleClose} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="pod-btn" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPostEditButton;
