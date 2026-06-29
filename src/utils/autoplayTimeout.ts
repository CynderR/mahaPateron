export type AutoplayTimeoutHours = 0 | 1 | 2 | 4 | 8 | 12;

export const AUTOPLAY_TIMEOUT_STORAGE_KEY = 'playerAutoplayTimeoutHours';

export const AUTOPLAY_TIMEOUT_OPTIONS: { value: AutoplayTimeoutHours; label: string }[] = [
  { value: 0, label: 'Replay Timer' },
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 4, label: '4 hours' },
  { value: 8, label: '8 hours' },
  { value: 12, label: '12 hours' }
];

const VALID_HOURS = new Set<number>([0, 1, 2, 4, 8, 12]);

export const readAutoplayTimeoutHours = (): AutoplayTimeoutHours => {
  if (typeof window === 'undefined') return 0;
  const stored = parseInt(localStorage.getItem(AUTOPLAY_TIMEOUT_STORAGE_KEY) ?? '0', 10);
  if (VALID_HOURS.has(stored)) return stored as AutoplayTimeoutHours;
  return 0;
};

export const writeAutoplayTimeoutHours = (hours: AutoplayTimeoutHours): void => {
  localStorage.setItem(AUTOPLAY_TIMEOUT_STORAGE_KEY, String(hours));
};

export const autoplayTimeoutMs = (hours: AutoplayTimeoutHours): number => hours * 60 * 60 * 1000;

export const formatAutoplayTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '0:00';
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
