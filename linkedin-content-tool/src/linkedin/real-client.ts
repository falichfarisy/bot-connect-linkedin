import { LinkedInClient } from './client';
import { LinkedInPost, LinkedInComment, LinkedInAnalytics, CreatePostResponse, CreateCommentResponse, MemberInfo } from './types';
import type { LinkedInConfig } from '../config/schema';
import { ensureValidToken } from './auth';

export class RealLinkedInClient implements LinkedInClient {
  private config: LinkedInConfig;
  
  constructor(config: LinkedInConfig) {
    this.config = config;
  }

  async createPost(post: LinkedInPost): Promise<CreatePostResponse> {
    const config = await ensureValidToken(this.config);
    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'LinkedIn-Version': config.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post),
    });
    
    if (response.status === 401) {
      throw new Error('Token expired - auto-refresh attempted');
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '5';
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }
    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${await response.text()}`);
    }
    
    const postUrn = response.headers.get('x-restli-id') || '';
    return { postUrn };
  }

  async createComment(postUrn: string, comment: LinkedInComment): Promise<CreateCommentResponse> {
    const config = await ensureValidToken(this.config);
    const response = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'LinkedIn-Version': config.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(comment),
    });

    if (response.status === 401) throw new Error('Token expired');
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '5';
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }
    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${await response.text()}`);
    }

    const commentUrn = response.headers.get('x-restli-id') || '';
    return { commentUrn };
  }

  async getPostAnalytics(postUrn: string): Promise<LinkedInAnalytics> {
    const config = await ensureValidToken(this.config);
    const encodedUrn = encodeURIComponent(postUrn);
    const response = await fetch(
      `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=(share:${encodedUrn})&queryType=IMPRESSION`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'LinkedIn-Version': config.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    if (response.status === 404) {
      return {}; // Analytics not available yet
    }
    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      impressions: data?.elements?.[0]?.totalShareStatistics?.impressionCount,
      reactions: data?.elements?.[0]?.totalShareStatistics?.reactionCount,
      comments: data?.elements?.[0]?.totalShareStatistics?.commentCount,
      shares: data?.elements?.[0]?.totalShareStatistics?.shareCount,
      saves: data?.elements?.[0]?.totalShareStatistics?.saveCount,
    };
  }

  async getMemberId(): Promise<MemberInfo> {
    const config = await ensureValidToken(this.config);
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      memberId: data.sub,
      name: data.name,
    };
  }
}
