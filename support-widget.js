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
    .zxs-orb-wrap{height:154px;display:flex;align-items:center;justify-content:center;position:relative;isolation:isolate}
    .zxs-orb{appearance:none;position:relative;z-index:2;width:76px;height:76px;border:1px solid #ffb18b55;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 28%,#ffb27f 0%,#fa783d 38%,#d94b20 100%);color:#fff;box-shadow:0 0 28px #f9733266,inset 0 2px 8px #ffffff45;cursor:pointer;transition:transform .2s,box-shadow .2s}
    .zxs-orb::before,.zxs-orb::after{content:"";position:absolute;inset:-17px;border:1px solid #ff98665c;border-radius:50%;z-index:-1;transition:opacity .2s}
    .zxs-orb::after{inset:-34px;border-color:#ff986638}
    .zxs-orb svg{width:29px;height:29px;display:block;filter:drop-shadow(0 1px 2px #8d351b66)}
    .zxs-orb.listening{transform:scale(1.04);box-shadow:0 0 0 12px #f9733217,0 0 45px #f9733290,inset 0 2px 8px #ffffff55;animation:zxs-orb-pulse 1.6s ease-in-out infinite}
    .zxs-orb.listening::before{animation:zxs-ring 1.8s ease-out infinite}
    .zxs-orb.listening::after{animation:zxs-ring 1.8s ease-out 0.45s infinite}
    .zxs-wave{display:none}
    .zxs-stage-hint{margin-top:3px;color:#c5c7ce;font-size:12px}
    .zxs-messages,.zxs-tools,.zxs-compose{display:none}
    .zxs-status{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px 20px;color:#c5c7ce;font-size:13px;background:#101114;min-height:110px}
    @keyframes zxs-pulse{50%{box-shadow:0 0 0 8px #c8322410}}
    @keyframes zxs-orb-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 7px #f9733212,0 10px 32px #f9733240}50%{transform:scale(1.06);box-shadow:0 0 0 14px #f9733209,0 12px 42px #f9733260}}
    @keyframes zxs-ring{0%{transform:scale(.82);opacity:.8}100%{transform:scale(1.55);opacity:0}}
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
    <div class="zxs-voice-stage"><div class="zxs-stage-label">VOICE ASSISTANT</div><div class="zxs-orb-wrap"><div class="zxs-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><button class="zxs-orb" type="button" aria-label="Start voice input" title="Tap to speak"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div><div class="zxs-stage-hint">Tap the microphone and speak</div></div>
    <div class="zxs-status">Tap the microphone to start a voice conversation.</div>
  `;
  document.body.append(launcher,panel);
  const status=panel.querySelector(".zxs-status");
  const orb=panel.querySelector(".zxs-orb"),wave=panel.querySelector(".zxs-wave"),stageHint=panel.querySelector(".zxs-stage-hint");
  let history=[],recognition=null,listening=false,busy=false;
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const speechSupported=!!SpeechRecognition;

  function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel();orb.classList.remove("listening");wave.classList.remove("active");stageHint.textContent="Tap the microphone and speak";}
  function speak(text){
    if(!("speechSynthesis" in window)||!text)return;
    stopSpeaking();const utterance=new SpeechSynthesisUtterance(text);
    const lang=(navigator.language||"en-US");utterance.lang=lang;utterance.rate=1;utterance.pitch=1;
    const voices=window.speechSynthesis.getVoices();
    const base=lang.toLowerCase().split("-")[0];
    const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(base));
    if(voice)utterance.voice=voice;
    window.speechSynthesis.speak(utterance);
  }
  function stopListening(){if(recognition){try{recognition.stop();}catch(_){}}listening=false;orb.classList.remove("listening");wave.classList.remove("active");orb.setAttribute("aria-label","Start voice input");stageHint.textContent="Tap the microphone and speak";}
  function startListening(){
    if(!speechSupported){status.textContent="Voice input is not supported in this browser. Try Chrome on Android or type your question.";return;}
    stopSpeaking();
    try{
      recognition=new SpeechRecognition();recognition.lang=navigator.language||"en-US";recognition.interimResults=true;recognition.continuous=false;
      recognition.onstart=()=>{listening=true;orb.classList.add("listening");wave.classList.add("active");orb.setAttribute("aria-label","Stop voice input");stageHint.textContent="Listening… speak now";status.textContent="Listening… Speak now."; };
      recognition.onresult=event=>{
        let finalText="",interim="";
        for(let i=event.resultIndex;i<event.results.length;i++){const transcript=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=transcript;else interim+=transcript;}
        if(interim)status.textContent=interim;
        if(finalText.trim()){stopListening();processMessage(finalText.trim());}
      };
      recognition.onerror=event=>{stopListening();status.textContent=event.error==="not-allowed"?"Microphone permission is blocked. Allow microphone access in your browser settings.":"Couldn't hear that clearly. Tap the microphone and try again.";};
      recognition.onend=()=>{if(listening){listening=false;orb.classList.remove("listening");wave.classList.remove("active");orb.setAttribute("aria-label","Start voice input");status.textContent="Tap the microphone and speak your question.";}}
      recognition.start();
    }catch(_){stopListening();status.textContent="Couldn't start the microphone. Check browser permissions and try again.";}
  }
  function toggle(open){panel.classList.toggle("open",open);launcher.setAttribute("aria-expanded",String(open));launcher.textContent=open?"Close chat":"💬 Ask ZELPX";if(open){status.textContent="Tap the microphone to start a voice conversation.";}else{stopListening();stopSpeaking();}}
  launcher.addEventListener("click",()=>toggle(!panel.classList.contains("open")));
  panel.querySelector(".zxs-head button").addEventListener("click",()=>toggle(false));
  orb.addEventListener("click",()=>{if(listening)stopListening();else startListening();});
  async function processMessage(message){if(!message||busy)return;busy=true;
    stopListening();stopSpeaking();status.textContent="ZELPX is preparing your answer…";stageHint.textContent="Thinking…";
    try{
      const response=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({message,history:history.slice(-10)})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"The assistant is temporarily unavailable. Please try again.");
      const reply=String(data.reply||"").trim();if(!reply)throw new Error("I couldn't prepare an answer. Please try again.");
      history.push({role:"user",content:message},{role:"assistant",content:reply});history=history.slice(-12);status.textContent="ZELPX is speaking…";stageHint.textContent="ZELPX is answering…";speak(reply);
    }catch(error){status.textContent=error.message||"Something went wrong. Please try again.";stageHint.textContent="Tap the microphone to try again";}
    finally{busy=false;}
  }
  if(!speechSupported){status.textContent="Voice input is not supported in this browser. Please use Chrome on Android or a supported browser.";orb.disabled=true;orb.style.opacity=".5";}
})();