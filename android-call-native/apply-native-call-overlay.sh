#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
APP="$ANDROID/app"
test -f "$APP/src/main/AndroidManifest.xml"
mkdir -p "$APP/src/main/java/com/zelpx/app"
cp "$ROOT/android-call-native/src/main/java/com/zelpx/app/"*.java "$APP/src/main/java/com/zelpx/app/"
python3 - "$APP/build.gradle" "$APP/src/main/AndroidManifest.xml" <<'PY'
from pathlib import Path
import sys
gradle = Path(sys.argv[1])
manifest = Path(sys.argv[2])
g = gradle.read_text()
dep = "implementation platform('com.google.firebase:firebase-bom:33.7.0')"
if dep not in g:
    g = g.replace("dependencies {", "dependencies {\n    implementation 'androidx.core:core:1.15.0'\n    " + dep + "\n    implementation 'com.google.firebase:firebase-messaging'\n", 1)
    gradle.write_text(g)
m = manifest.read_text()
permissions = [
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
    '<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>'
]
for p in permissions:
    if p not in m:
        m = m.replace('<application', p + '\n    <application', 1)
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
