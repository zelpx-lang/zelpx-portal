#!/usr/bin/env python3
"""Integrate isolated ZELPX native call scaffold into a generated Bubblewrap Android project."""
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
ANDROID = ROOT / "android"
APP = ANDROID / "app"
SRC = ROOT / "android-native-call" / "src" / "main" / "java" / "com" / "zelpx" / "app" / "calls"
DEST = APP / "src" / "main" / "java" / "com" / "zelpx" / "app" / "calls"
MANIFEST = APP / "src" / "main" / "AndroidManifest.xml"
GOOGLE_JSON = ROOT / "android-native-call" / "google-services.json"

for required in (ANDROID / "build.gradle", APP / "build.gradle", MANIFEST, GOOGLE_JSON):
    if not required.exists():
        raise SystemExit(f"Required Bubblewrap/Firebase file missing: {required}")

# Firebase config is public client configuration; service-account private key is never copied here.
shutil.copy2(GOOGLE_JSON, APP / "google-services.json")
DEST.mkdir(parents=True, exist_ok=True)
for source in SRC.glob("*.kt"):
    shutil.copy2(source, DEST / source.name)

# Add root Gradle plugin classpaths without overwriting existing build configuration.
root_gradle = ANDROID / "build.gradle"
root_text = root_gradle.read_text()
if "com.google.gms:google-services" not in root_text:
    match = re.search(r"dependencies\s*\{", root_text)
    if not match:
        raise SystemExit("Cannot find root buildscript dependencies block")
    root_text = root_text[:match.end()] + "\n        classpath 'com.google.gms:google-services:4.4.2'\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21'" + root_text[match.end():]
root_gradle.write_text(root_text)

app_gradle = APP / "build.gradle"
app_text = app_gradle.read_text()
for plugin in ("org.jetbrains.kotlin.android", "com.google.gms.google-services"):
    if plugin not in app_text:
        app_text += f"\napply plugin: '{plugin}'\n"
if "com.google.firebase:firebase-messaging" not in app_text:
    match = re.search(r"dependencies\s*\{", app_text)
    if not match:
        app_text += "\ndependencies {\n    implementation platform('com.google.firebase:firebase-bom:34.0.0')\n    implementation 'com.google.firebase:firebase-messaging'\n    implementation 'androidx.core:core-ktx:1.16.0'\n}\n"
    else:
        app_text = app_text[:match.end()] + "\n    implementation platform('com.google.firebase:firebase-bom:34.0.0')\n    implementation 'com.google.firebase:firebase-messaging'\n    implementation 'androidx.core:core-ktx:1.16.0'" + app_text[match.end():]
# Align Java bytecode target with the Kotlin 17 target used by Firebase/Kotlin plugin.
android_match = re.search(r"android\\s*\\{", app_text)
if not android_match:
    raise SystemExit("Cannot find app android { } Gradle block")
compile_options = """
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
"""
if "sourceCompatibility JavaVersion.VERSION_17" not in app_text:
    app_text = app_text[:android_match.end()] + compile_options + app_text[android_match.end():]
app_gradle.write_text(app_text)

# Merge only required manifest entries; preserve Bubblewrap's existing activities and metadata.
ET.register_namespace("android", "http://schemas.android.com/apk/res/android")
ns = "{http://schemas.android.com/apk/res/android}"
tree = ET.parse(MANIFEST)
manifest = tree.getroot()
existing_permissions = {e.get(ns + "name") for e in manifest.findall("uses-permission")}
for permission in (
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.USE_FULL_SCREEN_INTENT",
    "android.permission.VIBRATE",
):
    if permission not in existing_permissions:
        ET.SubElement(manifest, "uses-permission", {ns + "name": permission})

application = manifest.find("application")
if application is None:
    raise SystemExit("AndroidManifest.xml has no application element")
existing_services = {e.get(ns + "name") for e in application.findall("service")}
if "com.zelpx.app.calls.ZelpxMessagingService" not in existing_services:
    service = ET.SubElement(application, "service", {
        ns + "name": "com.zelpx.app.calls.ZelpxMessagingService",
        ns + "exported": "false",
    })
    filt = ET.SubElement(service, "intent-filter")
    ET.SubElement(filt, "action", {ns + "name": "com.google.firebase.MESSAGING_EVENT"})
existing_activities = {e.get(ns + "name") for e in application.findall("activity")}
if "com.zelpx.app.calls.IncomingCallActivity" not in existing_activities:
    ET.SubElement(application, "activity", {
        ns + "name": "com.zelpx.app.calls.IncomingCallActivity",
        ns + "exported": "false",
        ns + "excludeFromRecents": "true",
        ns + "launchMode": "singleTop",
        ns + "showWhenLocked": "true",
        ns + "turnScreenOn": "true",
    })
existing_receivers = {e.get(ns + "name") for e in application.findall("receiver")}
if "com.zelpx.app.calls.CallActionReceiver" not in existing_receivers:
    ET.SubElement(application, "receiver", {
        ns + "name": "com.zelpx.app.calls.CallActionReceiver",
        ns + "exported": "false",
    })
tree.write(MANIFEST, encoding="utf-8", xml_declaration=True)
print("Native ZELPX call scaffold integrated into generated Android project.")
