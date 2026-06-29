import { useEffect } from 'react';

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return type !== 'range' && type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio';
  }
  return false;
};

const shouldIgnorePlaybackShortcut = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return true;
  if (isTypingTarget(target)) return true;
  if (target.closest('.player-autoplay-timeout')) return true;
  return false;
};

/** Space toggles play/pause (capture phase) so transport buttons keep focus after track changes. */
export const usePlaybackKeyboardShortcuts = (
  enabled: boolean,
  canToggle: boolean,
  onToggle: () => void
): void => {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.repeat) return;
      if (shouldIgnorePlaybackShortcut(event.target)) return;
      if (!canToggle) return;
      event.preventDefault();
      onToggle();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, canToggle, onToggle]);
};

export const blurEpisodeTransportFocus = (): void => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (
    active.closest('.stream-episode-transport') ||
    active.closest('.pod-stream-transport') ||
    active.closest('.player-controls')
  ) {
    active.blur();
  }
};
