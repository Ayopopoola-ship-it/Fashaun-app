import { trackAnalyticsEvent } from './analytics';
import { supabase } from './supabaseClient';

export type CoreProductEvent = 'product_view' | 'product_click' | 'product_save' | 'buy_click';
export type SwipeEvent = 'swipe_right' | 'swipe_left';

interface TrackProductEventInput {
  event: CoreProductEvent;
  userId: string;
  brandId: string;
  productId: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}

const eventCooldownMs: Record<CoreProductEvent, number> = {
  product_view: 30_000,
  product_click: 3_000,
  product_save: 3_000,
  buy_click: 3_000,
};

const interactionTypeByEvent: Record<CoreProductEvent, 'view' | 'click' | 'save' | 'purchase'> = {
  product_view: 'view',
  product_click: 'click',
  product_save: 'save',
  buy_click: 'purchase',
};

const analyticsEventByInteraction: Partial<Record<CoreProductEvent, 'product_view' | 'product_click' | 'product_save' | 'buy_clicked'>> = {
  product_view: 'product_view',
  product_click: 'product_click',
  product_save: 'product_save',
  buy_click: 'buy_clicked',
};

const recentEvents = new Map<string, number>();

function shouldSkipEvent(input: TrackProductEventInput): boolean {
  const key = input.dedupeKey ?? `${input.userId}:${input.event}:${input.productId}`;
  const now = Date.now();
  const lastSeen = recentEvents.get(key);
  const cooldown = eventCooldownMs[input.event];

  if (lastSeen && now - lastSeen < cooldown) {
    return true;
  }

  recentEvents.set(key, now);
  return false;
}

export async function trackProductEvent(input: TrackProductEventInput): Promise<void> {
  if (shouldSkipEvent(input)) {
    return;
  }

  const { event, userId, brandId, productId, metadata } = input;

  const { error } = await supabase.from('user_interactions').insert({
    user_id: userId,
    brand_id: brandId,
    product_id: productId,
    interaction_type: interactionTypeByEvent[event],
    source: event,
    metadata: {
      event,
      ...(metadata ?? {}),
    },
  });

  if (error) {
    throw new Error(`Failed to track ${event}: ${error.message}`);
  }

  const analyticsEvent = analyticsEventByInteraction[event];
  if (analyticsEvent) {
    trackAnalyticsEvent(analyticsEvent, {
      user_id: userId,
      brand_id: brandId,
      product_id: productId,
      ...(metadata ?? {}),
    });
  }
}

interface TrackSwipeEventInput {
  event: SwipeEvent;
  userId: string;
  brandId: string;
  productId: string;
  metadata?: Record<string, unknown>;
}

export async function trackSwipeEvent(input: TrackSwipeEventInput): Promise<void> {
  const dedupeKey = `${input.userId}:${input.event}:${input.productId}`;
  const now = Date.now();
  const lastSeen = recentEvents.get(dedupeKey);
  if (lastSeen && now - lastSeen < 1500) {
    return;
  }
  recentEvents.set(dedupeKey, now);

  const { event, userId, brandId, productId, metadata } = input;

  const { error } = await supabase.from('user_interactions').insert({
    user_id: userId,
    brand_id: brandId,
    product_id: productId,
    interaction_type: 'click',
    source: event,
    metadata: {
      event,
      ...(metadata ?? {}),
    },
  });

  if (error) {
    throw new Error(`Failed to track ${event}: ${error.message}`);
  }

  trackAnalyticsEvent(event, {
    user_id: userId,
    brand_id: brandId,
    product_id: productId,
    ...(metadata ?? {}),
  });
}
