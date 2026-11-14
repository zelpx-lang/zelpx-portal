package com.zelpx.app.calls

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.NotificationCompat.CallStyle
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** FCM receiver scaffold. Token registration and WebRTC signaling still need integration. */
class ZelpxMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Uses the authenticated session handed off by the ZELPX TWA page.
        // Never log the FCM token or the user access token.
        TokenRegistration.registerSavedSession(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        if (data["type"] != "incoming_call") return
        val callId = data["call_id"] ?: return
        val conversationId = data["conversation_id"] ?: return
        val leadId = data["lead_id"] ?: return
        val recipientRole = data["recipient_role"] ?: return
        val callerName = data["caller_name"]?.take(80)?.ifBlank { "ZELPX caller" } ?: "ZELPX caller"
        showIncomingCall(callId, conversationId, leadId, recipientRole, callerName)
    }

    private fun showIncomingCall(callId: String, conversationId: String, leadId: String, recipientRole: String, callerName: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Incoming ZELPX audio calls"
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
            )
        }
        val person = Person.Builder().setName(callerName).setImportant(true).build()
        val answer = actionIntent(CallActionReceiver.ACTION_ANSWER, callId, conversationId, leadId, recipientRole)
        val decline = actionIntent(CallActionReceiver.ACTION_DECLINE, callId, conversationId, leadId, recipientRole)
        val fullScreen = Intent(this, IncomingCallActivity::class.java).apply {
            putExtra(EXTRA_CALL_ID, callId)
            putExtra(EXTRA_CONVERSATION_ID, conversationId)
            putExtra(EXTRA_LEAD_ID, leadId)
            putExtra(EXTRA_RECIPIENT_ROLE, recipientRole)
            putExtra(EXTRA_CALLER, callerName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPending = PendingIntent.getActivity(
            this, callId.hashCode(), fullScreen,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Incoming ZELPX call")
            .setContentText("$callerName is calling")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPending, true)
            .setStyle(CallStyle.forIncomingCall(person, decline, answer))
            .build()
        manager.notify(callId.hashCode(), notification)
    }

    private fun actionIntent(action: String, callId: String, conversationId: String, leadId: String, recipientRole: String): PendingIntent {
        val intent = Intent(this, CallActionReceiver::class.java).apply {
            this.action = action
            putExtra(EXTRA_CALL_ID, callId)
            putExtra(EXTRA_CONVERSATION_ID, conversationId)
            putExtra(EXTRA_LEAD_ID, leadId)
            putExtra(EXTRA_RECIPIENT_ROLE, recipientRole)
        }
        return PendingIntent.getBroadcast(
            this, (callId + action).hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        private const val TAG = "ZelpxFCM"
        const val CHANNEL_ID = "zelpx_incoming_calls_v1"
        const val EXTRA_CALL_ID = "call_id"
        const val EXTRA_CONVERSATION_ID = "conversation_id"
        const val EXTRA_CALLER = "caller_name"
        const val EXTRA_LEAD_ID = "lead_id"
        const val EXTRA_RECIPIENT_ROLE = "recipient_role"
    }
}
