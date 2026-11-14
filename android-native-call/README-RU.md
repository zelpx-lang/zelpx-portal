# ZELPX — подготовка нативных входящих звонков Android

Изолированный подготовительный модуль. Он НЕ подключён к текущей TWA-сборке и не меняет сайт, Vercel или production Edge Function.

## Подготовлено
- FirebaseMessagingService для приёма FCM data-сообщений.
- Системное уведомление входящего звонка с Answer / Decline и full-screen Activity.
- Обработчик действий Answer / Decline, передающий call_id и conversation_id в deep link.
- Manifest permissions и зависимости для будущего Android-модуля.

## Что ещё обязательно интегрировать
1. Включить код в настоящий Android app module, сохранив applicationId com.zelpx.app и существующий upload signing key.
2. Положить Firebase Console google-services.json в корень app-модуля; service-account JSON сюда НЕ добавлять.
3. Подключить Google Services Gradle plugin и Firebase Messaging BoM.
4. Реализовать регистрацию FCM token после входа и безопасное сохранение с user_id/device_id; обновлять токен и удалять связь при logout.
5. Создать таблицу FCM-токенов с RLS и отдельную Edge Function для FCM HTTP v1. Существующую send-chat-push пока не заменять.
6. На сервере проверять пользователя и доступ к conversation перед отправкой.
7. Реализовать WebRTC signaling: Answer должен принять вызов и подключить offer/answer/ICE. Текущий код только открывает deep link — он НЕ устанавливает аудиосоединение.
8. Добавить cancel/timeout, завершение уведомления при answer, защиту от повторного call_id и синхронизацию состояния.
9. Настроить TURN для надёжного WebRTC через мобильные сети/NAT.
10. Запросить POST_NOTIFICATIONS. Для Android 14+ проверить full-screen intent и выполнить Play Console declaration; при отказе показывать обычное уведомление.

## Ограничения
- FCM не гарантирует доставку при force-stop, отсутствии сети или ограничениях устройства.
- Full-screen intent ограничен Android/Google Play и допустим только для настоящих входящих VoIP-звонков.
- Это подготовительный код, не production-ready. Не публиковать до интеграции и тестов на двух физических устройствах.
- Не коммитить service-account JSON, приватные ключи, keystore или пароли.
