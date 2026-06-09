// src/notifications/config/notification-types.config.ts

export enum RefinedNotificationType {
  // Call types
  CALL_VIDEO = 'call_video',
  CALL_AUDIO = 'call_audio',

  // Session request types (sent to astrologer when user initiates)
  CALL_REQUEST_VIDEO = 'call_request_video',
  CALL_REQUEST_AUDIO = 'call_request_audio',
  CHAT_REQUEST = 'chat_request',

  // Session acceptance (sent to user when astrologer accepts)
  REQUEST_ACCEPTED = 'request_accepted',

  // Message/Chat types
  MESSAGE_DIRECT = 'message_direct',
  CHAT_GROUP = 'chat_group',

  // Event types
  LIVE_EVENT_STARTED = 'live_event_started',
  LIVE_EVENT_REMINDER = 'live_event_reminder',

  // System types
  SYSTEM_PROMOTIONAL = 'system_promotional',

  // Security types
  FORCE_LOGOUT = 'force_logout',

  // Misc
  MISSED_CALL = 'missed_call',
  MISSED_CHAT = 'missed_chat',
  MATRIMONY_MESSAGE = 'matrimony_message',
}

export interface NotificationTypeConfig {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sound: string;
  androidChannelId: string;
  iosCategory?: string;
  isFullScreen: boolean;
  vibrate: boolean;
  foregroundBehavior: 'banner' | 'modal' | 'toast' | 'full-screen' | 'none';
  backgroundBehavior: 'heads-up' | 'standard' | 'full-screen' | 'silent';
}

