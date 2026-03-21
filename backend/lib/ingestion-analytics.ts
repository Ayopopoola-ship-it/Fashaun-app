interface CapturePayload {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

function getHost(): string {
  return process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';
}

function getApiKey(): string | null {
  return process.env.POSTHOG_API_KEY ?? null;
}

export async function captureIngestionEvent(payload: CapturePayload): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return;
  }

  try {
    await fetch(`${getHost()}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        event: payload.event,
        properties: {
          distinct_id: payload.distinctId,
          ...(payload.properties ?? {}),
        },
      }),
    });
  } catch {
    // Analytics failure should never block ingestion.
  }
}
