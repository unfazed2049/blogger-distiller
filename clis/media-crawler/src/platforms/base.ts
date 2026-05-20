/**
 * PlatformAdapter interface - normalizes platform-specific data structures
 * Adapters transform raw provider data into common formats
 */

export interface Note {
  id: string;
  title: string;
  desc: string;
  type: string;
  likes: number;
  collects: number;
  comments_count: number;
  shares: number;
  tags: string[];
  time: number;
  [key: string]: unknown;
}

export interface Comment {
  content: string;
  likes: number;
  user: string;
  is_author: boolean;
  sub_comments: Array<{
    content: string;
    user: string;
    is_author: boolean;
    reply_to?: string;
  }>;
  [key: string]: unknown;
}

/**
 * Slimmed note detail — only fields consumed by analyze.py.
 * Matches the data contract between media-crawler and scripts/analyze.py.
 */
export interface SlimNoteDetail {
  _feed_id: string;
  note?: SlimContentFields;
  video?: SlimContentFields;
  comments?: { list: SlimCommentFields[] };
  _meta?: Record<string, unknown>;
  _error?: string;
  _content_restricted?: boolean;
}

/** Fields analyze.py reads from the content object (note / video) */
export interface SlimContentFields {
  noteId?: string;
  aweme_id?: string;
  title?: string;
  displayTitle?: string;
  desc?: string;
  type?: string;
  interactInfo?: {
    likedCount?: string;
    collectedCount?: string;
    commentCount?: string;
    sharedCount?: string;
  };
  tagList?: Array<string | { name: string }>;
  time?: number;
}

/** Fields analyze.py reads from each comment */
export interface SlimCommentFields {
  content?: string;
  likeCount?: string;
  like_count?: string;
  speaker?: string;
  userInfo?: { nickname?: string };
  is_author?: boolean;
  showTags?: string[];
  subComments?: SlimCommentFields[];
  sub_comments?: SlimCommentFields[];
  reply_to?: string;
}

export interface PlatformAdapter {
  readonly platform: string;
  
  /**
   * Normalize raw profile data to common format
   * @param raw - Raw profile data from provider
   */
  normalizeProfile(raw: any): {
    userBasicInfo: Record<string, unknown>;
    interactions: Array<Record<string, unknown>>;
    feeds: Array<Record<string, unknown>>;
    _source: string;
  };
  
  /**
   * Normalize raw note/post data to common format
   * @param raw - Raw note data from provider
   */
  normalizeNote(raw: any): Note;
  
  /**
   * Normalize raw comments data to common format
   * @param raw - Raw comments data from provider
   */
  normalizeComments(raw: any): Comment[];
  
  /**
   * Strip a raw note detail to only the fields consumed by analyze.py.
   * Each platform adapter implements its own field whitelist.
   * @param raw - Raw NoteDetail from provider
   */
  normalizeNoteDetail(raw: any): SlimNoteDetail;
}
