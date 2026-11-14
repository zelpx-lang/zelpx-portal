package com.zelpx.app.calls

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

object TokenRegistration {
    private const val TAG = "ZelpxFCM"
    private const val PREFS = "zelpx_call_auth"
    private const val ACCESS_TOKEN = "supabase_access_token"
    private const val SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co"
    private const val SUPABASE_ANON_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb"

    fun saveSessionAndRegister(context: Context, accessToken: String) {
        if (accessToken.isBlank()) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(ACCESS_TOKEN, accessToken).apply()
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> register(context, accessToken, token) }
            .addOnFailureListener { Log.w(TAG, "Could not obtain Firebase device token", it) }
    }

    fun registerSavedSession(context: Context, fcmToken: String) {
        val accessToken = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(ACCESS_TOKEN, null) ?: return
        register(context, accessToken, fcmToken)
    }

    private fun register(context: Context, accessToken: String, fcmToken: String) {
        Thread {
            var connection: HttpURLConnection? = null
            try {
                val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val deviceId = prefs.getString("device_id", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("device_id", it).apply() }
                connection = URL("https://zsrnjkndgbchfxibxiyd.supabase.co/functions/v1/zelpx-fcm-call").openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("apikey", SUPABASE_ANON_KEY)
                connection.setRequestProperty("Authorization", "Bearer " + accessToken)
                val body = JSONObject().put("action", "register_token").put("fcm_token", fcmToken).put("device_id", deviceId).toString()
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                if (code !in 200..299) Log.w(TAG, "FCM registration rejected: HTTP " + code)
                else Log.i(TAG, "Android device registered for ZELPX call alerts")
            } catch (e: Exception) { Log.w(TAG, "FCM device registration failed", e) }
            finally { connection?.disconnect() }
        }.start()
    }
}