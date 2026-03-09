import { PostHog } from 'posthog-react-native';

type AnalyticsEvent =
  | 'sign_in'
  | 'brand_followed'
  | 'product_viewed'
  | 'product_saved'
  | 'buy_clicked';

let client: PostHog | null = null;

function getApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
}

function getHost(): string {
  return process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
}

export function initializeAnalytics(): void {
  const apiKey = getApiKey();
  if (!apiKey || client) {
    return;
  }

  client = new PostHog(apiKey, {
    host: getHost(),
    flushAt: 1,
    flushInterval: 10000,
  });
}

export function identifyAnalyticsUser(userId: string, properties?: Record<string, any>): void {
  if (!client) {
    return;
  }

  client.identify(userId, properties);
}

export function trackAnalyticsEvent(event: AnalyticsEvent, properties?: Record<string, any>): void {
  if (!client) {
    return;
  }

  client.capture(event, properties);
}

export function resetAnalytics(): void {
  if (!client) {
    return;
  }

  client.reset();
}
