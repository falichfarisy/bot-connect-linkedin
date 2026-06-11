import { LinkedInClient } from './client';
import type { LinkedInAnalytics } from './types';

export interface AnalyticsFetchOptions {
  postUrn: string;
  scopeApproved?: boolean; // Feature flag for r_member_postAnalytics scope
}

/**
 * Fetches analytics for a LinkedIn post.
 *
 * If scope is not approved (r_member_postAnalytics), returns mock data
 * with a warning. If approved, fetches real data from LinkedIn API.
 */
export async function fetchPostAnalytics(
  client: LinkedInClient,
  options: AnalyticsFetchOptions
): Promise<{ analytics: LinkedInAnalytics; warning?: string }> {
  if (!options.scopeApproved) {
    return {
      analytics: {
        impressions: 0,
        reactions: 0,
        comments: 0,
        shares: 0,
        saves: 0,
      },
      warning: 'Analytics scope (r_member_postAnalytics) not approved. Showing mock data.',
    };
  }

  try {
    const analytics = await client.getPostAnalytics(options.postUrn);
    return { analytics };
  } catch (error: any) {
    // Handle 404 gracefully (post too recent, analytics not available)
    if (error.message?.includes('404')) {
      return {
        analytics: {},
        warning: 'Analytics not available yet. Post may be too recent.',
      };
    }
    throw error;
  }
}

/**
 * Calculates engagement rate from analytics data.
 */
export function calculateEngagementRate(analytics: LinkedInAnalytics): number | null {
  const impressions = analytics.impressions || 0;
  if (impressions === 0) return null;

  const total = (analytics.reactions || 0) +
                (analytics.comments || 0) +
                (analytics.shares || 0) +
                (analytics.saves || 0);

  return total / impressions;
}
