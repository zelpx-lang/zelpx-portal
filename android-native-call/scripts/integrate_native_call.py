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
# Keep Kotlin bytecode compatible with Bubblewrap's Java 8 target.
# The generated TWA app uses Java 8; Kotlin 17 caused compileReleaseKotlin validation failure.
if "KotlinCompile" not in app_text:
    app_text += """
tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
        jvmTarget = "1.8"
    }
}
"""
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
existing_token_activities = {e.get(ns + "name") for e in application.findall("activity")}
if "com.zelpx.app.calls.TokenRegistrationActivity" not in existing_token_activities:
    token_activity = ET.SubElement(application, "activity", {
        ns + "name": "com.zelpx.app.calls.TokenRegistrationActivity",
        ns + "exported": "true",
        ns + "excludeFromRecents": "true",
        ns + "noHistory": "true",
    })
    token_filter = ET.SubElement(token_activity, "intent-filter")
    ET.SubElement(token_filter, "action", {ns + "name": "android.intent.action.VIEW"})
    ET.SubElement(token_filter, "category", {ns + "name": "android.intent.category.DEFAULT"})
    ET.SubElement(token_filter, "category", {ns + "name": "android.intent.category.BROWSABLE"})
    ET.SubElement(token_filter, "data", {ns + "scheme": "zelpx", ns + "host": "register"})
tree.write(MANIFEST, encoding="utf-8", xml_declaration=True)
print("Native ZELPX call scaffold integrated into generated Android project.")
