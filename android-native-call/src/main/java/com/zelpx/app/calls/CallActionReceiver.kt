package com.zelpx.app.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.NotificationManager
import android.net.Uri

/** Handles Answer/Decline taps from the system notification. */
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val callId = intent.getStringExtra(ZelpxMessagingService.EXTRA_CALL_ID) ?: return
        val conversationId = intent.getStringExtra(ZelpxMessagingService.EXTRA_CONVERSATION_ID) ?: return
        val action = if (intent.action == ACTION_ANSWER) "answer" else "decline"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(callId.hashCode())
        val uri = Uri.parse(
            "https://app.zelpx.com/call?action=$action&call_id=${Uri.encode(callId)}" +
                "&conversation_id=${Uri.encode(conversationId)}"
        )
        context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    companion object {
        const val ACTION_ANSWER = "com.zelpx.app.calls.ANSWER"
        const val ACTION_DECLINE = "com.zelpx.app.calls.DECLINE"
    }
}
