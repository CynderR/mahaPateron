import React, { useState } from 'react';

interface RssCopyWidgetProps {
  url: string;
}

// Read-only display of an RSS URL with a copy-to-clipboard button.
const RssCopyWidget: React.FC<RssCopyWidgetProps> = ({ url }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard API may be unavailable (e.g. non-HTTPS); fall back to select.
      const input = document.getElementById('rss-url-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="pod-copy-row">
      <input id="rss-url-input" className="pod-input" type="text" value={url} readOnly onFocus={(e) => e.target.select()} />
      <button type="button" className="pod-btn" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};

export default RssCopyWidget;
