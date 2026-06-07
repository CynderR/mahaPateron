declare module 'jsmediatags/dist/jsmediatags.min.js' {
  interface PictureTag {
    data: Uint8Array;
    format: string;
    type?: string;
    description?: string;
  }

  interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    year?: string | number;
    genre?: string;
    picture?: PictureTag;
  }

  interface ReadResult {
    tags: Tags;
  }

  interface ReadHandlers {
    onSuccess: (result: ReadResult) => void;
    onError: (error: { type: string; info: string }) => void;
  }

  const jsmediatags: {
    read: (file: File | Blob, handlers: ReadHandlers) => void;
  };

  export default jsmediatags;
}
