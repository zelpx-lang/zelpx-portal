package com.zelpx.app.calls

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.view.Gravity
import android.view.ViewGroup
import android.content.Intent
import android.graphics.Color

/** Native incoming-call UI scaffold. Answer hands off to web; it does not yet accept WebRTC. */
class IncomingCallActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val callId = intent.getStringExtra(ZelpxMessagingService.EXTRA_CALL_ID).orEmpty()
        val conversationId = intent.getStringExtra(ZelpxMessagingService.EXTRA_CONVERSATION_ID).orEmpty()
        val leadId = intent.getStringExtra(ZelpxMessagingService.EXTRA_LEAD_ID).orEmpty()
        val recipientRole = intent.getStringExtra(ZelpxMessagingService.EXTRA_RECIPIENT_ROLE).orEmpty()
        val caller = intent.getStringExtra(ZelpxMessagingService.EXTRA_CALLER) ?: "ZELPX caller"
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 48, 32, 48)
            setBackgroundColor(Color.rgb(25, 25, 25))
        }
        layout.addView(TextView(this).apply {
            text = "Incoming ZELPX audio call\n$caller"
            textSize = 26f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        layout.addView(Button(this).apply {
            text = "Answer"
            setOnClickListener { handoff(callId, conversationId, leadId, recipientRole, "answer") }
        })
        layout.addView(Button(this).apply {
            text = "Decline"
            setOnClickListener { handoff(callId, conversationId, leadId, recipientRole, "decline") }
        })
        setContentView(layout)
    }

    private fun handoff(callId: String, conversationId: String, leadId: String, recipientRole: String, action: String) {
        val destination = if (recipientRole == "customer") "customer?open_lead=" else "?lead="
        val uri = android.net.Uri.parse(
            "https://app.zelpx.com/$destination" + android.net.Uri.encode(leadId) +
                "&action=$action&call_id=" + android.net.Uri.encode(callId) +
                "&conversation_id=" + android.net.Uri.encode(conversationId)
        )
        startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }
}
