# ZELPX Native Mobile App

This is the native Android/iOS application workspace. The existing production website and separate web Admin Panel are not modified by mobile development.

## Product structure

- One native app: ZELPX.
- Customers and contractors use the same app and select their workspace after sign-in.
- The Admin Panel remains a separate web application.
- The existing Supabase project remains the source of truth for accounts and marketplace data.

## Implemented foundation

- Native Expo / React Native app scaffold (SDK 58, React Native 0.88).
- Customer / Contractor entry selection.
- Supabase Auth sign-in and customer account registration.
- Persistent native sessions using AsyncStorage.
- Admin-role rejection based on the trusted profiles.role database field.
- No service-role key or other server secret is bundled into the app.

## Not yet implemented

- Native contractor registration and license/insurance review workflow.
- Native phone verification screens (existing verified-phone API flow must be integrated).
- Customer profile/address editor, service request creation, offers, approvals and chat.
- Contractor job feed, lead purchase, wallet, offers and push notifications.
- Stripe checkout / Connect user flows.
- Store-ready signing, screenshots, policy declarations and release bundle.

Do not treat this scaffold as a finished marketplace app. Production database and payment actions must be connected only after the relevant RLS policies and server-side RPC contracts are verified.

## Configuration

Copy .env.example to .env and set:

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Use the Supabase publishable key only. Never use a service-role key or secret key in the mobile app. Keep .env out of Git.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npx expo install --fix
npx expo-doctor
npm start
```

Commit the generated package lockfile after dependency installation. Run on a development build / physical Android device for native integration testing.

## Google Play readiness

Expo SDK 58 targets Android API 36 (with compile SDK 37). Confirm the current Google Play target API requirement in Play Console immediately before submission. Release builds require an EAS project, app signing configuration, a verified privacy policy, Data safety declarations, and completed Play Console testing tracks.
