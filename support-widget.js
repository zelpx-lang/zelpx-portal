(() => {
  if (window.__zelpxPublicSupportLoaded) return;
  window.__zelpxPublicSupportLoaded = true;

  const SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";
  const FUNCTION_URL = SUPABASE_URL + "/functions/v1/ai-public-support";

  const style = document.createElement("style");
  style.textContent = `
    #zelpx-ai-support-launcher{position:fixed;right:22px;bottom:22px;z-index:99990;border:0;border-radius:999px;background:linear-gradient(135deg,#ff8758,#f45135);color:#fff;min-height:56px;padding:0 22px;font:700 14px/1 Inter,system-ui,sans-serif;box-shadow:0 10px 30px #f4513545;cursor:pointer;transition:transform .2s,box-shadow .2s}
    #zelpx-ai-support-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 34px #f4513560}
    #zelpx-ai-support-panel{position:fixed;right:22px;bottom:92px;z-index:99991;width:min(410px,calc(100vw - 28px));height:min(650px,calc(100dvh - 118px));background:#101820;border:1px solid #293641;border-radius:25px;box-shadow:0 28px 90px #0009;display:none;overflow:hidden;color:#f5f7f9;font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    #zelpx-ai-support-panel.open{display:flex;flex-direction:column}#zelpx-ai-support-panel *{box-sizing:border-box}
    .zxs-head{flex:0 0 auto;padding:17px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#151f28;border-bottom:1px solid #293641}
    .zxs-brand{display:flex;align-items:center;gap:11px}.zxs-logo{width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#ff986e,#f45135);display:grid;place-items:center;font-size:21px;color:#fff;box-shadow:0 6px 18px #ff6b3d35}
    .zxs-head strong{display:block;font-size:15px;font-weight:750;letter-spacing:-.3px}.zxs-head small{display:flex;align-items:center;gap:6px;color:#aab7c2;font-size:11px}
    .zxs-online{width:7px;height:7px;border-radius:50%;background:#43cf8b;display:inline-block;box-shadow:0 0 0 3px #43cf8b1c}
    .zxs-head button{background:#ffffff0b;color:#dce4eb;border:1px solid #ffffff18;border-radius:11px;font-size:22px;width:36px;height:36px;cursor:pointer}
    .zxs-welcome{padding:18px 18px 8px;color:#aab7c2;font-size:12px}
    .zxs-messages{flex:1;min-height:0;overflow-y:auto;padding:12px 16px 18px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
    .zxs-message{max-width:88%;padding:11px 13px;border-radius:17px;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .zxs-message.assistant{align-self:flex-start;background:#202c36;color:#f0f4f7;border:1px solid #2c3a46;border-bottom-left-radius:5px}
    .zxs-message.user{align-self:flex-end;background:linear-gradient(135deg,#ff8153,#ed5538);color:#fff;border-bottom-right-radius:5px}
    .zxs-message.typing{color:#aebbc5;font-style:italic}
    .zxs-compose{flex:0 0 auto;padding:13px 14px max(14px,env(safe-area-inset-bottom));background:#151f28;border-top:1px solid #293641}
    .zxs-compose form{display:flex;align-items:center;gap:9px;background:#202c36;border:1px solid #34434f;border-radius:17px;padding:7px 7px 7px 13px;transition:border-color .2s}
    .zxs-compose form:focus-within{border-color:#ff8153}
    .zxs-compose textarea{display:block;flex:1;min-width:0;width:100%;height:40px;max-height:112px;min-height:40px;resize:none;overflow-y:auto;box-sizing:border-box;align-self:center;vertical-align:middle;border:0;outline:0;background:transparent;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;caret-color:#ff8758;opacity:1!important;font:13px/1.5 Inter,system-ui,sans-serif;padding:10px 0;margin:0;background:transparent!important;color-scheme:dark}
    .zxs-compose textarea::placeholder{color:#aab7c2!important;-webkit-text-fill-color:#aab7c2!important;opacity:1!important}
    .zxs-send{flex:0 0 40px;width:40px;height:40px;border:0;border-radius:12px;background:linear-gradient(135deg,#ff8758,#f45135);color:#fff;display:grid;place-items:center;cursor:pointer}
    .zxs-send:disabled{opacity:.45;cursor:default}.zxs-send svg{width:18px;height:18px}
    .zxs-footnote{text-align:center;color:#73818d;font-size:10px;margin-top:8px}
    @media(max-width:600px){#zelpx-ai-support-launcher{right:14px;bottom:14px}#zelpx-ai-support-panel{inset:0;width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0;padding-bottom:env(safe-area-inset-bottom)}.zxs-head{padding:14px 16px}.zxs-welcome{padding:14px 16px 6px}.zxs-messages{padding:12px 14px 18px;gap:14px}.zxs-message{max-width:92%;font-size:15px;padding:12px 14px}.zxs-compose{padding:10px 12px max(12px,env(safe-area-inset-bottom))}.zxs-compose form{border-radius:18px;padding:6px 6px 6px 14px}.zxs-compose textarea{font-size:16px;min-height:46px;height:46px;max-height:120px;padding:12px 0}.zxs-send{width:46px;height:46px;flex-basis:46px;border-radius:14px}.zxs-footnote{font-size:10px}}
    @media(prefers-reduced-motion:reduce){#zelpx-ai-support-panel *,#zelpx-ai-support-launcher{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  const launcher=document.createElement("button");
  launcher.id="zelpx-ai-support-launcher";launcher.type="button";launcher.textContent="💬 Chat with ZELPX";
  launcher.setAttribute("aria-expanded","false");launcher.setAttribute("aria-controls","zelpx-ai-support-panel");

  const panel=document.createElement("section");
  panel.id="zelpx-ai-support-panel";panel.setAttribute("aria-label","ZELPX AI Support Chat");
  panel.innerHTML=`
    <div class="zxs-head">
      <div class="zxs-brand"><div class="zxs-logo">✦</div><div><strong>ZELPX Support</strong><small><i class="zxs-online"></i> AI assistant · Online</small></div></div>
      <button type="button" aria-label="Close chat">×</button>
    </div>
    <div class="zxs-welcome">Hi! I'm the ZELPX assistant. How can I help with your home project today?</div>
    <div class="zxs-messages" role="log" aria-live="polite">
      <div class="zxs-message assistant">Welcome to ZELPX! Tell me what service you need, and I'll help you find the right next step.</div>
    </div>
    <div class="zxs-compose">
      <form>
        <textarea rows="1" maxlength="3000" placeholder="Type your message…" aria-label="Your message"></textarea>
        <button class="zxs-send" type="submit" aria-label="Send message" disabled><svg viewBox="0 0 24 24" fill="none"><path d="M4 12 20 4l-5 16-3-7-8-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m12 13 8-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      </form>
      <div class="zxs-footnote">ZELPX AI · Please don't share payment details or passwords</div>
    </div>
  `;
  document.body.append(launcher,panel);

  const messagesEl=panel.querySelector(".zxs-messages");
  const form=panel.querySelector(".zxs-compose form");
  const input=panel.querySelector("textarea");
  input.style.setProperty("color","#ffffff","important");
  input.style.setProperty("-webkit-text-fill-color","#ffffff","important");
  input.style.setProperty("caret-color","#ff8758","important");
  input.style.setProperty("opacity","1","important");
  const sendButton=panel.querySelector(".zxs-send");
  let history=[],busy=false;

  function addMessage(text,role,extraClass=""){
    const node=document.createElement("div");
    node.className="zxs-message "+role+(extraClass?" "+extraClass:"");
    node.textContent=text;
    messagesEl.appendChild(node);
    messagesEl.scrollTop=messagesEl.scrollHeight;
    return node;
  }
  function syncKeyboardViewport(){
    if(window.innerWidth>600||!window.visualViewport)return;
    const vv=window.visualViewport;
    panel.style.height=vv.height+"px";
    panel.style.top=vv.offsetTop+"px";
  }
  if(window.visualViewport){window.visualViewport.addEventListener("resize",syncKeyboardViewport);window.visualViewport.addEventListener("scroll",syncKeyboardViewport);}
  function toggle(open){
    panel.classList.toggle("open",open);
    if(open)syncKeyboardViewport();else{panel.style.height="";panel.style.top="";}
    launcher.setAttribute("aria-expanded",String(open));
    launcher.textContent=open?"Close chat":"💬 Chat with ZELPX";
    if(open)setTimeout(()=>input.focus(),80);
  }
  function resizeInput(){
    input.style.height="auto";
    input.style.height=Math.max(window.innerWidth<=600?46:40,Math.min(input.scrollHeight,120))+"px";
    sendButton.disabled=busy||!input.value.trim();
  }
  input.addEventListener("input",resizeInput);
  input.addEventListener("focus",()=>{input.style.setProperty("color","#ffffff","important");input.style.setProperty("-webkit-text-fill-color","#ffffff","important");});
  input.addEventListener("keydown",event=>{
    if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();form.requestSubmit();}
  });
  launcher.addEventListener("click",()=>toggle(!panel.classList.contains("open")));
  panel.querySelector(".zxs-head button").addEventListener("click",()=>toggle(false));

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const message=input.value.trim();
    if(!message||busy)return;
    addMessage(message,"user");
    history.push({role:"user",content:message});
    input.value="";resizeInput();busy=true;sendButton.disabled=true;
    const typing=addMessage("ZELPX is typing…","assistant","typing");
    try{
      const response=await fetch(FUNCTION_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
        body:JSON.stringify({message,history:history.slice(-10,-1)})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"The assistant is temporarily unavailable. Please try again.");
      const reply=String(data.reply||"").trim();
      if(!reply)throw new Error("I couldn't prepare an answer. Please try again.");
      typing.remove();
      addMessage(reply,"assistant");
      history.push({role:"assistant",content:reply});
      history=history.slice(-12);
    }catch(error){
      typing.remove();
      addMessage(error.message||"Something went wrong. Please try again.","assistant");
      history.pop();
    }finally{
      busy=false;resizeInput();input.focus();
    }
  });
})();