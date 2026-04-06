import { prismaQuery } from '../prisma.ts';

/**
 * Store or update a Farcaster notification token.
 * Upserts on (fid, url) unique constraint.
 */
export async function storeNotificationToken(fid: number, token: string, url: string): Promise<void> {
  await prismaQuery.farcasterNotificationToken.upsert({
    where: { fid_url: { fid, url } },
    update: { token },
    create: { fid, token, url },
  });
}

/**
 * Remove all notification tokens for a Farcaster user.
 */
export async function removeNotificationTokens(fid: number): Promise<void> {
  await prismaQuery.farcasterNotificationToken.deleteMany({
    where: { fid },
  });
}

/**
 * Remove specific invalid tokens from the database.
 */
export async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await prismaQuery.farcasterNotificationToken.deleteMany({
    where: { token: { in: tokens } },
  });
}

/**
 * Get all notification tokens for a Farcaster user.
 */
export async function getTokensForFid(fid: number): Promise<Array<{ token: string; url: string }>> {
  return prismaQuery.farcasterNotificationToken.findMany({
    where: { fid },
    select: { token: true, url: true },
  });
}

/**
 * Get all stored notification tokens, grouped by URL.
 * Used for broadcasting notifications to all users.
 */
export async function getAllTokensGroupedByUrl(): Promise<Map<string, string[]>> {
  const all = await prismaQuery.farcasterNotificationToken.findMany({
    select: { token: true, url: true },
  });

  const grouped = new Map<string, string[]>();
  for (const { token, url } of all) {
    const existing = grouped.get(url) || [];
    existing.push(token);
    grouped.set(url, existing);
  }
  return grouped;
}

/**
 * Send a notification to Farcaster users.
 * Groups tokens by URL and sends to each notification endpoint.
 * Handles invalid token cleanup automatically.
 *
 * Constraints:
 * - title: max 32 chars
 * - body: max 128 chars
 * - targetUrl: max 1024 chars, must be HTTPS
 * - tokens per request: max 100
 * - notificationId: max 128 chars (used for 24h deduplication per FID)
 */
export async function sendNotification(params: {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
  tokens: Array<{ token: string; url: string }>;
}): Promise<{ sent: number; invalid: number; rateLimited: number }> {
  const { notificationId, title, body, targetUrl, tokens } = params;

  // Group tokens by URL
  const grouped = new Map<string, string[]>();
  for (const { token, url } of tokens) {
    const existing = grouped.get(url) || [];
    existing.push(token);
    grouped.set(url, existing);
  }

  let sent = 0;
  let invalid = 0;
  let rateLimited = 0;

  for (const [url, urlTokens] of grouped) {
    // Batch in chunks of 100
    for (let i = 0; i < urlTokens.length; i += 100) {
      const batch = urlTokens.slice(i, i + 100);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: notificationId.slice(0, 128),
            title: title.slice(0, 32),
            body: body.slice(0, 128),
            targetUrl: targetUrl.slice(0, 1024),
            tokens: batch,
          }),
        });

        if (!response.ok) {
          console.error(`[FarcasterNotifications] Send failed: ${response.status} to ${url}`);
          continue;
        }

        const data = (await response.json()) as Record<string, unknown>;
        const result = data.result as Record<string, string[]> | undefined;

        if (result) {
          sent += (result.successfulTokens || []).length;
          invalid += (result.invalidTokens || []).length;
          rateLimited += (result.rateLimitedTokens || []).length;

          // Clean up invalid tokens
          if (result.invalidTokens && result.invalidTokens.length > 0) {
            await removeInvalidTokens(result.invalidTokens);
          }
        }
      } catch (error) {
        console.error(`[FarcasterNotifications] Failed to send to ${url}:`, error);
      }
    }
  }

  return { sent, invalid, rateLimited };
}

/**
 * Send a notification to a specific Farcaster user by FID.
 */
export async function notifyUser(fid: number, params: {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
}): Promise<void> {
  const tokens = await getTokensForFid(fid);
  if (tokens.length === 0) return;

  await sendNotification({
    ...params,
    tokens,
  });
}
