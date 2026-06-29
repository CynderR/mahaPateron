import React, { useMemo } from 'react';
import { formatStreamPlayDescription } from '../utils/feedDescriptionHelpers';

interface StreamEpisodeMetadataProps {
  description?: string | null;
  metadataClassName?: string;
  notesClassName?: string;
}

const StreamEpisodeMetadata: React.FC<StreamEpisodeMetadataProps> = ({
  description,
  metadataClassName = 'stream-metadata',
  notesClassName = 'stream-description'
}) => {
  const { metadataLine, notes } = useMemo(
    () => formatStreamPlayDescription(description),
    [description]
  );

  if (!metadataLine && !notes) return null;

  return (
    <>
      {metadataLine && <p className={metadataClassName}>{metadataLine}</p>}
      {notes && <p className={notesClassName}>{notes}</p>}
    </>
  );
};

export default StreamEpisodeMetadata;
