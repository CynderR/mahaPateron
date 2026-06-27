import { stripFeedMetadataFromDescription } from './feedDescriptionHelpers';

export interface AdminPostDetail {
  id: string;
  title: string;
  description?: string | null;
  artist?: string | null;
  album?: string | null;
  year?: string | null;
  genre?: string | null;
  is_published?: boolean | number;
  image_filename?: string | null;
}

export interface EditablePostFields {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  notes: string;
  isPublished: boolean;
}

export const editableFieldsFromPost = (post: AdminPostDetail): EditablePostFields => ({
  title: post.title || '',
  artist: post.artist || '',
  album: post.album || '',
  year: post.year || '',
  genre: post.genre || '',
  notes: stripFeedMetadataFromDescription(post.description),
  isPublished: !!post.is_published
});
