import { FeedPost } from '../components/PostCard';

export type StreamLocationState = {
  post?: FeedPost;
  from?: string;
};

export const DEFAULT_STREAM_RETURN = '/feed';

export const buildStreamState = (from: string, post?: FeedPost): StreamLocationState => ({
  ...(post ? { post } : {}),
  from
});

export const readStreamReturnPath = (state: unknown): string | undefined => {
  const from = (state as StreamLocationState | null)?.from;
  if (typeof from !== 'string' || !from.startsWith('/')) return undefined;
  if (from.startsWith('/stream/')) return undefined;
  return from;
};

export const resolveStreamBackTarget = (state: unknown): string =>
  readStreamReturnPath(state) ?? DEFAULT_STREAM_RETURN;

export const currentPathWithSearch = (pathname: string, search: string): string =>
  `${pathname}${search}`;