export const NOTIFICATION_TYPE_CONFIGS: Record<string, NotificationTypeConfig> = {
  // ========================================
  // CALL NOTIFICATIONS
  // ========================================
  [RefinedNotificationType.CALL_VIDEO]: {
    priority: 'urgent',
    sound: 'call_ringtone',
    androidChannelId: 'vaidik_alert_v3',
    iosCategory: 'call',
    isFullScreen: true,
    vibrate: true,
    foregroundBehavior: 'full-screen',
    backgroundBehavior: 'full-screen',
  },
  [RefinedNotificationType.CALL_AUDIO]: {
    priority: 'urgent',
    sound: 'call_ringtone',
    androidChannelId: 'vaidik_alert_v3',
    iosCategory: 'call',
    isFullScreen: true,
    vibrate: true,
    foregroundBehavior: 'full-screen',
    backgroundBehavior: 'full-screen',
  },

  // ========================================
  // SESSION REQUEST NOTIFICATIONS (data-only → no duplicate)
  // ========================================
  [RefinedNotificationType.CALL_REQUEST_VIDEO]: {
    priority: 'urgent',
    sound: 'call_ringtone',
    androidChannelId: 'astro_urgent_v10',
    iosCategory: 'call',
    isFullScreen: true,
    vibrate: true,
    foregroundBehavior: 'full-screen',
    backgroundBehavior: 'full-screen',
  },
  [RefinedNotificationType.CALL_REQUEST_AUDIO]: {
    priority: 'urgent',
    sound: 'call_ringtone',
    androidChannelId: 'astro_urgent_v10',
    iosCategory: 'call',
    isFullScreen: true,
    vibrate: true,
    foregroundBehavior: 'full-screen',
    backgroundBehavior: 'full-screen',
  },
  [RefinedNotificationType.CHAT_REQUEST]: {
    priority: 'urgent',
    sound: 'call_ringtone',
    androidChannelId: 'astro_urgent_v10',
    iosCategory: 'call',
    isFullScreen: true,
    vibrate: true,
    foregroundBehavior: 'full-screen',
    backgroundBehavior: 'full-screen',
  },
  [RefinedNotificationType.REQUEST_ACCEPTED]: {
    priority: 'urgent',
    sound: 'call_ringtone',
    androidChannelId: 'vaidik_alert_v3',
    iosCategory: 'call',
    isFullScreen: true,
    vibrate: true,
    foregroundBehavior: 'full-screen',
    backgroundBehavior: 'full-screen',
  },

  // ========================================
  // MESSAGE/CHAT NOTIFICATIONS
  // ========================================
  [RefinedNotificationType.MESSAGE_DIRECT]: {
    priority: 'high',
    sound: 'message_tone.mp3',
    androidChannelId: 'message-channel',
    iosCategory: 'message',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'banner',
    backgroundBehavior: 'heads-up',
  },
  [RefinedNotificationType.CHAT_GROUP]: {
    priority: 'high',
    sound: 'chat_tone.mp3',
    androidChannelId: 'chat-channel',
    iosCategory: 'message',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'banner',
    backgroundBehavior: 'heads-up',
  },

  // ========================================
  // LIVE EVENT NOTIFICATIONS
  // ========================================
  [RefinedNotificationType.LIVE_EVENT_STARTED]: {
    priority: 'high',
    sound: 'event_alert.mp3',
    androidChannelId: 'event-channel',
    iosCategory: 'event',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'modal',
    backgroundBehavior: 'heads-up',
  },
  [RefinedNotificationType.LIVE_EVENT_REMINDER]: {
    priority: 'high',
    sound: 'event_alert.mp3',
    androidChannelId: 'event-channel',
    iosCategory: 'event',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'modal',
    backgroundBehavior: 'heads-up',
  },

  // ========================================
  // SYSTEM/PROMOTIONAL NOTIFICATIONS
  // ========================================
  [RefinedNotificationType.SYSTEM_PROMOTIONAL]: {
    priority: 'medium',
    sound: 'subtle_tone.mp3',
    androidChannelId: 'system-channel',
    isFullScreen: false,
    vibrate: false,
    foregroundBehavior: 'toast',
    backgroundBehavior: 'standard',
  },

  // ========================================
  // FORCE LOGOUT
  // ========================================
  [RefinedNotificationType.FORCE_LOGOUT]: {
    priority: 'urgent',
    sound: 'alert.mp3',
    androidChannelId: 'security-channel',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'modal',
    backgroundBehavior: 'silent', // ✅ As per your requirement
  },

  // ========================================
  // MISC NOTIFICATIONS
  // ========================================
  [RefinedNotificationType.MISSED_CALL]: {
    priority: 'high',
    sound: 'missed_call.mp3',
    androidChannelId: 'missed-session-channel',
    vibrate: true,
    foregroundBehavior: 'banner',
    backgroundBehavior: 'heads-up',
    isFullScreen: false,
  },
  [RefinedNotificationType.MISSED_CHAT]: {
    priority: 'high',
    sound: 'missed_chat.mp3',
    androidChannelId: 'missed-session-channel',
    vibrate: true,
    foregroundBehavior: 'banner',
    backgroundBehavior: 'heads-up',
    isFullScreen: false,
  },
  [RefinedNotificationType.MATRIMONY_MESSAGE]: {
    priority: 'high',
    sound: 'message_tone.mp3',
    androidChannelId: 'message-channel',
    iosCategory: 'message',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'banner',
    backgroundBehavior: 'heads-up',
  },
};

/**
 * Get notification configuration for a specific type
 */
export function getNotificationConfig(type: string): NotificationTypeConfig {
  return NOTIFICATION_TYPE_CONFIGS[type] || {
    priority: 'medium',
    sound: 'default',
    androidChannelId: 'default-channel',
    isFullScreen: false,
    vibrate: true,
    foregroundBehavior: 'banner',
    backgroundBehavior: 'standard',
  };
}

/**
 * Check if notification type requires real-time Socket.io delivery
 */
export function shouldUseSocketIo(type: string): boolean {
  const realTimeTypes = [
    RefinedNotificationType.MESSAGE_DIRECT,
    RefinedNotificationType.CHAT_GROUP,
    RefinedNotificationType.CALL_VIDEO,
    RefinedNotificationType.CALL_AUDIO,
    RefinedNotificationType.CALL_REQUEST_VIDEO,
    RefinedNotificationType.CALL_REQUEST_AUDIO,
    RefinedNotificationType.CHAT_REQUEST,
    RefinedNotificationType.REQUEST_ACCEPTED,
    'chat_message', // Keep existing type for backward compatibility
    RefinedNotificationType.MATRIMONY_MESSAGE,
  ];

  return realTimeTypes.includes(type as any);
}
