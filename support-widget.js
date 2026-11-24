(() => {
  if (window.__zelpxPublicSupportLoaded) return;
  window.__zelpxPublicSupportLoaded = true;
  const SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";
  const FUNCTION_URL = SUPABASE_URL + "/functions/v1/ai-public-support";
  const style = document.createElement("style");
  style.textContent = `
    #zelpx-ai-support-launcher{position:fixed;right:22px;bottom:22px;z-index:99990;border:0;border-radius:999px;background:#f97332;color:#fff;min-height:56px;padding:0 22px;font:650 14px/1 Arial,sans-serif;letter-spacing:.1px;box-shadow:0 8px 24px #f9733240;cursor:pointer;transition:transform .18s,box-shadow .18s}
    #zelpx-ai-support-launcher:hover{transform:translateY(-2px);box-shadow:0 12px 30px #f9733255}
    #zelpx-ai-support-panel{position:fixed;right:22px;bottom:92px;z-index:99991;width:min(400px,calc(100vw - 28px));height:min(650px,calc(100dvh - 118px));background:#101114;border:1px solid #292b31;border-radius:24px;box-shadow:0 24px 70px #0009;display:none;overflow:hidden;font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f5f6f8}
    #zelpx-ai-support-panel.open{display:flex;flex-direction:column}#zelpx-ai-support-panel *{box-sizing:border-box}
    .zxs-head{background:#15161a;color:#fff;padding:17px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #292b31}
    .zxs-brand{display:flex;align-items:center;gap:11px}.zxs-logo{width:38px;height:38px;border-radius:13px;background:#f97332;display:grid;place-items:center;font-size:19px;color:white;box-shadow:0 5px 16px #f9733235}
    .zxs-head strong{display:block;font-size:15px;font-weight:700;letter-spacing:-.2px}.zxs-head small{color:#a5a8b1;font-size:11px}
    .zxs-head button{background:#22242a;color:#c9cbd1;border:1px solid #34363d;border-radius:11px;font-size:20px;width:36px;height:36px;cursor:pointer}
    .zxs-voice-stage{padding:22px 16px 19px;background:linear-gradient(180deg,#191a1f 0%,#141519 100%);text-align:center;border-bottom:1px solid #292b31}
    .zxs-stage-label{color:#9da1ab;font-size:10px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase}
    .zxs-orb-wrap{height:110px;display:flex;align-items:center;justify-content:center;position:relative}
    .zxs-orb{width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#ff9a62 0%,#f97332 52%,#d94d1a 100%);box-shadow:0 0 0 1px #ffffff16,0 10px 35px #f9733240;transition:transform .2s}
    .zxs-orb span{font-size:28px;filter:grayscale(1) brightness(0) invert(1)}
    .zxs-orb.listening{animation:zxs-orb-pulse 1.4s ease-in-out infinite}
    .zxs-wave{position:absolute;display:flex;align-items:center;justify-content:center;gap:5px;height:62px;opacity:0;pointer-events:none;transition:opacity .2s}
    .zxs-wave i{display:block;width:3px;height:9px;border-radius:5px;background:#ff9866;transform:scaleY(.5)}
    .zxs-wave.active{opacity:1}
    .zxs-wave.active i{animation:zxs-wave 650ms ease-in-out infinite alternate}
    .zxs-wave i:nth-child(2n){animation-delay:120ms}.zxs-wave i:nth-child(3n){animation-delay:240ms}.zxs-wave i:nth-child(4n){animation-delay:360ms}
    .zxs-stage-hint{margin-top:3px;color:#c5c7ce;font-size:12px}
    .zxs-messages{padding:14px 14px 8px;overflow:auto;flex:1;background:#101114}
    .zxs-bubble{max-width:90%;padding:11px 13px;border-radius:16px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.55}
    .zxs-bubble.ai{background:#202228;border:1px solid #2d3038;color:#eceef2;border-bottom-left-radius:5px}.zxs-bubble.user{background:#f97332;color:#fff;margin-left:auto;border-bottom-right-radius:5px}
    .zxs-status{padding:7px 15px 8px;color:#8f939d;font-size:11px;background:#101114}
    .zxs-tools{display:flex;justify-content:space-between;align-items:center;padding:6px 14px 11px;gap:8px;background:#101114}
    .zxs-tools button{border:0;background:transparent;color:#aeb1ba;font-size:11px;cursor:pointer}
    .zxs-tools .zxs-voice-toggle{font-weight:650;color:#ff9866;background:#24252b;border:1px solid #363840;border-radius:20px;padding:7px 11px}
    .zxs-compose{padding:12px;border-top:1px solid #292b31;display:flex;gap:8px;align-items:center;background:#17181d}
    .zxs-compose textarea{min-width:0;flex:1;resize:none;height:46px;max-height:110px;padding:13px 14px;border:1px solid #363941;border-radius:14px;font:13px ui-sans-serif,system-ui,sans-serif;background:#22242a;color:#fff;outline:none}
    .zxs-compose textarea::placeholder{color:#858994}.zxs-compose textarea:focus{border-color:#f97332;box-shadow:0 0 0 3px #f9733218}
    .zxs-compose button{border:0;border-radius:14px;background:#f97332;color:#fff;min-height:46px;font-weight:650;cursor:pointer;transition:filter .15s}
    .zxs-compose button:hover{filter:brightness(1.08)}
    .zxs-compose .zxs-mic{width:46px;min-width:46px;padding:0;font-size:19px;border-radius:14px;background:#292b32;border:1px solid #41434c;box-shadow:none}
    .zxs-compose .zxs-mic.listening{background:#b93d32;border-color:#ef766b;box-shadow:0 0 0 4px #d94a3326;animation:zxs-pulse 1.2s infinite}
    .zxs-compose .zxs-send{padding:0 15px}
    .zxs-compose button:disabled{opacity:.5;cursor:wait}
    @keyframes zxs-pulse{50%{box-shadow:0 0 0 8px #c8322410}}
    @keyframes zxs-orb-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 7px #f9733212,0 10px 32px #f9733240}50%{transform:scale(1.06);box-shadow:0 0 0 14px #f9733209,0 12px 42px #f9733260}}
    @keyframes zxs-wave{from{transform:scaleY(.35)}to{transform:scaleY(2.6)}}
    @media(max-width:480px){#zelpx-ai-support-launcher{right:14px;bottom:14px}#zelpx-ai-support-panel{right:8px;bottom:78px;width:calc(100vw - 16px);height:min(690px,calc(100dvh - 98px));border-radius:22px}}
    @media(prefers-reduced-motion:reduce){#zelpx-ai-support-panel *,#zelpx-ai-support-launcher{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);
  const launcher=document.createElement("button");
  launcher.id="zelpx-ai-support-launcher";launcher.type="button";launcher.textContent="💬 Ask ZELPX";
  launcher.setAttribute("aria-expanded","false");launcher.setAttribute("aria-controls","zelpx-ai-support-panel");
  const panel=document.createElement("section");
  panel.id="zelpx-ai-support-panel";panel.setAttribute("aria-label","Ask ZELPX AI Support");
  panel.innerHTML=`
    <div class="zxs-head"><div class="zxs-brand"><div class="zxs-logo">✦</div><div><strong>Ask ZELPX</strong><small>Your home project assistant</small></div></div><button type="button" aria-label="Close chat">×</button></div>
    <div class="zxs-voice-stage"><div class="zxs-stage-label">VOICE ASSISTANT</div><div class="zxs-orb-wrap"><div class="zxs-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="zxs-orb"><span>🎙</span></div></div><div class="zxs-stage-hint">Tap the microphone below and speak</div></div>
    <div class="zxs-messages" aria-live="polite"><div class="zxs-bubble ai">Hi! Welcome to ZELPX 👋 Ask me about finding a pro, home services, posting a request, or becoming a contractor. You can speak or type — no account needed.</div></div>
    <div class="zxs-status">Ready when you are.</div>
    <div class="zxs-tools"><button class="zxs-voice-toggle" type="button" aria-pressed="true">🔊 Voice replies: On</button><button class="zxs-new-chat" type="button">New chat ↻</button></div>
    <form class="zxs-compose"><textarea maxlength="2000" rows="1" placeholder="Type a message…" aria-label="Your question"></textarea><button class="zxs-mic" type="button" aria-label="Start voice input" title="Speak">🎙</button><button class="zxs-send" type="submit">Send</button></form>
  `;
  document.body.append(launcher,panel);
  const messagesEl=panel.querySelector(".zxs-messages"),status=panel.querySelector(".zxs-status");
  const form=panel.querySelector("form"),input=panel.querySelector("textarea"),send=panel.querySelector(".zxs-send"),mic=panel.querySelector(".zxs-mic");
  const voiceToggle=panel.querySelector(".zxs-voice-toggle");
  const orb=panel.querySelector(".zxs-orb"),wave=panel.querySelector(".zxs-wave"),stageHint=panel.querySelector(".zxs-stage-hint");
  let history=[],voiceReplies=true,recognition=null,listening=false,lastReply="";
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const speechSupported=!!SpeechRecognition;
  function bubble(content,role){const el=document.createElement("div");el.className="zxs-bubble "+(role==="assistant"?"ai":"user");el.textContent=content;messagesEl.appendChild(el);messagesEl.scrollTop=messagesEl.scrollHeight;}
  function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel();orb.classList.remove("listening");wave.classList.remove("active");stageHint.textContent="Tap the microphone below and speak";}
  function speak(text){
    if(!voiceReplies||!("speechSynthesis" in window)||!text)return;
    stopSpeaking();const utterance=new SpeechSynthesisUtterance(text);
    const lang=(navigator.language||"en-US");utterance.lang=lang;utterance.rate=1;utterance.pitch=1;
    const voices=window.speechSynthesis.getVoices();
    const base=lang.toLowerCase().split("-")[0];
    const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(base));
    if(voice)utterance.voice=voice;
    window.speechSynthesis.speak(utterance);
  }
  function stopListening(){if(recognition){try{recognition.stop();}catch(_){}}listening=false;mic.classList.remove("listening");mic.setAttribute("aria-label","Start voice input");mic.textContent="🎙";orb.classList.remove("listening");wave.classList.remove("active");stageHint.textContent="Tap the microphone below and speak";}
  function startListening(){
    if(!speechSupported){status.textContent="Voice input is not supported in this browser. Try Chrome on Android or type your question.";return;}
    stopSpeaking();
    try{
      recognition=new SpeechRecognition();recognition.lang=navigator.language||"en-US";recognition.interimResults=true;recognition.continuous=false;
      recognition.onstart=()=>{listening=true;mic.classList.add("listening");mic.setAttribute("aria-label","Stop voice input");mic.textContent="■";orb.classList.add("listening");wave.classList.add("active");stageHint.textContent="Listening… speak now";status.textContent="Listening… Speak now."; };
      recognition.onresult=event=>{
        let finalText="",interim="";
        for(let i=event.resultIndex;i<event.results.length;i++){const transcript=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=transcript;else interim+=transcript;}
        input.value=finalText||interim;
        if(finalText.trim()){input.value=finalText.trim();stopListening();form.requestSubmit();}
      };
      recognition.onerror=event=>{stopListening();status.textContent=event.error==="not-allowed"?"Microphone permission is blocked. Allow microphone access in your browser settings.":"Couldn't hear that clearly. Tap the microphone and try again.";};
      recognition.onend=()=>{if(listening){listening=false;mic.classList.remove("listening");mic.textContent="🎙";mic.setAttribute("aria-label","Start voice input");if(input.value.trim())status.textContent="Tap Send or speak again.";else status.textContent="Tap the microphone and speak your question.";}}
      recognition.start();
    }catch(_){stopListening();status.textContent="Couldn't start the microphone. Check browser permissions and try again.";}
  }
  function toggle(open){panel.classList.toggle("open",open);launcher.setAttribute("aria-expanded",String(open));launcher.textContent=open?"Close chat":"💬 Ask ZELPX";if(open)setTimeout(()=>input.focus(),30);else{stopListening();stopSpeaking();}}
  launcher.addEventListener("click",()=>toggle(!panel.classList.contains("open")));
  panel.querySelector(".zxs-head button").addEventListener("click",()=>toggle(false));
  panel.querySelector(".zxs-new-chat").addEventListener("click",()=>{stopListening();stopSpeaking();history=[];messagesEl.replaceChildren();bubble("Hi again! What would you like to know about ZELPX?","assistant");status.textContent="New chat · No sign-in required";input.focus();});
  voiceToggle.addEventListener("click",()=>{voiceReplies=!voiceReplies;voiceToggle.textContent=voiceReplies?"🔊 Voice replies: On":"🔇 Voice replies: Off";stageHint.textContent=voiceReplies?"Voice answers are on":"Voice answers are off";voiceToggle.setAttribute("aria-pressed",String(voiceReplies));if(!voiceReplies)stopSpeaking();});
  mic.addEventListener("click",()=>{if(listening)stopListening();else startListening();});
  form.addEventListener("submit",async event=>{
    event.preventDefault();const message=input.value.trim();if(!message||send.disabled)return;
    stopListening();stopSpeaking();bubble(message,"user");input.value="";send.disabled=true;send.textContent="…";status.textContent="ZELPX is preparing an answer…";
    try{
      const response=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({message,history:history.slice(-10)})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"The assistant is temporarily unavailable. Please try again.");
      const reply=String(data.reply||"").trim();if(!reply)throw new Error("I couldn't prepare an answer. Please try again.");
      history.push({role:"user",content:message},{role:"assistant",content:reply});history=history.slice(-12);lastReply=reply;bubble(reply,"assistant");status.textContent=voiceReplies?"ZELPX AI · Speaking the answer":"ZELPX AI · General information";stageHint.textContent=voiceReplies?"ZELPX is answering…":"Answer received";speak(reply);
    }catch(error){bubble(error.message||"Something went wrong. Please try again.","assistant");status.textContent="We couldn't send your message.";}
    finally{send.disabled=false;send.textContent="Send";input.focus();}
  });
  input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
  if(!speechSupported){mic.title="Voice input may not be supported in this browser";mic.style.opacity=".65";}
})();