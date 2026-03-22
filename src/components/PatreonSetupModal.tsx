import React, { useCallback, useEffect, useState } from 'react';
import { pdfjs } from 'react-pdf';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PatreonSetupModal.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const YOUTUBE_EMBED_ID = 'jZ87gdCaTj8';
const PATREON_URL = 'https://www.patreon.com/shyamaakash';
/** Place `Shyam_Akaash_Access_Guide_new.pdf` in `public/` with this filename */
const PATREON_ACCESS_GUIDE_PDF = '/Shyam_Akaash_Access_Guide_new.pdf';

type Tab = 'video' | 'pdf';

export type PatreonSetupModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const PatreonSetupModal: React.FC<PatreonSetupModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<Tab>('video');
  const [pdfPage, setPdfPage] = useState(1);
  const [numPdfPages, setNumPdfPages] = useState<number | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [panelWidth, setPanelWidth] = useState(800);

  const onPdfLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPdfPages(numPages);
    setPdfPage(1);
    setPdfLoadError(false);
  }, []);

  const onPdfLoadError = useCallback(() => {
    setPdfLoadError(true);
    setNumPdfPages(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const measure = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 800;
      setPanelWidth(Math.min(820, w - 48));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setTab('video');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="patreon-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="patreon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patreon-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="patreon-modal-header">
          <h2 id="patreon-modal-title" className="patreon-modal-title">
            Set up Patreon access
          </h2>
          <button
            type="button"
            className="patreon-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="patreon-modal-lead">
          Watch the tutorial, step through the PDF guide, or go straight to Patreon when you are
          ready.
        </p>

        <div className="patreon-modal-tabs" role="tablist" aria-label="Tutorial format">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'video'}
            className={`patreon-modal-tab ${tab === 'video' ? 'is-active' : ''}`}
            onClick={() => setTab('video')}
          >
            Video tutorial
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pdf'}
            className={`patreon-modal-tab ${tab === 'pdf' ? 'is-active' : ''}`}
            onClick={() => setTab('pdf')}
          >
            PDF guide (slides)
          </button>
        </div>

        <div className="patreon-modal-panel" role="tabpanel">
          {tab === 'video' && (
            <div className="patreon-modal-video-wrap">
              <iframe
                title="Patreon setup tutorial"
                src={`https://www.youtube.com/embed/${YOUTUBE_EMBED_ID}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="patreon-modal-video"
              />
            </div>
          )}

          {tab === 'pdf' && (
            <div className="patreon-modal-pdf">
              {pdfLoadError ? (
                <p className="patreon-modal-pdf-fallback">
                  Could not load the PDF. Add{' '}
                  <code className="patreon-modal-code">Shyam_Akaash_Access_Guide_new.pdf</code> to
                  the app&apos;s <code className="patreon-modal-code">public</code> folder, or{' '}
                  <a href={PATREON_ACCESS_GUIDE_PDF} target="_blank" rel="noopener noreferrer">
                    try opening the guide
                  </a>{' '}
                  in a new tab.
                </p>
              ) : (
                <>
                  <Document
                    file={PATREON_ACCESS_GUIDE_PDF}
                    onLoadSuccess={onPdfLoadSuccess}
                    onLoadError={onPdfLoadError}
                    loading={<p className="patreon-modal-pdf-status">Loading guide…</p>}
                  >
                    <div className="patreon-modal-pdf-page">
                      <Page
                        pageNumber={pdfPage}
                        width={panelWidth}
                        renderTextLayer
                        renderAnnotationLayer
                      />
                    </div>
                  </Document>
                  {numPdfPages != null && numPdfPages > 0 && (
                    <div className="patreon-modal-pdf-nav">
                      <button
                        type="button"
                        className="patreon-modal-nav-btn"
                        disabled={pdfPage <= 1}
                        onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="patreon-modal-pdf-counter">
                        Page {pdfPage} of {numPdfPages}
                      </span>
                      <button
                        type="button"
                        className="patreon-modal-nav-btn"
                        disabled={pdfPage >= numPdfPages}
                        onClick={() => setPdfPage((p) => Math.min(numPdfPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="patreon-modal-footer">
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="patreon-modal-primary"
          >
            Open Patreon — shyamaakash
          </a>
        </div>
      </div>
    </div>
  );
};

export default PatreonSetupModal;
