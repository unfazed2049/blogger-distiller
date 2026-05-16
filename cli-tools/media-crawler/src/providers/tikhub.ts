import type { DataProvider, BloggerInfo, Profile, NotesList, NoteDetail } from './base';

const DEFAULT_BASE_URL = 'https://api.tikhub.io';
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_RPS = 10;
const SAFETY_RATIO = 0.7; // Leave 30% margin to avoid rate limiting

/**
 * TikHubProvider - fetches data from TikHub API
 * Implements the DataProvider interface for TikHub REST API
 */
export class TikHubProvider implements DataProvider {
  readonly name = 'tikhub';
  
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private lastCallTime: number = 0;
  private minInterval: number;
  
  constructor(config: { baseUrl?: string; apiKey?: string; timeout?: number; rps?: number } = {}) {
    this.baseUrl = (config.baseUrl || process.env.TIKHUB_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = this.resolveApiKey(config.apiKey);
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    
    if (!this.apiKey) {
      throw new Error(
        'TikHub API Token not set. Please set via:\n' +
        '  1. Environment variable: TIKHUB_API_TOKEN=your_token\n' +
        '  2. Pass apiKey in constructor config\n' +
        'Get token at: https://user.tikhub.io'
      );
    }
    
    // Rate limiting setup
    const rps = config.rps || this.resolveRpsLimit();
    this.minInterval = 1000 / Math.max(rps * SAFETY_RATIO, 1); // Convert to milliseconds
  }
  
  /**
   * Resolve API key from config or environment
   */
  private resolveApiKey(token?: string): string {
    if (token?.trim()) return token.trim();
    
    const envToken = process.env.TIKHUB_API_TOKEN?.trim();
    if (envToken) return envToken;
    
    // TODO: Could also check config file at ~/.xiaohongshu/tikhub_config.json
    return '';
  }
  
  /**
   * Resolve RPS limit from environment or use default
   */
  private resolveRpsLimit(): number {
    const envRps = process.env.TIKHUB_RPS?.trim();
    if (envRps) {
      const rps = parseInt(envRps, 10);
      if (rps > 0) {
        console.log(`ℹ️  Using TIKHUB_RPS=${rps} (interval ${(this.minInterval / 1000).toFixed(3)}s)`);
        return rps;
      }
    }
    return DEFAULT_RPS;
  }
  
  /**
   * Throttle requests to respect rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }
    this.lastCallTime = Date.now();
  }
  
  async searchBlogger(platform: string, keyword: string): Promise<BloggerInfo> {
    if (platform !== 'xhs') {
      throw new Error(`Platform ${platform} not supported yet`);
    }
    
    // Try search_users endpoint first (more accurate)
    try {
      const data = await this.request<any>('/api/v1/xiaohongshu/web/search_users', {
        keyword,
        page: '1',
        page_size: '20',
      });
      
      const users = this.extractUsersFromSearchUsers(data);
      if (users.length > 0) {
        // Find exact match or best match by followers
        const exactMatch = users.find(u => u.nickname === keyword);
        const bestMatch = exactMatch || users.reduce((best, curr) => 
          (curr.fans || 0) > (best.fans || 0) ? curr : best
        );
        
        return {
          userId: bestMatch.userId,
          nickname: bestMatch.nickname,
          platform: 'xhs',
          xsecToken: bestMatch.xsecToken,
        };
      }
    } catch (error) {
      console.warn('search_users failed, falling back to search_notes:', error);
    }
    
    // Fallback to search_notes
    const data = await this.request<any>('/api/v1/xiaohongshu/web/search_notes', {
      keyword,
      page: '1',
      page_size: '20',
      sort: 'general',
    });
    
    const feeds = this.extractFeedsFromSearch(data);
    if (feeds.length === 0) {
      throw new Error(`No results found for keyword: ${keyword}`);
    }
    
    // Find most frequent author
    const authorCounts = new Map<string, { count: number; info: any }>();
    for (const feed of feeds) {
      const { userId, nickname, xsecToken } = this.extractUserFromFeed(feed);
      if (userId) {
        const existing = authorCounts.get(userId);
        if (existing) {
          existing.count++;
        } else {
          authorCounts.set(userId, { count: 1, info: { userId, nickname, xsecToken } });
        }
      }
    }
    
    // Find exact match or most frequent
    for (const [userId, { info }] of authorCounts) {
      if (info.nickname === keyword) {
        return { ...info, platform: 'xhs' };
      }
    }
    
    const mostFrequent = Array.from(authorCounts.values())
      .sort((a, b) => b.count - a.count)[0];
    
    return { ...mostFrequent.info, platform: 'xhs' };
  }
  
  async getProfile(platform: string, userId: string): Promise<Profile> {
    if (platform !== 'xhs') {
      throw new Error(`Platform ${platform} not supported yet`);
    }
    
    const data = await this.request<any>('/api/v1/xiaohongshu/web/get_user_info', {
      user_id: userId,
    });
    
    return {
      userBasicInfo: data.data?.basic_info || data.data?.user || data.data || {},
      interactions: data.data?.interactions || [],
      feeds: data.data?.feeds || [],
      _source: 'tikhub',
    };
  }
  
  async getNotesList(platform: string, userId: string, cursor?: string): Promise<NotesList> {
    if (platform !== 'xhs') {
      throw new Error(`Platform ${platform} not supported yet`);
    }
    
    const params: Record<string, string> = { user_id: userId };
    if (cursor) params.cursor = cursor;
    
    const data = await this.request<any>('/api/v1/xiaohongshu/web_v2/fetch_home_notes', params);
    
    const notesData = data.data?.data || data.data || {};
    const noteList = notesData.notes || notesData.items || notesData.feeds || [];
    
    return {
      notes: noteList,
      hasMore: notesData.has_more || notesData.hasMore || false,
      cursor: notesData.cursor || notesData.lastCursor,
    };
  }
  
  async getNoteDetail(platform: string, noteId: string): Promise<NoteDetail> {
    if (platform !== 'xhs') {
      throw new Error(`Platform ${platform} not supported yet`);
    }
    
    const data = await this.request<any>('/api/v1/xiaohongshu/app_v2/get_image_note_detail', {
      note_id: noteId,
    });
    
    const detail = data.data?.data || data.data || {};
    const noteObj = detail.note || detail.noteData || {};
    const commentsObj = detail.comments || {};
    
    return {
      note: noteObj,
      comments: {
        list: commentsObj.list || commentsObj.comments || [],
      },
      _feed_id: noteId,
      _meta: {
        source_endpoint: 'app_v2/get_image_note_detail',
      },
    };
  }
  
  /**
   * Make HTTP request to TikHub API with rate limiting
   */
  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    await this.throttle();
    
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`TikHub API error: ${response.status} ${response.statusText}\n${body}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Extract users from search_users response
   */
  private extractUsersFromSearchUsers(data: any): Array<{ userId: string; nickname: string; xsecToken?: string; fans?: number }> {
    const d = data.data?.data || data.data || {};
    const items = d.items || d.users || d.user_list || [];
    
    return items.map((item: any) => {
      const u = item.user_info || item.user || item;
      const subTitle = u.sub_title || '';
      const fans = subTitle.includes('粉丝') ? this.parseCount(subTitle.replace('粉丝', '').trim()) : 0;
      
      return {
        userId: u.id || u.user_id || u.userid || u.userId || '',
        nickname: u.name || u.nickname || u.nick_name || '',
        xsecToken: u.xsec_token || u.xsecToken || '',
        fans,
      };
    }).filter((u: any) => u.userId);
  }
  
  /**
   * Extract feeds from search_notes response
   */
  private extractFeedsFromSearch(data: any): any[] {
    const d = data.data?.data || data.data || {};
    const items = d.items || d.notes || d.feeds || [];
    
    const result = [];
    for (const item of items) {
      const noteCard = item.noteCard || item.note_card || item.note || item;
      if (noteCard && typeof noteCard === 'object') {
        result.push(noteCard);
      }
    }
    return result;
  }
  
  /**
   * Extract user info from feed item
   */
  private extractUserFromFeed(feed: any): { userId: string; nickname: string; xsecToken?: string } {
    const user = feed.user || {};
    return {
      userId: user.userid || user.userId || user.user_id || '',
      nickname: user.nickname || user.nick_name || user.nickName || '',
      xsecToken: feed.xsec_token || feed.xsecToken || '',
    };
  }
  
  /**
   * Parse count string like "80.7万" to number
   */
  private parseCount(str: string): number {
    if (!str) return 0;
    str = str.trim();
    if (str.endsWith('万')) {
      return Math.floor(parseFloat(str.slice(0, -1)) * 10000);
    }
    return parseInt(str.replace(/,/g, ''), 10) || 0;
  }
}
