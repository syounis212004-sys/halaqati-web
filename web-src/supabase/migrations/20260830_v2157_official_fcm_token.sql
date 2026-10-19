-- v2.15.7: official Capacitor PushNotifications uses Android FCM registration tokens.
-- Keep registration_type only for backward schema compatibility, but normalize current rows/default.
update public.user_devices set registration_type='token' where registration_type is distinct from 'token';
alter table public.user_devices alter column registration_type set default 'token';
