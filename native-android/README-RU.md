# ZELPX Native Android

Отдельный нативный Android-проект. Веб-порталы и Production не изменяются.

## Текущий этап
- Kotlin + Jetpack Compose; интерфейс рисуется нативными Android-компонентами, WebView не используется.
- Выбор роли Customer / Contractor и стартовый экран входа.
- Application ID сохранён: `com.zelpx.app`.
- Supabase URL задан; публичный anon key передаётся только локально через Gradle property.

## Локальная сборка
1. Открыть папку `native-android` в Android Studio.
2. Установить JDK 17 и Android SDK 36.
3. Передать ключ проекта как Gradle property `SUPABASE_ANON_KEY` (не коммитить ключи и файлы подписи).
4. Собрать debug APK.

## Важно
Экран входа пока является UI-заготовкой: кнопка Sign in ещё не подключена к Supabase. Firebase/FCM ещё не подключён. Нельзя выпускать этот промежуточный APK пользователям.
Для обновления текущего приложения в Google Play потребуется подтвердить прежний upload/signing key и проверить Play App Signing. Не заменять старый keystore.
