# ZELPX Native Mobile App

Native Android/iOS application workspace. Existing production web portals and the separate Admin Panel remain untouched.

## Implemented foundation

- Expo SDK 58 / React Native 0.88 app scaffold.
- Customer / Contractor entry selection and native Supabase Auth.
- Persistent native sessions using AsyncStorage.
- Trusted profile-role check; Admin accounts are directed to the separate Admin website.
- Android notification permission flow and six sound-enabled notification channels: messages, leads, offers/approvals, account/verification, payments/purchases, and general updates.
- Android device FCM token registration through the existing authenticated `zelpx-fcm-call` Edge Function.
- An audible local test notification after enabling notifications.

## Important notification setup still required

The repository does not currently contain the Firebase Android client configuration. To receive remote Android push notifications in a development/release build, add the Firebase `google-services.json` for the Android Firebase app whose package name is `com.zelpx.app` and project is `zelpx-af340`. Do not substitute a service-account JSON file. The service-account private key must remain only in Supabase secrets.

The current FCM Edge Function registers device tokens and supports its existing incoming-call action. The app-side notification channels are prepared, but every business event (new lead, new message, offer, approval/decline, purchase/payment, license/insurance review, account changes, and admin alerts) still needs its server-side event sender wired to the correct recipient and Android channel. Do not describe all event delivery as live until those backend senders have been implemented and tested.

Android notification sounds use the system default sound. Users can change sound/importance per channel in Android Settings. Sound may be suppressed by Do Not Disturb, silent mode, or the device's notification settings.

## Not yet implemented

- Native contractor registration and full license/insurance review workflow.
- Native phone verification UI.
- Customer profile/address editor, service request creation, offers, approvals and chat.
- Contractor available jobs, lead purchase, wallet, offers and notifications feed.
- Stripe checkout / Connect user flows.
- Complete server-side event delivery for every notification category.
- iOS push registration and APNs delivery.
- Production signing, store screenshots, policy declarations and release bundle.

## Configuration

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never place a service-role key or server secret in the mobile app.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npx expo install --fix
npx expo-doctor
npm start
```

Remote push notifications require a development build and a physical Android device with Google Play services; Expo Go is not sufficient for remote push on Android. Rebuild the native app after adding notification configuration or Firebase files.

## Google Play readiness

Verify the current Play target API requirement immediately before submission. Release builds need EAS project linking, signing configuration, a privacy policy, Data safety declarations, and completed Play Console testing tracks.

## Notification event catalog for the backend integration

The app notification channel IDs are stable identifiers and should be used by the server sender:

| Channel ID | Events |
| --- | --- |
| `zelpx_messages` | New customer/contractor chat message; incoming call |
| `zelpx_leads` | New matching job; lead becomes available; lead no longer available |
| `zelpx_offers` | Contractor offer received; customer approves or declines; contractor offer accepted or declined |
| `zelpx_account` | Phone verification; contractor application received; license/insurance review approved or rejected; profile change approved or rejected; account blocked/unblocked |
| `zelpx_payments` | Lead purchase; payment success/failure; wallet credit/debit; refund or payout status |
| `zelpx_general` | Service request status; important ZELPX system announcements |

Every server event must be authorized from trusted database state, target only the intended user/device, avoid exposing customer contact details in lock-screen text, and be idempotent so retries do not send duplicate alerts. The Admin Panel remains web-only; administrator alerts should continue through its existing secure web push path and must not be routed to Customer/Contractor mobile accounts.

The app stores up to 30 notifications received while active or opened from the Android notification tray in local device storage. Android's system notification tray remains the source for notifications received while the app is backgrounded or closed. A server-backed cross-device inbox and read/unread synchronization are not implemented yet.
