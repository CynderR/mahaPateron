import React, { useEffect, useState } from 'react';
import axios from 'axios';

export interface LibraryMetadataFilterOptions {
  artists: string[];
  albums: string[];
  years: string[];
  genres: string[];
}

export interface LibraryMetadataFiltersState {
  artist: string;
  album: string;
  year: string;
  genre: string;
}

export const emptyLibraryMetadataFilters = (): LibraryMetadataFiltersState => ({
  artist: '',
  album: '',
  year: '',
  genre: ''
});

interface LibraryMetadataFiltersProps {
  filtersUrl: string;
  values: LibraryMetadataFiltersState;
  onChange: (field: keyof LibraryMetadataFiltersState, value: string) => void;
  onClear?: () => void;
  refreshKey?: number;
}

const LibraryMetadataFilters: React.FC<LibraryMetadataFiltersProps> = ({
  filtersUrl,
  values,
  onChange,
  onClear,
  refreshKey = 0
}) => {
  const [options, setOptions] = useState<LibraryMetadataFilterOptions | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get<LibraryMetadataFilterOptions>(filtersUrl)
      .then((res) => {
        if (!cancelled) setOptions(res.data);
      })
      .catch(() => {
        if (!cancelled) setOptions({ artists: [], albums: [], years: [], genres: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [filtersUrl, refreshKey]);

  if (!options) return null;

  const hasFilters =
    options.artists.length > 0 ||
    options.albums.length > 0 ||
    options.years.length > 0 ||
    options.genres.length > 0;

  if (!hasFilters) return null;

  const activeCount = [values.artist, values.album, values.year, values.genre].filter(Boolean).length;

  const clearAll = () => {
    if (onClear) {
      onClear();
      return;
    }
    onChange('artist', '');
    onChange('album', '');
    onChange('year', '');
    onChange('genre', '');
  };

  return (
    <div className="library-metadata-filters">
      {options.artists.length > 0 && (
        <div className="pod-form-group library-metadata-filter">
          <label htmlFor="library-filter-artist">Artist</label>
          <select
            id="library-filter-artist"
            className="pod-select"
            value={values.artist}
            onChange={(e) => onChange('artist', e.target.value)}
          >
            <option value="">All artists</option>
            {options.artists.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
      {options.albums.length > 0 && (
        <div className="pod-form-group library-metadata-filter">
          <label htmlFor="library-filter-album">Album</label>
          <select
            id="library-filter-album"
            className="pod-select"
            value={values.album}
            onChange={(e) => onChange('album', e.target.value)}
          >
            <option value="">All albums</option>
            {options.albums.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
      {options.years.length > 0 && (
        <div className="pod-form-group library-metadata-filter">
          <label htmlFor="library-filter-year">Year</label>
          <select
            id="library-filter-year"
            className="pod-select"
            value={values.year}
            onChange={(e) => onChange('year', e.target.value)}
          >
            <option value="">All years</option>
            {options.years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
      {options.genres.length > 0 && (
        <div className="pod-form-group library-metadata-filter">
          <label htmlFor="library-filter-genre">Genre</label>
          <select
            id="library-filter-genre"
            className="pod-select"
            value={values.genre}
            onChange={(e) => onChange('genre', e.target.value)}
          >
            <option value="">All genres</option>
            {options.genres.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      )}
      {activeCount > 0 && (
        <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm library-metadata-clear" onClick={clearAll}>
          Clear filters
        </button>
      )}
    </div>
  );
};

export default LibraryMetadataFilters;
