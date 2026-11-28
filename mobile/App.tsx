import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { supabase, supabaseConfigReady } from "./lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NOTIFICATION_CHANNELS = [
  { id: "zelpx_messages", name: "Messages" },
  { id: "zelpx_leads", name: "New jobs and leads" },
  { id: "zelpx_offers", name: "Offers and approvals" },
  { id: "zelpx_account", name: "Account and verification" },
  { id: "zelpx_payments", name: "Payments and purchases" },
  { id: "zelpx_general", name: "ZELPX updates" },
] as const;

type LocalNotification = { id: string; title: string; body: string; receivedAt: string; data?: Record<string, unknown> };
const NOTIFICATION_HISTORY_KEY = "zelpx_notification_history_v1";
type AccountType = "customer" | "contractor";
type Mode = "welcome" | "login" | "signup" | "signed-in";

export default function App() {
  const [accountType, setAccountType] = useState<AccountType>("customer");
  const [mode, setMode] = useState<Mode>("welcome");
  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("Notifications are not enabled on this device.");
  const [notificationHistory, setNotificationHistory] = useState<LocalNotification[]>([]);
  const [notificationOpenStatus, setNotificationOpenStatus] = useState("");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY).then((saved) => {
      if (!active || !saved) return;
      try { setNotificationHistory(JSON.parse(saved).slice(0, 30)); } catch { /* ignore invalid local cache */ }
    });
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const item: LocalNotification = {
        id: notification.request.identifier,
        title: content.title || "ZELPX notification",
        body: content.body || "",
        receivedAt: new Date().toISOString(),
        data: content.data as Record<string, unknown>,
      };
      setNotificationHistory((previous) => {
        const next = [item, ...previous.filter((entry) => entry.id !== item.id)].slice(0, 30);
        AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const notification = event.notification;
      const content = notification.request.content;
      setNotificationOpenStatus(content.title || "Notification opened.");
      const item: LocalNotification = {
        id: notification.request.identifier,
        title: content.title || "ZELPX notification",
        body: content.body || "",
        receivedAt: new Date().toISOString(),
        data: content.data as Record<string, unknown>,
      };
      setNotificationHistory((previous) => {
        const next = [item, ...previous.filter((entry) => entry.id !== item.id)].slice(0, 30);
        AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    });
    return () => { active = false; received.remove(); response.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      Promise.all(NOTIFICATION_CHANNELS.map((channel) =>
        Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          vibrationPattern: [0, 250, 150, 250],
          enableVibrate: true,
          showBadge: true,
        })
      )).catch(() => setNotificationStatus("Could not prepare Android notification channels."));
    }
  }, []);

  async function enableNotifications() {
    if (!session) return;
    setNotificationBusy(true);
    setNotificationStatus("Setting up sound notifications…");
    try {
      if (Platform.OS !== "android") {
        throw new Error("Android push delivery is connected first. iPhone notifications will be enabled in the next release stage.");
      }
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status !== "granted") {
        throw new Error("Notification permission was not granted. Allow notifications for ZELPX in Android Settings.");
      }

      const nativeToken = await Notifications.getDevicePushTokenAsync();
      const fcmToken = String(nativeToken.data || "");
      if (!fcmToken) throw new Error("Android did not return an FCM device token. Check Firebase Android app configuration.");

      let deviceId = await AsyncStorage.getItem("zelpx_fcm_device_id");
      if (!deviceId) {
        deviceId = "android-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
        await AsyncStorage.setItem("zelpx_fcm_device_id", deviceId);
      }
      const { error } = await supabase.functions.invoke("zelpx-fcm-call", {
        body: { action: "register_token", fcm_token: fcmToken, device_id: deviceId },
      });
      if (error) throw error;

      setNotificationStatus("Sound notifications are enabled on this Android device.");
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "ZELPX notifications enabled",
          body: "Sound alerts are ready on this device.",
          sound: "default",
          data: { channelId: "zelpx_general" },
        },
        trigger: null,
      });
    } catch (error) {
      setNotificationStatus(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setNotificationBusy(false);
    }
  }

  useEffect(() => {
    if (!supabaseConfigReady) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      if (data.session) { setSession(data.session); setMode("signed-in"); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setMode(next ? "signed-in" : "welcome");
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session || !supabaseConfigReady) return;
    let active = true;
    supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
      .then(async ({ data: profile, error }) => {
        if (!active) return;
        if (error || !profile) {
          setMessage("Could not verify your ZELPX account. Please sign in again.");
          await supabase.auth.signOut({ scope: "local" });
          setSession(null);
          setMode("welcome");
          return;
        }
        if (profile.role === "admin") {
          setMessage("Administrator accounts must use the separate ZELPX Admin website.");
          await supabase.auth.signOut({ scope: "local" });
          setSession(null);
          setMode("welcome");
        }
      });
    return () => { active = false; };
  }, [session]);

  async function submitAuth() {
    if (!supabaseConfigReady) {
      setMessage("Supabase setup is required. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to mobile/.env.");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) { setMessage("Enter your email and password."); return; }
    if (mode === "signup" && accountType !== "customer") {
      setMessage("Contractor registration requires company details, service areas, and license verification. Existing contractors can sign in; native contractor registration is being built.");
      return;
    }
    if (mode === "signup" && (!fullName.trim() || !phone.trim())) { setMessage("Enter your full name and phone number."); return; }
    if (mode === "signup" && password.length < 8) { setMessage("Use a password with at least 8 characters."); return; }

    setBusy(true); setMessage("");
    try {
      if (mode === "signup") {
        // This matches the existing customer portal signup contract.
        // The database profile role is authoritative; user metadata is never authorization.
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail, password,
          options: { data: { full_name: fullName.trim(), phone: phone.trim(), account_type: "customer" } },
        });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("This email is already registered. Please sign in to your existing account.");
        }
        if (!data.session) {
          setMessage("Registration submitted. Check your email to confirm your account, then sign in.");
          setMode("login"); return;
        }
        setSession(data.session); setMode("signed-in"); return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("No active session was returned. Please try again.");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role === "admin") {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("Administrator accounts must use the separate ZELPX Admin website.");
      }
      setSession(data.session); setMode("signed-in");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    setBusy(false);
    if (error) setMessage(error.message);
    setSession(null); setMode("welcome");
  }

  const accountLabel = accountType === "customer" ? "Customer" : "Contractor";

  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.logo}><Text style={s.logoText}>Z</Text></View>
        <Text style={s.brand}>ZELPX</Text>
        <Text style={s.tagline}>Trusted help for every home project.</Text>

        {!supabaseConfigReady && <View style={s.warning}>
          <Text style={s.warningTitle}>Setup required</Text>
          <Text style={s.smallText}>Add your Supabase URL and publishable key to mobile/.env before testing authentication.</Text>
        </View>}

        {mode === "welcome" && <>
          <Text style={s.heading}>Welcome</Text>
          <Text style={s.subheading}>Choose how you want to use ZELPX.</Text>
          <Choice title="I'm a Customer" subtitle="Find trusted professionals for your project." selected={accountType === "customer"} symbol="⌂" onPress={() => setAccountType("customer")} />
          <Choice title="I'm a Contractor" subtitle="Find projects and grow your business." selected={accountType === "contractor"} symbol="⌁" onPress={() => setAccountType("contractor")} />
          <Pressable style={s.primary} onPress={() => { setMode("login"); setMessage(""); }}><Text style={s.primaryText}>Continue</Text></Pressable>
          <Text style={s.helper}>One ZELPX account can access Customer and Contractor experiences. Admin stays separate.</Text>
        </>}

        {(mode === "login" || mode === "signup") && <>
          <Pressable onPress={() => { setMode("welcome"); setMessage(""); }}><Text style={s.back}>‹  Back</Text></Pressable>
          <Text style={s.heading}>{mode === "login" ? "Welcome back" : "Create your account"}</Text>
          <Text style={s.subheading}>{mode === "login" ? "Sign in to your " + accountLabel + " account." : "Create your ZELPX customer account."}</Text>
          {mode === "signup" && <>
            <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" />
          </>}
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
          <Pressable disabled={busy} style={[s.primary, busy && s.disabled]} onPress={submitAuth}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{mode === "login" ? "Sign In" : "Create Account"}</Text>}
          </Pressable>
          {accountType === "customer" && <Pressable onPress={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
            <Text style={s.switchText}>{mode === "login" ? "New to ZELPX? Create an account" : "Already have an account? Sign in"}</Text>
          </Pressable>}
          {mode === "signup" && accountType === "contractor" && <Text style={s.helper}>Contractor registration with company information, service areas, and license verification is the next dedicated mobile flow. Existing contractors can sign in now.</Text>}
        </>}

        {mode === "signed-in" && session && <View style={s.panel}>
          <Text style={s.heading}>You're signed in</Text>
          <Text style={s.subheading}>{session.user.email}</Text>
          <Text style={s.smallText}>Secure authentication is connected. The Customer and Contractor dashboard modules are the next development stage.</Text>
          <View style={s.panel}>
            <Text style={s.panelTitle}>Notifications & Sounds</Text>
            <Text style={s.smallText}>{notificationStatus}</Text>
            <Pressable style={s.primary} onPress={enableNotifications} disabled={notificationBusy || !session}>
              {notificationBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Enable All Notifications</Text>}
            </Pressable>
            <Text style={s.helper}>Messages, new leads, offers, approvals, account verification, purchases, and ZELPX updates use separate Android notification channels with the default notification sound.</Text>
            <Pressable style={s.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={s.settingsText}>Android Notification Settings</Text>
            </Pressable>
            {!!notificationOpenStatus && <Text style={s.smallText}>{notificationOpenStatus}</Text>}
            <View style={s.historyHeader}>
              <Text style={s.panelTitle}>Recent Notifications</Text>
              <Text style={s.count}>{notificationHistory.length}</Text>
            </View>
            {notificationHistory.length === 0 ? <Text style={s.smallText}>No notifications received on this device yet.</Text> : notificationHistory.slice(0, 8).map((item) =>
              <View key={item.id} style={s.notificationItem}>
                <Text style={s.notificationTitle}>{item.title}</Text>
                {!!item.body && <Text style={s.smallText}>{item.body}</Text>}
                <Text style={s.notificationTime}>{new Date(item.receivedAt).toLocaleString()}</Text>
              </View>
            )}
          </View>
          <Pressable style={s.secondary} onPress={signOut} disabled={busy}><Text style={s.secondaryText}>{busy ? "Signing out…" : "Sign Out"}</Text></Pressable>
        </View>}

        {!!message && <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text>}
        <Text style={s.footer}>Built for homeowners and professionals.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Field(p: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "phone-pad"; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) {
  return <View style={s.field}>
    <Text style={s.fieldLabel}>{p.label}</Text>
    <TextInput value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor="#9A9F9A" secureTextEntry={p.secureTextEntry} keyboardType={p.keyboardType || "default"} autoCapitalize={p.autoCapitalize || "sentences"} autoCorrect={false} style={s.input} />
  </View>;
}
function Choice(p: { title: string; subtitle: string; selected: boolean; symbol: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: p.selected }} onPress={p.onPress} style={[s.choice, p.selected && s.choiceActive]}>
    <View style={s.choiceIcon}><Text style={s.choiceSymbol}>{p.symbol}</Text></View>
    <View style={s.choiceCopy}><Text style={s.choiceTitle}>{p.title}</Text><Text style={s.choiceSubtitle}>{p.subtitle}</Text></View>
    <Text style={s.radio}>{p.selected ? "●" : "○"}</Text>
  </Pressable>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: "#F7F7F5" },
  page: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 24 },
  logo: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#F36B32", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  logoText: { color: "#fff", fontSize: 28, fontWeight: "900" }, brand: { marginTop: 12, textAlign: "center", color: "#202522", fontSize: 28, fontWeight: "900", letterSpacing: 3 },
  tagline: { marginTop: 7, textAlign: "center", color: "#777D78", fontSize: 14 },
  heading: { marginTop: 42, color: "#202522", fontSize: 29, fontWeight: "800" },
  subheading: { marginTop: 8, marginBottom: 22, color: "#777D78", fontSize: 15, lineHeight: 22 },
  choice: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7E3", borderRadius: 18, padding: 16, marginBottom: 14, backgroundColor: "#fff" },
  choiceActive: { borderColor: "#F36B32", backgroundColor: "#FFF8F4" },
  choiceIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#FFF0E8", alignItems: "center", justifyContent: "center" },
  choiceSymbol: { color: "#E85E27", fontSize: 25, fontWeight: "700" }, choiceCopy: { flex: 1, marginLeft: 13 },
  choiceTitle: { color: "#252B27", fontSize: 16, fontWeight: "700" }, choiceSubtitle: { color: "#777D78", fontSize: 12, marginTop: 5, lineHeight: 17 },
  radio: { color: "#E85E27", fontSize: 21, marginLeft: 8 }, primary: { backgroundColor: "#F36B32", minHeight: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 14 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" }, disabled: { opacity: 0.65 },
  helper: { color: "#777D78", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 16 },
  back: { color: "#E85E27", fontWeight: "700", fontSize: 15, marginTop: 10 },
  field: { marginBottom: 14 }, fieldLabel: { color: "#343B36", fontSize: 13, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 50, borderWidth: 1, borderColor: "#E1E4DF", borderRadius: 13, paddingHorizontal: 14, backgroundColor: "#fff", color: "#202522", fontSize: 15 },
  switchText: { color: "#D95E2B", textAlign: "center", fontSize: 14, fontWeight: "700", marginTop: 20 },
  message: { marginTop: 18, padding: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#FFF0E8", color: "#9A3C1C", fontSize: 13, lineHeight: 19 },
  warning: { marginTop: 24, backgroundColor: "#FFF0E8", borderRadius: 14, padding: 14 },
  warningTitle: { color: "#9A3C1C", fontWeight: "800", fontSize: 13 },
  smallText: { color: "#626A64", fontSize: 12, lineHeight: 18, marginTop: 6 },
  panel: { marginTop: 38, backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#E5E7E3" },
  secondary: { borderWidth: 1, borderColor: "#E5E7E3", minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 22 },
  secondaryText: { color: "#252B27", fontSize: 15, fontWeight: "700" },
  settingsButton: { minHeight: 44, borderWidth: 1, borderColor: "#F36B32", borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  settingsText: { color: "#D95E2B", fontWeight: "700", fontSize: 13 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 8 },
  count: { color: "#D95E2B", fontSize: 13, fontWeight: "800" },
  notificationItem: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#EEF0EC" },
  notificationTitle: { color: "#252B27", fontSize: 13, fontWeight: "700" },
  notificationTime: { color: "#969C97", fontSize: 10, marginTop: 5 },
  footer: { marginTop: "auto", paddingTop: 30, textAlign: "center", color: "#969C97", fontSize: 11 },
});