/**
 * DataProvider interface - defines how to fetch data from a source (TikHub, direct API, etc.)
 * Providers are platform-agnostic and accept platform as a parameter
 */

export interface BloggerInfo {
  userId: string;
  nickname: string;
  platform: string;
  xsecToken?: string;
  [key: string]: unknown;
}

export interface Profile {
  userBasicInfo: Record<string, unknown>;
  interactions: Array<Record<string, unknown>>;
  feeds: Array<Record<string, unknown>>;
  _source: string;
  [key: string]: unknown;
}

export interface NotesList {
  notes: Array<Record<string, unknown>>;
  hasMore: boolean;
  cursor?: string;
  [key: string]: unknown;
}

export interface NoteDetail {
  note: Record<string, unknown>;
  comments: {
    list: Array<Record<string, unknown>>;
  };
  _meta?: Record<string, unknown>;
  _feed_id: string;
  [key: string]: unknown;
}

export interface DataProvider {
  readonly name: string;
  
  /**
   * Search for a blogger by keyword
   * @param platform - Platform identifier (xhs, douyin, etc.)
   * @param keyword - Search keyword
   */
  searchBlogger(platform: string, keyword: string): Promise<BloggerInfo>;
  
  /**
   * Get blogger profile and basic info
   * @param platform - Platform identifier
   * @param userId - User ID
   */
  getProfile(platform: string, userId: string): Promise<Profile>;
  
  /**
   * Get list of notes/posts
   * @param platform - Platform identifier
   * @param userId - User ID
   * @param cursor - Pagination cursor (optional)
   */
  getNotesList(platform: string, userId: string, cursor?: string): Promise<NotesList>;
  
  /**
   * Get detailed note/post information with comments
   * @param platform - Platform identifier
   * @param noteId - Note ID
   */
  getNoteDetail(platform: string, noteId: string): Promise<NoteDetail>;
}
