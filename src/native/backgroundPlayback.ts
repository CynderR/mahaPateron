import { PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

export type BackgroundPlaybackEvent = 'play' | 'pause' | 'extend';

export type BackgroundPlaybackState = {
  title: string;
  artist?: string;
  playing: boolean;
  remainingLabel?: string;
  showExtend: boolean;
};

export interface BackgroundPlaybackPlugin {
  update(options: BackgroundPlaybackState): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: BackgroundPlaybackEvent,
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
}

const BackgroundPlayback = registerPlugin<BackgroundPlaybackPlugin>('BackgroundPlayback', {
  web: () => ({
    async update() {},
    async stop() {},
    async addListener() {
      return { remove: async () => undefined };
    }
  })
});

const lastSent = {
  title: '',
  artist: '',
  playing: false,
  remainingBucket: Number.MIN_SAFE_INTEGER,
  showExtend: false
};

const remainingBucket = (remainingMs: number | null | undefined): number => {
  if (remainingMs == null || remainingMs <= 0) return -1;
  const step = remainingMs <= 60_000 ? 5_000 : 15_000;
  return Math.floor(remainingMs / step);
};

export const syncBackgroundPlayback = (state: BackgroundPlaybackState & { remainingMs?: number | null }): void => {
  if (!isNativeApp()) return;

  const bucket = remainingBucket(state.remainingMs ?? null);
  if (
    lastSent.title === state.title &&
    lastSent.artist === (state.artist || '') &&
    lastSent.playing === state.playing &&
    lastSent.showExtend === state.showExtend &&
    lastSent.remainingBucket === bucket
  ) {
    return;
  }

  lastSent.title = state.title;
  lastSent.artist = state.artist || '';
  lastSent.playing = state.playing;
  lastSent.showExtend = state.showExtend;
  lastSent.remainingBucket = bucket;

  void BackgroundPlayback.update({
    title: state.title,
    artist: state.artist,
    playing: state.playing,
    remainingLabel: state.remainingLabel,
    showExtend: state.showExtend
  }).catch(() => undefined);
};

export const stopBackgroundPlayback = (): void => {
  if (!isNativeApp()) return;
  lastSent.title = '';
  lastSent.artist = '';
  lastSent.playing = false;
  lastSent.showExtend = false;
  lastSent.remainingBucket = Number.MIN_SAFE_INTEGER;
  void BackgroundPlayback.stop().catch(() => undefined);
};

export const listenBackgroundPlayback = (
  handlers: Partial<Record<BackgroundPlaybackEvent, () => void>>
): (() => void) => {
  if (!isNativeApp()) return () => undefined;

  let cancelled = false;
  const handles: PluginListenerHandle[] = [];
  void Promise.all(
    (Object.keys(handlers) as BackgroundPlaybackEvent[]).map(async (event) => {
      const handler = handlers[event];
      if (!handler) return;
      const handle = await BackgroundPlayback.addListener(event, handler);
      if (cancelled) {
        await handle.remove();
        return;
      }
      handles.push(handle);
    })
  );

  return () => {
    cancelled = true;
    handles.forEach((handle) => {
      void handle.remove();
    });
  };
};
