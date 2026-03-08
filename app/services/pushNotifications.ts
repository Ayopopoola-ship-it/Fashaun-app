import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabaseClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type DevicePlatform = 'ios' | 'android' | 'web' | 'unknown';

function getProjectId(): string | undefined {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    undefined
  );
}

function toDevicePlatform(): DevicePlatform {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'unknown';
}

async function getExpoPushToken(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = getProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenResponse.data;
}

export async function registerPushTokenForUser(userId: string): Promise<void> {
  const expoPushToken = await getExpoPushToken();
  if (!expoPushToken) {
    return;
  }

  const payload = {
    user_id: userId,
    expo_push_token: expoPushToken,
    device_platform: toDevicePlatform(),
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_push_tokens')
    .upsert(payload, { onConflict: 'user_id,expo_push_token' });

  if (error) {
    throw new Error(`Failed to register push token: ${error.message}`);
  }
}
