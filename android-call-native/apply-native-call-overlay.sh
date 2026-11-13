#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
APP="$ANDROID/app"
test -f "$APP/src/main/AndroidManifest.xml"
mkdir -p "$APP/src/main/java/com/zelpx/app"
cp "$ROOT/android-call-native/src/main/java/com/zelpx/app/"*.java "$APP/src/main/java/com/zelpx/app/"

python3 - "$ANDROID/build.gradle" "$APP/build.gradle" "$APP/src/main/AndroidManifest.xml" <<'PY'
from pathlib import Path
import sys
root_gradle, app_gradle, manifest = map(Path, sys.argv[1:])
root = root_gradle.read_text()
app = app_gradle.read_text()
m = manifest.read_text()

# Add Google Services Gradle plugin to the generated root buildscript.
classpath = "classpath 'com.google.gms:google-services:4.4.2'"
if classpath not in root:
    root = root.replace("dependencies {", "dependencies {\n        " + classpath, 1)
    root_gradle.write_text(root)

# Bubblewrap currently generates a plugins DSL with no dependencies block.
if "com.google.firebase:firebase-messaging" not in app:
    app += """
\ndependencies {
    implementation 'androidx.core:core:1.15.0'
    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
"""
# Apply Google Services only when a protected google-services.json was supplied.
if "com.google.gms.google-services" not in app:
    app += """
\nif (file('google-services.json').exists()) {
    apply plugin: 'com.google.gms.google-services'
} else {
    println 'ZELPX: Firebase config not supplied; FCM runtime is not enabled in this build.'
}
"""
app_gradle.write_text(app)

permissions = [
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
    '<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>',
    '<uses-permission android:name="android.permission.VIBRATE"/>'
]
for permission in permissions:
    if permission not in m:
        m = m.replace('<application', permission + '\n    <application', 1)
service = """        <activity android:name=".IncomingCallActivity" android:exported="false"
            android:showWhenLocked="true" android:turnScreenOn="true"
            android:excludeFromRecents="true" />
        <service android:name=".ZelpxCallMessagingService" android:exported="false">
            <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter>
        </service>
"""
if 'android:name=".ZelpxCallMessagingService"' not in m:
    m = m.replace('</application>', service + '    </application>')
manifest.write_text(m)
PY
