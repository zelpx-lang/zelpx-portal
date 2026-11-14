# Edge Function zelpx-fcm-call

Отдельная функция, пока НЕ развёрнута. Использует секрет FIREBASE_SERVICE_ACCOUNT_JSON.

Actions:
- register_token: принимает FCM token и device_id только от авторизованного пользователя.
- incoming_call: проверяет право пользователя на conversation, находит user_id получателя и отправляет data-only FCM high-priority push.

Перед staging:
1. Применить миграцию fcm_device_tokens.
2. Развернуть функцию с verify_jwt=true.
3. Зарегистрировать Android FCM token после входа в приложение.
4. Обновить Kotlin onNewToken и старт приложения для вызова register_token.
5. Интегрировать вызов incoming_call с существующим WebRTC call flow только после проверки caller_role и идентификатора звонка.
6. Проверить логи, FCM delivery и Android notification permissions на реальных устройствах.

Важно: эта функция не заменяет send-chat-push. Не развёртывать в production до полного тестирования.
