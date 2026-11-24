(() => {
  if (window.__zelpxPublicSupportLoaded) return;
  window.__zelpxPublicSupportLoaded = true;
  const SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";
  const FUNCTION_URL = SUPABASE_URL + "/functions/v1/ai-public-support";
  const style = document.createElement("style");
  style.textContent = `
    #zelpx-ai-support-launcher{position:fixed;right:20px;bottom:20px;z-index:99990;border:0;border-radius:999px;background:#f46b2b;color:#fff;min-height:56px;padding:0 21px;font:750 15px Arial,sans-serif;box-shadow:0 8px 28px #40200f38;cursor:pointer}
    #zelpx-ai-support-panel{position:fixed;right:20px;bottom:88px;z-index:99991;width:min(390px,calc(100vw - 28px));height:min(590px,calc(100dvh - 118px));background:#fffdfa;border:1px solid #f0d8c8;border-radius:19px;box-shadow:0 18px 55px #24160f35;display:none;overflow:hidden;font:14px/1.5 Arial,sans-serif;color:#29251f}
    #zelpx-ai-support-panel.open{display:flex;flex-direction:column}#zelpx-ai-support-panel *{box-sizing:border-box}
    .zxs-head{background:#29251f;color:#fff;padding:15px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .zxs-head strong{display:block;font-size:15px}.zxs-head small{color:#f5c9ae}
    .zxs-head button{background:transparent;color:#fff;border:0;font-size:23px;min-width:38px;min-height:38px;cursor:pointer}
    .zxs-messages{padding:14px;overflow:auto;flex:1;background:#fffdfa}
    .zxs-bubble{max-width:90%;padding:10px 12px;border-radius:13px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}
    .zxs-bubble.ai{background:#f5eee8;border:1px solid #eee1d7}.zxs-bubble.user{background:#ffe4d3;margin-left:auto}
    .zxs-status{padding:0 14px 9px;color:#78685f;font-size:12px}
    .zxs-compose{padding:10px;border-top:1px solid #eee1d7;display:flex;gap:8px;align-items:flex-end}
    .zxs-compose textarea{min-width:0;flex:1;resize:none;height:48px;max-height:110px;padding:12px;border:1px solid #decfc5;border-radius:11px;font:14px Arial,sans-serif}
    .zxs-compose button{border:0;border-radius:11px;background:#f46b2b;color:#fff;padding:0 16px;min-height:48px;font-weight:700;cursor:pointer}
    .zxs-compose button:disabled{opacity:.55;cursor:wait}
    .zxs-tools{display:flex;justify-content:flex-end;padding:0 12px 8px}.zxs-tools button{border:0;background:transparent;color:#a64a1b;font-size:12px;text-decoration:underline;cursor:pointer}
    @media(max-width:480px){#zelpx-ai-support-launcher{right:14px;bottom:14px}#zelpx-ai-support-panel{right:8px;bottom:78px;width:calc(100vw - 16px);height:min(590px,calc(100dvh - 98px))}}
  `;
  document.head.appendChild(style);
  const launcher=document.createElement("button");
  launcher.id="zelpx-ai-support-launcher";launcher.type="button";launcher.textContent="💬 Ask ZELPX";
  launcher.setAttribute("aria-expanded","false");launcher.setAttribute("aria-controls","zelpx-ai-support-panel");
  const panel=document.createElement("section");
  panel.id="zelpx-ai-support-panel";panel.setAttribute("aria-label","Ask ZELPX AI Support");
  panel.innerHTML=`
    <div class="zxs-head"><div><strong>Ask ZELPX</strong><small>Questions about home projects & our marketplace</small></div><button type="button" aria-label="Close chat">×</button></div>
    <div class="zxs-messages" aria-live="polite"><div class="zxs-bubble ai">Hi! Welcome to ZELPX 👋 You can ask me about finding a pro, home services, posting a request, or becoming a contractor. No account is needed to chat.</div></div>
    <div class="zxs-status">Chat with us without signing in.</div>
    <div class="zxs-tools"><button type="button">Start a new chat</button></div>
    <form class="zxs-compose"><textarea maxlength="2000" rows="1" placeholder="Ask your question…" aria-label="Your question"></textarea><button type="submit">Send</button></form>
  `;
  document.body.append(launcher,panel);
  const messagesEl=panel.querySelector(".zxs-messages"),status=panel.querySelector(".zxs-status");
  const form=panel.querySelector("form"),input=panel.querySelector("textarea"),send=form.querySelector("button");
  let history=[];
  function bubble(content,role){const el=document.createElement("div");el.className="zxs-bubble "+(role==="assistant"?"ai":"user");el.textContent=content;messagesEl.appendChild(el);messagesEl.scrollTop=messagesEl.scrollHeight;}
  function toggle(open){panel.classList.toggle("open",open);launcher.setAttribute("aria-expanded",String(open));launcher.textContent=open?"Close chat":"💬 Ask ZELPX";if(open)setTimeout(()=>input.focus(),30);}
  launcher.addEventListener("click",()=>toggle(!panel.classList.contains("open")));
  panel.querySelector(".zxs-head button").addEventListener("click",()=>toggle(false));
  panel.querySelector(".zxs-tools button").addEventListener("click",()=>{history=[];messagesEl.replaceChildren();bubble("Hi again! What would you like to know about ZELPX?","assistant");status.textContent="New chat · No sign-in required";input.focus();});
  form.addEventListener("submit",async event=>{
    event.preventDefault();const message=input.value.trim();if(!message||send.disabled)return;
    bubble(message,"user");input.value="";send.disabled=true;send.textContent="…";status.textContent="ZELPX is preparing an answer…";
    try{
      const response=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({message,history:history.slice(-10)})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"The assistant is temporarily unavailable. Please try again.");
      const reply=String(data.reply||"").trim();if(!reply)throw new Error("I couldn't prepare an answer. Please try again.");
      history.push({role:"user",content:message},{role:"assistant",content:reply});history=history.slice(-12);bubble(reply,"assistant");status.textContent="ZELPX AI · General information";
    }catch(error){bubble(error.message||"Something went wrong. Please try again.","assistant");status.textContent="We couldn't send your message.";}
    finally{send.disabled=false;send.textContent="Send";input.focus();}
  });
  input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
})();