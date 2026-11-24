(() => {
  if (window.__zelpxSupportWidgetLoaded) return;
  window.__zelpxSupportWidgetLoaded = true;

  const style = document.createElement("style");
  style.textContent = `
    #zelpx-ai-support-launcher{position:fixed;right:20px;bottom:20px;z-index:99990;border:0;border-radius:999px;background:#f46b2b;color:#fff;min-height:54px;padding:0 20px;font:700 15px Arial,sans-serif;box-shadow:0 8px 28px #40200f38;cursor:pointer}
    #zelpx-ai-support-panel{position:fixed;right:20px;bottom:86px;z-index:99991;width:min(380px,calc(100vw - 28px));height:min(560px,calc(100dvh - 120px));background:#fffdfa;border:1px solid #f0d8c8;border-radius:18px;box-shadow:0 18px 55px #24160f35;display:none;overflow:hidden;font:14px/1.45 Arial,sans-serif;color:#29251f}
    #zelpx-ai-support-panel.open{display:flex;flex-direction:column}
    #zelpx-ai-support-panel *{box-sizing:border-box}
    .zxs-head{background:#29251f;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .zxs-head strong{display:block;font-size:15px}.zxs-head small{color:#f5c9ae}
    .zxs-head button{background:transparent;color:#fff;border:0;font-size:22px;min-width:36px;min-height:36px;cursor:pointer}
    .zxs-messages{padding:14px;overflow:auto;flex:1;background:#fffdfa}
    .zxs-bubble{max-width:88%;padding:10px 12px;border-radius:13px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}
    .zxs-bubble.ai{background:#f5eee8;border:1px solid #eee1d7}
    .zxs-bubble.user{background:#ffe4d3;margin-left:auto}
    .zxs-status{padding:0 14px 8px;color:#78685f;font-size:12px}
    .zxs-compose{padding:10px;border-top:1px solid #eee1d7;display:flex;gap:8px;align-items:flex-end}
    .zxs-compose textarea{min-width:0;flex:1;resize:none;height:46px;max-height:110px;padding:11px;border:1px solid #decfc5;border-radius:10px;font:14px Arial,sans-serif}
    .zxs-compose button{border:0;border-radius:10px;background:#f46b2b;color:#fff;padding:0 16px;min-height:46px;font-weight:700;cursor:pointer}
    .zxs-tools{display:flex;justify-content:flex-end;padding:0 12px 8px}
    .zxs-tools button{border:0;background:transparent;color:#a64a1b;font-size:12px;text-decoration:underline;cursor:pointer}
    @media(max-width:480px){#zelpx-ai-support-launcher{right:14px;bottom:14px}#zelpx-ai-support-panel{right:8px;bottom:76px;width:calc(100vw - 16px);height:min(560px,calc(100dvh - 96px))}}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement("button");
  launcher.id = "zelpx-ai-support-launcher";
  launcher.type = "button";
  launcher.textContent = "💬 AI Support";
  launcher.setAttribute("aria-expanded","false");

  const panel = document.createElement("section");
  panel.id = "zelpx-ai-support-panel";
  panel.setAttribute("aria-label","ZELPX AI Customer Support");
  panel.innerHTML = `
    <div class="zxs-head"><div><strong>ZELPX AI Support</strong><small>Here to help · 24/7</small></div><button type="button" aria-label="Close support">×</button></div>
    <div class="zxs-messages" aria-live="polite"><div class="zxs-bubble ai">Hi! Welcome to ZELPX. How can I help you today?</div></div>
    <div class="zxs-status">Sign in to start a private support conversation.</div>
    <div class="zxs-tools"><button type="button">Start new conversation</button></div>
    <form class="zxs-compose"><textarea maxlength="2000" rows="1" placeholder="Type your message…" aria-label="Your message"></textarea><button type="submit">Send</button></form>
  `;
  document.body.append(launcher,panel);

  const messages = panel.querySelector(".zxs-messages");
  const status = panel.querySelector(".zxs-status");
  const form = panel.querySelector("form");
  const input = panel.querySelector("textarea");
  const send = form.querySelector("button");
  let conversationId = null;

  function addBubble(text,kind) {
    const bubble = document.createElement("div");
    bubble.className = "zxs-bubble " + kind;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }
  function toggle(open) {
    panel.classList.toggle("open",open);
    launcher.setAttribute("aria-expanded",String(open));
    launcher.textContent = open ? "Close Support" : "💬 AI Support";
    if (open) input.focus();
  }
  launcher.addEventListener("click",async()=>{
    toggle(!panel.classList.contains("open"));
    if (!panel.classList.contains("open")) return;
    try {
      const client = typeof db !== "undefined" ? db : null;
      if (!client) throw new Error("Please refresh the page and sign in again.");
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      status.textContent=data.session ? "Private support conversation" : "Please sign in to your ZELPX account to chat with support.";
    } catch(e) { status.textContent=e.message || "Unable to check your sign-in."; }
  });
  panel.querySelector(".zxs-head button").addEventListener("click",()=>toggle(false));
  panel.querySelector(".zxs-tools button").addEventListener("click",()=>{
    conversationId=null;
    messages.replaceChildren();
    addBubble("Hi! Welcome to ZELPX. How can I help you today?","ai");
    status.textContent="New private conversation";
  });
  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    const message=input.value.trim();
    if(!message || send.disabled) return;
    const client=typeof db !== "undefined" ? db : null;
    if(!client){status.textContent="Support could not connect. Please refresh the page.";return;}
    const {data:sessionData,error:sessionError}=await client.auth.getSession();
    if(sessionError || !sessionData.session){status.textContent="Please sign in to your ZELPX account before sending a message.";return;}
    addBubble(message,"user");
    input.value="";
    send.disabled=true;
    send.textContent="…";
    status.textContent="ZELPX AI is typing…";
    try {
      const {data,error}=await client.functions.invoke("ai-customer-support",{
        body:{message,conversation_id:conversationId}
      });
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      conversationId=data.conversation_id;
      addBubble(data.reply || "I’m sorry, I couldn’t prepare a reply. Please try again.","ai");
      status.textContent=data.handoff ? "Your request has been marked for the support team." : "ZELPX AI Support · Private conversation";
    } catch(e) {
      addBubble(e.message || "Support is temporarily unavailable. Please try again.","ai");
      status.textContent="Message could not be sent.";
    } finally {
      send.disabled=false;
      send.textContent="Send";
      input.focus();
    }
  });
  input.addEventListener("keydown",event=>{
    if(event.key==="Enter" && !event.shiftKey){event.preventDefault();form.requestSubmit();}
  });
})();