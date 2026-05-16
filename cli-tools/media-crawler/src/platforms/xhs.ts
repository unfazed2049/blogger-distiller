/**
 * XHS (Xiaohongshu) Platform Adapter
 * Normalizes XHS-specific data structures to common format
 */

import type { PlatformAdapter, Note, Comment } from './base';
import type { DataProvider } from '../providers/base';

export class XHSAdapter implements PlatformAdapter {
  readonly platform = 'xhs';
  readonly name = 'xhs';
  
  constructor(private provider: DataProvider) {}

  normalizeProfile(raw: any): any {
    // XHS profile data normalization
    return {
      userBasicInfo: raw.userBasicInfo || raw.basic_info || {},
      interactions: raw.interactions || [],
      feeds: raw.feeds || [],
      _source: raw._source || 'tikhub',
    };
  }

  normalizeNote(raw: any): Note {
    const interact = raw.interactInfo || raw.interact_info || {};
    
    return {
      id: raw.noteId || raw.note_id || raw.id || '',
      title: raw.title || raw.displayTitle || '',
      desc: raw.desc || raw.content || '',
      type: raw.type || 'normal',
      likes: this.parseCount(interact.likedCount || interact.liked_count || 0),
      collects: this.parseCount(interact.collectedCount || interact.collected_count || 0),
      comments_count: this.parseCount(interact.commentCount || interact.comment_count || 0),
      shares: this.parseCount(interact.shareCount || interact.share_count || 0),
      tags: raw.tags || raw.tagList || [],
      time: raw.time || raw.createTime || raw.create_time || 0,
    };
  }

  normalizeComments(raw: any): Comment[] {
    const commentList = raw.list || raw.comments || [];
    
    return commentList.map((c: any) => ({
      content: c.content || '',
      likes: this.parseCount(c.likeCount || c.like_count || c.liked_count || 0),
      user: c.speaker || c.user?.nickname || c.userInfo?.nickname || 'Anonymous',
      is_author: c.is_author || false,
      sub_comments: (c.subComments || c.sub_comments || []).map((sc: any) => ({
        content: sc.content || '',
        user: sc.speaker || sc.user?.nickname || sc.userInfo?.nickname || 'Anonymous',
        is_author: sc.is_author || false,
        reply_to: sc.reply_to,
      })),
    }));
  }
  
  /**
   * Search for bloggers
   */
  async searchBloggers(keyword: string, options: { limit?: number } = {}): Promise<any[]> {
    const result = await this.provider.searchBlogger(this.platform, keyword);
    return [result]; // Return as array for consistency
  }

  /**
   * Parse count string (e.g., "1.2万" -> 12000)
   */
  private parseCount(value: string | number): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const str = String(value).trim();
    
    if (str.endsWith('万')) {
      return Math.floor(parseFloat(str.slice(0, -1)) * 10000);
    }
    
    if (str.toLowerCase().endsWith('k')) {
      return Math.floor(parseFloat(str.slice(0, -1)) * 1000);
    }
    
    return parseInt(str.replace(/,/g, ''), 10) || 0;
  }
}
