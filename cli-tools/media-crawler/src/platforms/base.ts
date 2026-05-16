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
}
