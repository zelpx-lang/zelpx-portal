import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";

type AccountType = "customer" | "contractor";

export default function App() {
  const [accountType, setAccountType] = useState<AccountType>("customer");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F5" />
      <View style={styles.container}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>Z</Text>
        </View>
        <Text style={styles.brand}>ZELPX</Text>
        <Text style={styles.tagline}>Trusted help for every home project.</Text>

        <Text style={styles.heading}>Welcome</Text>
        <Text style={styles.description}>
          Choose how you want to use ZELPX.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: accountType === "customer" }}
          onPress={() => setAccountType("customer")}
          style={[
            styles.choice,
            accountType === "customer" && styles.choiceSelected,
          ]}
        >
          <View style={styles.choiceIcon}>
            <Text style={styles.choiceIconText}>⌂</Text>
          </View>
          <View style={styles.choiceCopy}>
            <Text style={styles.choiceTitle}>I'm a Customer</Text>
            <Text style={styles.choiceDescription}>
              Find trusted professionals for your project.
            </Text>
          </View>
          <Text style={styles.radio}>
            {accountType === "customer" ? "●" : "○"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: accountType === "contractor" }}
          onPress={() => setAccountType("contractor")}
          style={[
            styles.choice,
            accountType === "contractor" && styles.choiceSelected,
          ]}
        >
          <View style={styles.choiceIcon}>
            <Text style={styles.choiceIconText}>⌁</Text>
          </View>
          <View style={styles.choiceCopy}>
            <Text style={styles.choiceTitle}>I'm a Contractor</Text>
            <Text style={styles.choiceDescription}>
              Find projects and grow your business.
            </Text>
          </View>
          <Text style={styles.radio}>
            {accountType === "contractor" ? "●" : "○"}
          </Text>
        </Pressable>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Mobile app foundation</Text>
          <Text style={styles.noticeText}>
            Account selection is the first native screen. Secure sign-in,
            phone verification, customer and contractor dashboards, and
            Supabase connections are added in the next development steps.
          </Text>
        </View>

        <Text style={styles.footer}>Built for homeowners and professionals.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F7F5" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 24,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#F36B32",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  brandMarkText: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  brand: {
    marginTop: 12,
    textAlign: "center",
    color: "#202522",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 3,
  },
  tagline: {
    marginTop: 7,
    textAlign: "center",
    color: "#777D78",
    fontSize: 14,
  },
  heading: {
    marginTop: 54,
    color: "#202522",
    fontSize: 30,
    fontWeight: "800",
  },
  description: { marginTop: 8, marginBottom: 24, color: "#777D78", fontSize: 15 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7E3",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  choiceSelected: { borderColor: "#F36B32", backgroundColor: "#FFF8F4" },
  choiceIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FFF0E8",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceIconText: { color: "#E85E27", fontSize: 25, fontWeight: "700" },
  choiceCopy: { flex: 1, marginLeft: 13 },
  choiceTitle: { color: "#252B27", fontSize: 16, fontWeight: "700" },
  choiceDescription: { color: "#777D78", fontSize: 12, marginTop: 5 },
  radio: { color: "#E85E27", fontSize: 21, marginLeft: 8 },
  notice: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#ECEFEB",
  },
  noticeTitle: { color: "#343B36", fontWeight: "700", fontSize: 13 },
  noticeText: { color: "#626A64", fontSize: 12, lineHeight: 18, marginTop: 6 },
  footer: {
    marginTop: "auto",
    paddingTop: 24,
    textAlign: "center",
    color: "#969C97",
    fontSize: 11,
  },
});