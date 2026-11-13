# ZELPX native incoming-call prototype

This overlay is applied only to the isolated `feature/android-call-prototype` branch.
It adds a Firebase Messaging receiver and a native incoming-call notification/activity.

## Required before runtime testing
- Add a Firebase Android app for package `com.zelpx.app`.
- Add its `google-services.json` as a protected GitHub Actions secret/file (never commit it publicly).
- Configure Firebase Cloud Messaging credentials on the trusted backend.
- Send high-priority FCM data messages containing `type=zelpx_call`, `call_id`, and optionally `caller_name`.

**Not yet implemented:** authenticated accept/reject signaling, WebRTC media, TURN relay, call lifecycle,
and reliable full-screen behavior on all Android/OEM versions. The current action opens ZELPX;
it does not claim to connect an audio call.
