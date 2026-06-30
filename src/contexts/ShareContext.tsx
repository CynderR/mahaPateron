import React, { createContext, useContext, ReactNode } from 'react';
import { FeedPost } from '../components/PostCard';
import { buildStreamState } from '../utils/streamNavigation';

export interface ShareAccess {
  canStream: boolean;
  canRss: boolean;
  canDownload: boolean;
}

export interface ShareContextValue {
  shareToken: string;
  basePath: string;
  access: ShareAccess;
  memberAccess: boolean;
  anchorPostId: string | null;
  streamPath: (postId: string) => string;
  streamState: (post?: FeedPost) => ReturnType<typeof buildStreamState>;
}

const ShareContext = createContext<ShareContextValue | null>(null);

interface ShareProviderProps {
  shareToken: string;
  basePath: string;
  access: ShareAccess;
  memberAccess: boolean;
  anchorPostId: string | null;
  children: ReactNode;
}

export const ShareProvider: React.FC<ShareProviderProps> = ({
  shareToken,
  basePath,
  access,
  memberAccess,
  anchorPostId,
  children
}) => {
  const value: ShareContextValue = {
    shareToken,
    basePath,
    access,
    memberAccess,
    anchorPostId,
    streamPath: (postId: string) => `${basePath}/stream/${encodeURIComponent(postId)}`,
    streamState: (post?: FeedPost) => buildStreamState(basePath, post)
  };

  return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>;
};

export const useOptionalShare = (): ShareContextValue | null => useContext(ShareContext);

export const useShare = (): ShareContextValue => {
  const context = useOptionalShare();
  if (!context) {
    throw new Error('useShare must be used within a ShareProvider');
  }
  return context;
};
