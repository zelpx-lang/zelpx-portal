(() => {
  if (window.__zelpxPublicSupportLoaded) return;
  window.__zelpxPublicSupportLoaded = true;
  const SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";
  const FUNCTION_URL = SUPABASE_URL + "/functions/v1/ai-public-support";
  const style = document.createElement("style");
  style.textContent = `
    #zelpx-ai-support-launcher{position:fixed;right:20px;bottom:20px;z-index:99990;border:0;border-radius:999px;background:linear-gradient(135deg,#ff8746,#e85a1b);color:#fff;min-height:58px;padding:0 23px;font:750 15px Arial,sans-serif;box-shadow:0 10px 30px #e85a1b45;cursor:pointer}
    #zelpx-ai-support-panel{position:fixed;right:20px;bottom:90px;z-index:99991;width:min(410px,calc(100vw - 28px));height:min(680px,calc(100dvh - 118px));background:#171512;border:1px solid #3b3028;border-radius:26px;box-shadow:0 22px 65px #120b0780;display:none;overflow:hidden;font:14px/1.5 Arial,sans-serif;color:#f8f2ec}
    #zelpx-ai-support-panel.open{display:flex;flex-direction:column}#zelpx-ai-support-panel *{box-sizing:border-box}
    .zxs-head{background:radial-gradient(ellipse at 50% -80%,#754026 0%,#29231e 60%,#201c18 100%);color:#fff;padding:18px 18px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #49372a}
    .zxs-brand{display:flex;align-items:center;gap:11px}.zxs-logo{width:39px;height:39px;border-radius:14px;background:linear-gradient(145deg,#ff9a58,#e65c1b);display:grid;place-items:center;font-size:20px;box-shadow:0 5px 18px #f46b2b55}
    .zxs-head strong{display:block;font-size:17px;letter-spacing:.1px}.zxs-head small{color:#d9bda9;font-size:12px}
    .zxs-head button{background:#ffffff12;color:#fff;border:1px solid #ffffff1c;border-radius:50%;font-size:22px;width:38px;height:38px;cursor:pointer}
    .zxs-voice-stage{padding:19px 16px 16px;background:radial-gradient(ellipse at 50% 15%,#483023 0%,#24201b 48%,#1b1916 100%);text-align:center;border-bottom:1px solid #3c3027}
    .zxs-stage-label{color:#f5c9a9;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}
    .zxs-orb-wrap{height:102px;display:flex;align-items:center;justify-content:center;position:relative}
    .zxs-orb{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 28%,#ffbd86 0%,#ff813d 34%,#e65319 72%,#9e3516 100%);box-shadow:0 0 0 9px #f46b2b12,0 0 38px #f46b2b65,inset 0 2px 8px #fff8;transition:transform .2s}
    .zxs-orb span{font-size:30px;filter:drop-shadow(0 2px 3px #76290f66)}
    .zxs-orb.listening{animation:zxs-orb-pulse 1.35s infinite}
    .zxs-wave{position:absolute;display:flex;align-items:center;justify-content:center;gap:4px;height:54px;opacity:.28;pointer-events:none}
    .zxs-wave i{display:block;width:3px;height:9px;border-radius:4px;background:#ff9a5e;transform:scaleY(.5)}
    .zxs-wave.active{opacity:1}
    .zxs-wave.active i{animation:zxs-wave 650ms ease-in-out infinite alternate}
    .zxs-wave i:nth-child(2n){animation-delay:120ms}.zxs-wave i:nth-child(3n){animation-delay:240ms}.zxs-wave i:nth-child(4n){animation-delay:360ms}
    .zxs-stage-hint{margin-top:4px;color:#e8d7ca;font-size:13px}
    .zxs-messages{padding:12px 14px;overflow:auto;flex:1;background:#191714}
    .zxs-bubble{max-width:91%;padding:11px 13px;border-radius:16px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.5}
    .zxs-bubble.ai{background:#2b2722;border:1px solid #44372d;color:#f6eee7;border-bottom-left-radius:5px}.zxs-bubble.user{background:linear-gradient(135deg,#ff955b,#e96a2d);color:#24160f;margin-left:auto;border-bottom-right-radius:5px}
    .zxs-status{padding:7px 15px 9px;color:#c9ad99;font-size:12px;background:#191714}
    .zxs-tools{display:flex;justify-content:space-between;align-items:center;padding:7px 14px 10px;gap:8px;background:#191714}
    .zxs-tools button{border:0;background:transparent;color:#f3a477;font-size:12px;cursor:pointer}
    .zxs-tools .zxs-voice-toggle{font-weight:700;background:#2b241e;border:1px solid #4b382b;border-radius:20px;padding:7px 11px}
    .zxs-compose{padding:12px;border-top:1px solid #40342a;display:flex;gap:8px;align-items:center;background:#211d19}
    .zxs-compose textarea{min-width:0;flex:1;resize:none;height:48px;max-height:110px;padding:14px;border:1px solid #514237;border-radius:15px;font:14px Arial,sans-serif;background:#302a24;color:#fff;outline:none}
    .zxs-compose textarea::placeholder{color:#b9a99d}.zxs-compose textarea:focus{border-color:#f18a50;box-shadow:0 0 0 3px #f46b2b20}
    .zxs-compose button{border:0;border-radius:15px;background:linear-gradient(135deg,#ff8b4c,#e95b1b);color:#fff;min-height:48px;font-weight:700;cursor:pointer;box-shadow:0 5px 15px #e85a1b35}
    .zxs-compose .zxs-mic{width:50px;min-width:50px;padding:0;font-size:21px;border-radius:50%;background:#33271f;border:1px solid #755039;box-shadow:none}
    .zxs-compose .zxs-mic.listening{background:#b83728;border-color:#fa806a;box-shadow:0 0 0 5px #d94a3326;animation:zxs-pulse 1.2s infinite}
    .zxs-compose .zxs-send{padding:0 17px}
    .zxs-compose button:disabled{opacity:.55;cursor:wait}
    @keyframes zxs-pulse{50%{box-shadow:0 0 0 9px #c8322410}}
    @keyframes zxs-orb-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 8px #f46b2b18,0 0 35px #f46b2b70}50%{transform:scale(1.08);box-shadow:0 0 0 16px #f46b2b0c,0 0 55px #ff8b4caa}}
    @keyframes zxs-wave{from{transform:scaleY(.35)}to{transform:scaleY(2.8)}}
    @media(max-width:480px){#zelpx-ai-support-launcher{right:14px;bottom:14px}#zelpx-ai-support-panel{right:8px;bottom:78px;width:calc(100vw - 16px);height:min(720px,calc(100dvh - 98px));border-radius:23px}}
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