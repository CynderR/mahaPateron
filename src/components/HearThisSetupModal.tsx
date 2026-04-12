import React, { useCallback, useEffect, useState } from 'react';
import { pdfjs } from 'react-pdf';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './HearThisSetupModal.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const HEARTHIS_URL = 'https://hearthis.at/shyam-akaash/';
/** Place `Join_Shyam_Akaash_on_HearThis.pdf` in `public/` with this filename */
const HEARTHIS_GUIDE_PDF = '/Join_Shyam_Akaash_on_HearThis.pdf';

export type HearThisSetupModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const HearThisSetupModal: React.FC<HearThisSetupModalProps> = ({ isOpen, onClose }) => {
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
      className="hearthis-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="hearthis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hearthis-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hearthis-modal-header">
          <h2 id="hearthis-modal-title" className="hearthis-modal-title">
            Join Shyam Akaash on HearThis.at
          </h2>
          <button
            type="button"
            className="hearthis-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="hearthis-modal-lead">
          Step through the guide below, then open HearThis.at when you are ready.
        </p>

        <div className="hearthis-modal-panel" role="region" aria-label="PDF guide">
          <div className="hearthis-modal-pdf">
            {pdfLoadError ? (
              <p className="hearthis-modal-pdf-fallback">
                Could not load the PDF. Add{' '}
                <code className="hearthis-modal-code">Join_Shyam_Akaash_on_HearThis.pdf</code> to
                the app&apos;s <code className="hearthis-modal-code">public</code> folder, or{' '}
                <a href={HEARTHIS_GUIDE_PDF} target="_blank" rel="noopener noreferrer">
                  try opening the guide
                </a>{' '}
                in a new tab.
              </p>
            ) : (
              <>
                <Document
                  file={HEARTHIS_GUIDE_PDF}
                  onLoadSuccess={onPdfLoadSuccess}
                  onLoadError={onPdfLoadError}
                  loading={<p className="hearthis-modal-pdf-status">Loading guide…</p>}
                >
                  <div className="hearthis-modal-pdf-page">
                    <Page
                      pageNumber={pdfPage}
                      width={panelWidth}
                      renderTextLayer
                      renderAnnotationLayer
                    />
                  </div>
                </Document>
                {numPdfPages != null && numPdfPages > 0 && (
                  <div className="hearthis-modal-pdf-nav">
                    <button
                      type="button"
                      className="hearthis-modal-nav-btn"
                      disabled={pdfPage <= 1}
                      onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span className="hearthis-modal-pdf-counter">
                      Page {pdfPage} of {numPdfPages}
                    </span>
                    <button
                      type="button"
                      className="hearthis-modal-nav-btn"
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

        <div className="hearthis-modal-footer">
          <a
            href={HEARTHIS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hearthis-modal-primary"
          >
            Open HearThis.at — shyam-akaash
          </a>
        </div>
      </div>
    </div>
  );
};

export default HearThisSetupModal;
