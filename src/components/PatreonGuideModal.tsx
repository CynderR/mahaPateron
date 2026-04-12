import React, { useCallback, useEffect, useState } from 'react';
import { pdfjs } from 'react-pdf';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PatreonGuideModal.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PATREON_URL = 'https://www.patreon.com/shyamaakash';
/** Place `Shyam_Akaash_Access_Guide_new.pdf` in `public/` with this filename */
const PATREON_GUIDE_PDF = '/Shyam_Akaash_Access_Guide_new.pdf';

export type PatreonGuideModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const PatreonGuideModal: React.FC<PatreonGuideModalProps> = ({ isOpen, onClose }) => {
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

  if (!isOpen) return null;

  return (
    <div
      className="patreon-guide-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="patreon-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patreon-guide-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="patreon-guide-modal-header">
          <h2 id="patreon-guide-modal-title" className="patreon-guide-modal-title">
            Patreon access guide
          </h2>
          <button
            type="button"
            className="patreon-guide-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="patreon-guide-modal-lead">
          Step through the guide below, then open Patreon when you are ready.
        </p>

        <div className="patreon-guide-modal-panel" role="region" aria-label="PDF guide">
          <div className="patreon-guide-modal-pdf">
            {pdfLoadError ? (
              <p className="patreon-guide-modal-pdf-fallback">
                Could not load the PDF. Add{' '}
                <code className="patreon-guide-modal-code">Shyam_Akaash_Access_Guide_new.pdf</code>{' '}
                to the app&apos;s <code className="patreon-guide-modal-code">public</code> folder,
                or{' '}
                <a href={PATREON_GUIDE_PDF} target="_blank" rel="noopener noreferrer">
                  try opening the guide
                </a>{' '}
                in a new tab.
              </p>
            ) : (
              <>
                <Document
                  file={PATREON_GUIDE_PDF}
                  onLoadSuccess={onPdfLoadSuccess}
                  onLoadError={onPdfLoadError}
                  loading={<p className="patreon-guide-modal-pdf-status">Loading guide…</p>}
                >
                  <div className="patreon-guide-modal-pdf-page">
                    <Page
                      pageNumber={pdfPage}
                      width={panelWidth}
                      renderTextLayer
                      renderAnnotationLayer
                    />
                  </div>
                </Document>
                {numPdfPages != null && numPdfPages > 0 && (
                  <div className="patreon-guide-modal-pdf-nav">
                    <button
                      type="button"
                      className="patreon-guide-modal-nav-btn"
                      disabled={pdfPage <= 1}
                      onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="patreon-guide-modal-pdf-counter">
                      Page {pdfPage} of {numPdfPages}
                    </span>
                    <button
                      type="button"
                      className="patreon-guide-modal-nav-btn"
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
        </div>

        <div className="patreon-guide-modal-footer">
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="patreon-guide-modal-primary"
          >
            Open Patreon — shyamaakash
          </a>
        </div>
      </div>
    </div>
  );
};

export default PatreonGuideModal;
