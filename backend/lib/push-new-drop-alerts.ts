import { logger } from './logger';
import { prepareNewDropAlerts } from './new-drop-alerts';
import { supabase } from './supabase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_MAX_BATCH = 100;

interface PushTokenRow {
  user_id: string;
  expo_push_token: string;
}

interface SendNewDropPushInput {
  sinceMinutes: number;
  domains?: string[];
  productLimit?: number;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: {
    type: 'new_product_drop';
    userId: string;
    brandId: string;
    productId: string;
    productUrl: string | null;
  };
}

export interface SendNewDropPushSummary {
  alertsPrepared: number;
  alertsWithToken: number;
  messagesSent: number;
  ticketsFailed: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function loadPushTokensForUsers(userIds: string[]): Promise<PushTokenRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_push_tokens')
    .select('user_id, expo_push_token')
    .eq('is_active', true)
    .in('user_id', userIds);

  if (error) {
    throw new Error(`Failed to load push tokens: ${error.message}`);
  }

  return (data ?? []) as PushTokenRow[];
}

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<{ sent: number; failed: number }> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push API failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<{ status: string }> };
  const tickets = payload.data ?? [];
  const failed = tickets.filter((ticket) => ticket.status !== 'ok').length;

  return {
    sent: messages.length - failed,
    failed,
  };
}

export async function sendNewDropPushAlerts(input: SendNewDropPushInput): Promise<SendNewDropPushSummary> {
  const prepared = await prepareNewDropAlerts({
    sinceMinutes: input.sinceMinutes,
    domains: input.domains,
    productLimit: input.productLimit,
  });

  if (prepared.alerts.length === 0) {
    return {
      alertsPrepared: 0,
      alertsWithToken: 0,
      messagesSent: 0,
      ticketsFailed: 0,
    };
  }

  const dedupedAlerts = Array.from(
    new Map(prepared.alerts.map((alert) => [`${alert.userId}:${alert.productId}`, alert])).values()
  );

  const userIds = Array.from(new Set(dedupedAlerts.map((alert) => alert.userId)));
  const tokens = await loadPushTokensForUsers(userIds);
  const tokenByUserId = new Map<string, string>();
  for (const token of tokens) {
    if (!tokenByUserId.has(token.user_id)) {
      tokenByUserId.set(token.user_id, token.expo_push_token);
    }
  }

  const messages: ExpoPushMessage[] = dedupedAlerts
    .map((alert) => {
      const token = tokenByUserId.get(alert.userId);
      if (!token) {
        return null;
      }

      return {
        to: token,
        title: `${alert.brandName} dropped something new`,
        body: alert.productName,
        data: {
          type: 'new_product_drop',
          userId: alert.userId,
          brandId: alert.brandId,
          productId: alert.productId,
          productUrl: alert.productUrl,
        },
      } as ExpoPushMessage;
    })
    .filter((item): item is ExpoPushMessage => item !== null);

  if (messages.length === 0) {
    return {
      alertsPrepared: dedupedAlerts.length,
      alertsWithToken: 0,
      messagesSent: 0,
      ticketsFailed: 0,
    };
  }

  let messagesSent = 0;
  let ticketsFailed = 0;

  for (const [index, batch] of chunk(messages, EXPO_MAX_BATCH).entries()) {
    const result = await sendExpoBatch(batch);
    messagesSent += result.sent;
    ticketsFailed += result.failed;
    logger.info(
      `Push batch ${index + 1}: queued=${batch.length}, sent=${result.sent}, failed=${result.failed}`
    );
  }

  return {
    alertsPrepared: dedupedAlerts.length,
    alertsWithToken: messages.length,
    messagesSent,
    ticketsFailed,
  };
}
