/**
 * XHS (Xiaohongshu) Platform Adapter
 * Normalizes XHS-specific data structures to common format
 */

import type { PlatformAdapter, Note, Comment, SlimNoteDetail, SlimContentFields, SlimCommentFields } from './base';
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
   * Strip raw note detail to only the fields consumed by analyze.py.
   * Drops user info, image lists, and other verbose fields from the raw response.
   */
  normalizeNoteDetail(raw: any): SlimNoteDetail {
    const slimNote = this.stripContentFields(raw.note || {});
    const slimComments = this.stripCommentList(raw.comments?.list || raw.comments || []);
    
    const result: SlimNoteDetail = {
      _feed_id: raw._feed_id || '',
    };
    
    if (Object.keys(slimNote).length > 0) {
      result.note = slimNote;
    }
    if (slimComments.length > 0) {
      result.comments = { list: slimComments };
    }
    if (raw._meta) {
      result._meta = raw._meta;
    }
    if (raw._error) {
      result._error = raw._error;
    }
    if (raw._content_restricted) {
      result._content_restricted = true;
    }
    
    return result;
  }
  
  /** Keep only the content fields analyze.py reads */
  private stripContentFields(raw: any): SlimContentFields {
    if (!raw || typeof raw !== 'object') return {};
    
    const slim: SlimContentFields = {};
    const pick = (keys: string[]) => {
      for (const k of keys) {
        if (raw[k] !== undefined) {
          (slim as any)[k] = raw[k];
          return;
        }
      }
    };
    
    pick(['noteId', 'aweme_id']);
    pick(['title', 'displayTitle']);
    if (raw.desc !== undefined) slim.desc = raw.desc;
    if (raw.type !== undefined) slim.type = raw.type;
    
    // interactInfo — keep only the 4 counts analyze.py reads
    const interact = raw.interactInfo;
    if (interact && typeof interact === 'object') {
      const slimInteract: any = {};
      let hasAny = false;
      for (const k of ['likedCount', 'collectedCount', 'commentCount', 'sharedCount']) {
        if (interact[k] !== undefined) {
          slimInteract[k] = interact[k];
          hasAny = true;
        }
      }
      if (hasAny) slim.interactInfo = slimInteract;
    }
    
    // tagList
    if (raw.tagList !== undefined) slim.tagList = raw.tagList;
    
    // time
    if (raw.time !== undefined) slim.time = raw.time;
    
    return slim;
  }
  
  /** Strip each comment to minimal fields */
  private stripCommentList(list: any[]): SlimCommentFields[] {
    if (!Array.isArray(list)) return [];
    
    return list.map((c: any) => {
      const slim: SlimCommentFields = {};
      if (c.content !== undefined) slim.content = c.content;
      if (c.likeCount !== undefined) slim.likeCount = c.likeCount;
      if (c.like_count !== undefined) slim.like_count = c.like_count;
      if (c.speaker !== undefined) slim.speaker = c.speaker;
      if (c.userInfo?.nickname !== undefined) {
        slim.userInfo = { nickname: c.userInfo.nickname };
      }
      if (c.is_author !== undefined) slim.is_author = c.is_author;
      if (c.showTags !== undefined) slim.showTags = c.showTags;
      if (c.reply_to !== undefined) slim.reply_to = c.reply_to;
      
      // Recurse into sub-comments
      const subs = c.subComments || c.sub_comments;
      if (Array.isArray(subs) && subs.length > 0) {
        const strippedSubs = this.stripCommentList(subs);
        if (c.subComments !== undefined) {
          slim.subComments = strippedSubs;
        } else {
          slim.sub_comments = strippedSubs;
        }
      }
      
      return slim;
    });
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
