# ZELPX Native Mobile App

This folder is the beginning of the native Android/iOS application. The existing production web portals and the separate web Admin Panel remain untouched.

## Product structure

- One app: ZELPX
- Customer and Contractor account types are selected inside the app
- Admin Panel remains a separate web application
- Existing Supabase project and business data are intended to remain the system of record

## Current status

The first native screen is an account-type selector. It is a UI foundation only; it does not yet authenticate users or perform marketplace actions.

## Planned implementation order

1. Confirm the existing Supabase Auth, profiles, contractors, leads, wallets, and purchase RPC contracts.
2. Add secure Supabase authentication and phone verification.
3. Build Customer profile, address, service request, offers, approval, chat, and order history.
4. Build Contractor profile, verification gating, available jobs, lead purchase, offers, wallet, and notifications.
5. Add secure server-side payment and purchase flows; never put service-role keys in the mobile app.
6. Test on physical Android devices and staging backend.
7. Configure production signing, privacy disclosures, Play Console declarations, and Android App Bundle release.

## Local development

Use Node.js 22.13 or newer with the Expo SDK 58 toolchain. From this directory:

```bash
npm install
npx expo install --fix
npm start
```

Do not connect this app to production data until the database contracts and row-level security policies have been audited. Use a separate staging Supabase project for development and testing.

## Google Play

New app submissions currently need Android 16 / API level 36 or higher. Verify the Play Console requirement again immediately before submission.
