import * as admin from 'firebase-admin';

export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) return;
  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens: validTokens,
    notification: { title, body },
    data,
    webpush: {
      notification: { icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' },
    },
  });

  console.log(`FCM: ${response.successCount}/${validTokens.length} delivered`);
  response.responses.forEach((r, i) => {
    if (!r.success) console.error(`FCM token[${i}] failed:`, r.error?.code, r.error?.message);
  });
}
