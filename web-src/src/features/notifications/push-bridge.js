/* Halaqati v2.15.7 — official Capacitor Push Notifications bridge.
   Android registration uses the official @capacitor/push-notifications plugin only. */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const firebaseConfigured = String(import.meta.env.VITE_HALAQATI_FIREBASE_CONFIGURED || 'false').toLowerCase() === 'true';
window.HalaqatiPushConfigured = firebaseConfigured;
window.HalaqatiPushLoadError = '';
window.HalaqatiPushNotifications = firebaseConfigured && Capacitor.isNativePlatform() ? PushNotifications : null;
