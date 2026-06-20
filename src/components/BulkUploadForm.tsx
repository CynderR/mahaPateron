import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  buildDescription,
  filterMp3Files,
  parseMp3Metadata,
  pictureToCoverFile,
  publishedAtFromFilename,
  titleFromFilename
} from '../utils/parseMp3Metadata';

type ItemStatus = 'pending' | 'uploading' | 'done' | 'skipped' | 'error';

export interface BulkQueueItem {
  key: string;
  file: File;
  title: string;
  description: string;
  publishedAt: string;
  coverFile: File | null;
  hasCover: boolean;
  status: ItemStatus;
  error?: string;
}

type Phase = 'idle' | 'scanning' | 'uploading' | 'paused' | 'done';

interface BulkUploadFormProps {
  onComplete?: () => void;
}

const BulkUploadForm: React.FC<BulkUploadFormProps> = ({ onComplete }) => {
  const [items, setItems] = useState<BulkQueueItem[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [error, setError] = useState('');
  const [existingTitles, setExistingTitles] = useState<Set<string>>(new Set());

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  useEffect(() => {
    axios
      .get<{ posts: { title: string }[] }>('/admin/posts')
      .then((res) => {
        setExistingTitles(new Set(res.data.posts.map((p) => p.title.trim().toLowerCase())));
      })
      .catch(() => {});
  }, []);

  const updateItem = useCallback((key: string, patch: Partial<BulkQueueItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const buildQueueItem = async (file: File): Promise<BulkQueueItem> => {
    const filenameTitle = titleFromFilename(file.name);
    let title = filenameTitle;
    let description = '';
    let coverFile: File | null = null;
    let hasCover = false;

    try {
      const metadata = await parseMp3Metadata(file);
      title = metadata.title.trim() || filenameTitle;
      description = buildDescription(metadata.artist, metadata.album, metadata.year, metadata.genre, '');
      if (metadata.picture) {
        coverFile = pictureToCoverFile(metadata.picture);
        hasCover = true;
      }
    } catch {
      description = buildDescription('', '', '', '', '');
    }

    const publishedAt =
      publishedAtFromFilename(file.name) ||
      (() => {
        const yearMatch = filenameTitle.match(/^(\d{4})/);
        if (yearMatch) {
          const d = new Date(`${yearMatch[1]}-01-01T12:00:00`);
          if (!Number.isNaN(d.getTime())) return d.toISOString();
        }
        return new Date().toISOString();
      })();

    return {
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      title,
      description,
      publishedAt,
      coverFile,
      hasCover,
      status: 'pending'
    };
  };

  const scanFiles = async (files: File[]) => {
    const mp3s = filterMp3Files(files);
    if (mp3s.length === 0) {
      setError('No MP3 files were found in the selection.');
      return;
    }

    setError('');
    setPhase('scanning');
    setScanProgress({ current: 0, total: mp3s.length });
    setUploadProgress({ current: 0, total: mp3s.length });
    stopRef.current = false;
    pauseRef.current = false;

    const queue: BulkQueueItem[] = [];
    for (let i = 0; i < mp3s.length; i += 1) {
      if (stopRef.current) break;
      const item = await buildQueueItem(mp3s[i]);
      queue.push(item);
      setScanProgress({ current: i + 1, total: mp3s.length });
    }

    setItems(queue);
    setPhase('idle');
    if (folderInputRef.current) folderInputRef.current.value = '';
    if (filesInputRef.current) filesInputRef.current.value = '';
  };

  const uploadOne = async (item: BulkQueueItem): Promise<BulkQueueItem> => {
    if (skipDuplicates && existingTitles.has(item.title.trim().toLowerCase())) {
      return { ...item, status: 'skipped', error: 'Already exists' };
    }

    const form = new FormData();
    form.append('title', item.title.trim());
    form.append('description', item.description);
    form.append('published_at', item.publishedAt);
    form.append('is_published', String(publishImmediately));
    form.append('audio', item.file);
    if (item.coverFile) form.append('image', item.coverFile);

    await axios.post('/admin/library', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000
    });

    existingTitles.add(item.title.trim().toLowerCase());
    return { ...item, status: 'done' };
  };

  const startUpload = async () => {
    if (items.length === 0) {
      setError('Select a folder or MP3 files first.');
      return;
    }

    setError('');
    setPhase('uploading');
    stopRef.current = false;
    pauseRef.current = false;

    const pending = items.filter((i) => i.status === 'pending' || i.status === 'error');
    let processed = items.length - pending.length;
    setUploadProgress({ current: processed, total: items.length });

    for (let i = 0; i < pending.length; i += 1) {
      while (pauseRef.current && !stopRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (stopRef.current) break;

      const item = pending[i];
      updateItem(item.key, { status: 'uploading', error: undefined });

      try {
        const result = await uploadOne(item);
        updateItem(item.key, { status: result.status, error: result.error });
      } catch (err: any) {
        updateItem(item.key, {
          status: 'error',
          error: err.response?.data?.error || err.message || 'Upload failed'
        });
      }

      processed += 1;
      setUploadProgress({ current: processed, total: items.length });
    }

    setPhase(stopRef.current ? 'paused' : 'done');
    onComplete?.();
  };

  const counts = {
    done: items.filter((i) => i.status === 'done').length,
    skipped: items.filter((i) => i.status === 'skipped').length,
    error: items.filter((i) => i.status === 'error').length,
    pending: items.filter((i) => i.status === 'pending').length
  };

  const scanPct = scanProgress.total ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0;
  const uploadPct = uploadProgress.total ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : 0;

  return (
    <div className="pod-card bulk-upload-card">
      <h3 style={{ marginTop: 0 }}>Bulk Archive Upload</h3>
      <p className="bulk-upload-intro">
        Import hundreds of archived MP3s at once. Each file is read for ID3 tags and embedded cover art.
        Titles, descriptions, publish dates, and covers appear on the member site the same way as single uploads.
        Files named like <code>2005-09-28 - Episode title.mp3</code> are backdated automatically.
      </p>

      {error && <div className="pod-banner pod-banner-error">{error}</div>}

      <div className="bulk-upload-actions">
        <button type="button" className="pod-btn" onClick={() => folderInputRef.current?.click()} disabled={phase === 'scanning' || phase === 'uploading'}>
          Select folder
        </button>
        <button type="button" className="pod-btn pod-btn-secondary" onClick={() => filesInputRef.current?.click()} disabled={phase === 'scanning' || phase === 'uploading'}>
          Select MP3 files
        </button>
        <input
          ref={folderInputRef}
          type="file"
          accept="audio/mpeg,.mp3"
          multiple
          hidden
          // @ts-expect-error webkitdirectory is supported in Chromium browsers
          webkitdirectory=""
          onChange={(e) => {
            if (e.target.files?.length) scanFiles(Array.from(e.target.files));
          }}
        />
        <input
          ref={filesInputRef}
          type="file"
          accept="audio/mpeg,.mp3"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) scanFiles(Array.from(e.target.files));
          }}
        />
      </div>

      <div className="bulk-upload-options">
        <label>
          <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} /> Skip
          episodes that already exist (matched by title)
        </label>
        <label>
          <input type="checkbox" checked={publishImmediately} onChange={(e) => setPublishImmediately(e.target.checked)} />{' '}
          Publish immediately
        </label>
      </div>

      {phase === 'scanning' && (
        <div className="pod-banner pod-banner-info">
          Reading tags… {scanProgress.current} / {scanProgress.total} ({scanPct}%)
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="bulk-upload-summary">
            <span>{items.length} files queued</span>
            <span>{items.filter((i) => i.hasCover).length} with embedded cover</span>
            {counts.done > 0 && <span>{counts.done} uploaded</span>}
            {counts.skipped > 0 && <span>{counts.skipped} skipped</span>}
            {counts.error > 0 && <span>{counts.error} failed</span>}
          </div>

          {(phase === 'uploading' || phase === 'done' || phase === 'paused') && (
            <div className="pod-banner pod-banner-info">
              Upload progress: {uploadProgress.current} / {uploadProgress.total} ({uploadPct}%)
            </div>
          )}

          <div className="bulk-upload-controls">
            <button
              type="button"
              className="pod-btn"
              onClick={startUpload}
              disabled={phase === 'uploading' || phase === 'scanning' || counts.pending + counts.error === 0}
            >
              {phase === 'uploading' ? 'Uploading…' : 'Start upload'}
            </button>
            {phase === 'uploading' && (
              <>
                <button
                  type="button"
                  className="pod-btn pod-btn-secondary"
                  onClick={() => {
                    pauseRef.current = !pauseRef.current;
                    setPhase(pauseRef.current ? 'paused' : 'uploading');
                  }}
                >
                  {pauseRef.current ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="pod-btn pod-btn-danger"
                  onClick={() => {
                    stopRef.current = true;
                    pauseRef.current = false;
                  }}
                >
                  Stop
                </button>
              </>
            )}
            <button
              type="button"
              className="pod-btn pod-btn-secondary"
              onClick={() => {
                stopRef.current = true;
                setItems([]);
                setPhase('idle');
                setScanProgress({ current: 0, total: 0 });
                setUploadProgress({ current: 0, total: 0 });
              }}
              disabled={phase === 'uploading'}
            >
              Clear queue
            </button>
          </div>

          <div className="pod-table-wrap bulk-upload-table-wrap">
            <table className="pod-table bulk-upload-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Title</th>
                  <th>Published</th>
                  <th>Cover</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 200).map((item) => (
                  <tr key={item.key}>
                    <td className="bulk-upload-file">{item.file.name}</td>
                    <td>{item.title}</td>
                    <td>{new Date(item.publishedAt).toLocaleDateString()}</td>
                    <td>{item.hasCover ? 'Yes' : '—'}</td>
                    <td>
                      <span className={`bulk-upload-status bulk-upload-status-${item.status}`}>{item.status}</span>
                      {item.error && <span className="bulk-upload-error"> — {item.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length > 200 && (
              <p className="bulk-upload-more">Showing first 200 of {items.length} files. All will still upload.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BulkUploadForm;
