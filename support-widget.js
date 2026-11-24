(() => {
  if (window.__zelpxPublicSupportLoaded) return;
  window.__zelpxPublicSupportLoaded = true;
  const SUPABASE_URL = "https://zsrnjkndgbchfxibxiyd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_prE7ENnFQaUGIq3h8U_uAQ_V9SjuBnb";
  const FUNCTION_URL = SUPABASE_URL + "/functions/v1/ai-public-support";
  const VOICE_URL = SUPABASE_URL + "/functions/v1/zelpx-voice";
  const style = document.createElement("style");
  style.textContent = `
    #zelpx-ai-support-launcher{position:fixed;right:22px;bottom:22px;z-index:99990;border:0;border-radius:999px;background:#FF6B3D;color:#FFFFFF;min-height:56px;padding:0 22px;font:650 14px/1 Arial,sans-serif;letter-spacing:.1px;box-shadow:0 8px 24px #FF6B3D40;cursor:pointer;transition:transform .18s,box-shadow .18s}
    #zelpx-ai-support-launcher:hover{transform:translateY(-2px);box-shadow:0 12px 30px #FF6B3D55}
    #zelpx-ai-support-panel{position:fixed;right:22px;bottom:92px;z-index:99991;width:min(390px,calc(100vw - 28px));height:min(590px,calc(100dvh - 118px));background:radial-gradient(ellipse at 50% 43%,#202C3B 0%,#111923 47%,#090D13 100%);border:1px solid #344252;border-radius:30px;box-shadow:0 30px 90px #000000B8,0 0 55px #FF704D12;display:none;overflow:hidden;font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#F4F6F8}
    #zelpx-ai-support-panel.open{display:flex;flex-direction:column}#zelpx-ai-support-panel *{box-sizing:border-box}
    .zxs-head{position:relative;z-index:3;background:transparent;color:#FFFFFF;padding:23px 23px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0}
    .zxs-brand{display:flex;align-items:center;gap:12px}.zxs-logo{width:42px;height:42px;border-radius:15px;background:linear-gradient(145deg,#FF986E,#F45135);display:grid;place-items:center;font-size:21px;color:white;box-shadow:0 7px 22px #FF6B3D40}
    .zxs-head strong{display:block;font-size:16px;font-weight:700;letter-spacing:-.4px}.zxs-head small{color:#AAB8C8;font-size:11px}
    .zxs-head button{background:#FFFFFF0D;color:#DDE5EF;border:1px solid #FFFFFF20;border-radius:50%;font-size:21px;width:38px;height:38px;cursor:pointer;backdrop-filter:blur(12px)}
    .zxs-voice-stage{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px 18px 30px;background:transparent;text-align:center;border:0}
    .zxs-stage-label{color:#B5C2D1;font-size:10px;font-weight:700;letter-spacing:2.8px;text-transform:uppercase}
    .zxs-orb-wrap{height:260px;width:100%;display:flex;align-items:center;justify-content:center;position:relative;isolation:isolate}
    .zxs-orb{appearance:none;position:relative;z-index:2;width:104px;height:104px;border:1px solid #FFC19A80;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 25%,#FFB17E 0%,#FF784F 40%,#E84F32 100%);color:#FFFFFF;box-shadow:0 0 35px #FF6B3D55,0 15px 40px #00000055,inset 0 2px 9px #FFFFFF65;cursor:pointer;transition:transform .25s,box-shadow .25s}
    .zxs-orb::before,.zxs-orb::after{content:"";position:absolute;inset:-25px;border:1px solid #FF9D7970;border-radius:50%;z-index:-1;transition:opacity .2s}
    .zxs-orb::after{inset:-51px;border-color:#FF9D7945}
    .zxs-orb svg{width:37px;height:37px;display:block;filter:drop-shadow(0 1px 2px #8F382866)}
    .zxs-orb.listening{transform:scale(1.06);box-shadow:0 0 0 14px #FF6B3D17,0 0 65px #FF6B3D90,0 15px 40px #00000055,inset 0 2px 9px #FFFFFF75;animation:zxs-orb-pulse 1.6s ease-in-out infinite}
    .zxs-orb.listening::before{animation:zxs-ring 1.8s ease-out infinite}
    .zxs-orb.listening::after{animation:zxs-ring 1.8s ease-out .45s infinite}
    .zxs-wave{display:none}
    .zxs-stage-hint{margin-top:17px;color:#E0E7EF;font-size:14px;font-weight:500;letter-spacing:.1px}
    .zxs-messages,.zxs-tools,.zxs-compose{display:none}
    .zxs-status{flex:0 0 auto;display:flex;align-items:center;justify-content:center;text-align:center;padding:18px 24px 29px;color:#B8C5D4;font-size:13px;background:transparent;min-height:75px}
    @keyframes zxs-pulse{50%{box-shadow:0 0 0 8px #c8322410}}
    @keyframes zxs-orb-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 7px #FF6B3D12,0 10px 32px #FF6B3D40}50%{transform:scale(1.06);box-shadow:0 0 0 14px #FF6B3D09,0 12px 42px #FF6B3D60}}
    @keyframes zxs-ring{0%{transform:scale(.82);opacity:.8}100%{transform:scale(1.55);opacity:0}}
    @media(max-width:480px){#zelpx-ai-support-launcher{right:14px;bottom:14px}#zelpx-ai-support-panel{right:8px;bottom:78px;width:calc(100vw - 16px);height:min(690px,calc(100dvh - 98px));border-radius:28px}}
    @media(prefers-reduced-motion:reduce){#zelpx-ai-support-panel *,#zelpx-ai-support-launcher{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);
  const launcher=document.createElement("button");
  launcher.id="zelpx-ai-support-launcher";launcher.type="button";launcher.textContent="💬 Ask ZELPX";
  launcher.setAttribute("aria-expanded","false");launcher.setAttribute("aria-controls","zelpx-ai-support-panel");
  const panel=document.createElement("section");
  panel.id="zelpx-ai-support-panel";panel.setAttribute("aria-label","Ask ZELPX AI Support");
  panel.innerHTML=`
    <div class="zxs-head"><div class="zxs-brand"><div class="zxs-logo">✦</div><div><strong>Ask ZELPX</strong><small>Your AI home assistant</small></div></div><button type="button" aria-label="Close chat">×</button></div>
    <div class="zxs-voice-stage"><div class="zxs-stage-label">VOICE ASSISTANT</div><div class="zxs-orb-wrap"><div class="zxs-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><button class="zxs-orb" type="button" aria-label="Start voice input" title="Tap to speak"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div><div class="zxs-stage-hint">Tap the microphone and speak</div></div>
    <div class="zxs-status">Tap the microphone to talk with ZELPX.</div>
  `;
  document.body.append(launcher,panel);
  const status=panel.querySelector(".zxs-status");
  const orb=panel.querySelector(".zxs-orb"),wave=panel.querySelector(".zxs-wave"),stageHint=panel.querySelector(".zxs-stage-hint");
  let history=[],recognition=null,listening=false,busy=false,voiceAudio=null,voiceObjectUrl=null;
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const speechSupported=!!SpeechRecognition;

  function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel();if(voiceAudio){voiceAudio.pause();voiceAudio.src="";voiceAudio=null;}if(voiceObjectUrl){URL.revokeObjectURL(voiceObjectUrl);voiceObjectUrl=null;}orb.classList.remove("listening");wave.classList.remove("active");stageHint.textContent="Tap the microphone and speak";}
  async function speak(text){
    if(!text)return;
    stopSpeaking();
    status.textContent="ZELPX is preparing a natural voice…";
    stageHint.textContent="Preparing voice…";
    try{
      const response=await fetch(VOICE_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({text})});
      if(!response.ok){
        const detail=await response.json().catch(()=>({}));
        throw new Error(detail.error||"Natural voice is temporarily unavailable.");
      }
      const audioBlob=await response.blob();
      if(!audioBlob.size)throw new Error("The voice service returned empty audio.");
      voiceObjectUrl=URL.createObjectURL(audioBlob);
      voiceAudio=new Audio(voiceObjectUrl);
      voiceAudio.onplay=()=>{status.textContent="ZELPX is speaking…";stageHint.textContent="Listening to ZELPX";};
      voiceAudio.onended=()=>{if(voiceObjectUrl){URL.revokeObjectURL(voiceObjectUrl);voiceObjectUrl=null;}voiceAudio=null;stageHint.textContent="Tap the microphone and speak";status.textContent="Tap the microphone whenever you're ready to talk.";};
      voiceAudio.onerror=()=>{status.textContent="Couldn't play the voice response. Tap the microphone to try again.";stageHint.textContent="Tap the microphone and speak";};
      await voiceAudio.play();
    }catch(error){
      console.error("ZELPX Cartesia voice error:",error);
      status.textContent=error.message||"Natural voice is unavailable. Please try again.";
      stageHint.textContent="Voice service needs attention";
    }
  }
  if("speechSynthesis" in window){
    window.speechSynthesis.onvoiceschanged=()=>{chooseVoice();};
  }
  function stopListening(){if(recognition){try{recognition.stop();}catch(_){}}listening=false;orb.classList.remove("listening");wave.classList.remove("active");orb.setAttribute("aria-label","Start voice input");stageHint.textContent="Tap the microphone and speak";}
  function startListening(){
    if(!speechSupported){status.textContent="Voice input is not supported in this browser. Please open ZELPX in Chrome on Android or another supported browser.";return;}
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
  if(!speechSupported){status.textContent="Voice input is not supported in this browser. Please open ZELPX in Chrome on Android or another supported browser.";orb.disabled=true;orb.style.opacity=".5";}
})();