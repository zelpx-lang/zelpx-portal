/* ZELPX in-chat audio calling. WebRTC first milestone: both users must have the chat open.
   TURN and native background FCM delivery are separate deployment requirements. */
(() => {
  "use strict";
  const STUN = [{ urls: "stun:stun.l.google.com:19302" }];
  function button(label, cls) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.style.cssText = "border:0;border-radius:24px;padding:13px 20px;font-weight:700;cursor:pointer;margin:8px 8px 8px 0;background:#ff6b2c;color:#fff";
    if (cls) b.style.cssText += cls;
    return b;
  }
  async function mount({db, conversationId, role, panel, userId}) {
    if (!db || !conversationId || !panel || !userId || !["customer","contractor"].includes(role)) return;
    const bar = document.createElement("div"); bar.className = "zelpx-call-controls";
    const callBtn = button("☎ Call");
    const state = document.createElement("span"); state.style.cssText = "display:block;font-size:14px;color:#6b625b;margin:2px 0 8px";
    const audio = document.createElement("audio"); audio.autoplay = true; audio.playsInline = true;
    audio.style.display = "none";
    bar.append(callBtn, state, audio);
    const anchor = panel.querySelector("form") || panel.firstChild;
    if (anchor) panel.insertBefore(bar, anchor); else panel.append(bar);
    let pc = null, activeCall = null, channel = null, localStream = null, seen = new Set(), pendingIce = [], closed = false;
    const otherRole = role === "customer" ? "contractor" : "customer";
    const say = t => { state.textContent = t; };
    const send = async (type,payload={}) => {
      const {error}=await db.from("call_signals").insert({call_id:activeCall,conversation_id:conversationId,from_user_id:userId,signal_type:type,payload});
      if(error) throw error;
    };
    const ensurePeer = async () => {
      if(pc) return pc;
      pc = new RTCPeerConnection({iceServers:STUN});
      pc.onicecandidate = e => { if(e.candidate && activeCall) send("ice",e.candidate.toJSON()).catch(err=>say("Call network error: "+err.message)); };
      pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(()=>say("Tap the screen to enable call audio.")); };
      localStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
      pc.onconnectionstatechange = () => {
        if(!pc) return;
        if(pc.connectionState==="connected") say("Connected — audio call in progress");
        if(["failed","disconnected"].includes(pc.connectionState)) say("Connection interrupted. Check network or TURN configuration.");
        if(pc.connectionState==="closed") say("Call ended");
      };
      return pc;
    };
    const cleanup = async (message="Call ended") => {
      if(pc){pc.onicecandidate=null;pc.close();pc=null;}
      if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
      audio.srcObject=null; activeCall=null; callBtn.disabled=false; callBtn.textContent="☎ Call"; callBtn.onclick=null; say(message);
    };
    const processSignal = async row => {
      if(closed || !activeCall || row.call_id!==activeCall || row.from_user_id===userId || seen.has(row.id)) return;
      seen.add(row.id);
      try {
        if(row.signal_type==="answer" && pc){await pc.setRemoteDescription(row.payload);for(const candidate of pendingIce.splice(0)) await pc.addIceCandidate(candidate);say("Connecting…");}
        else if(row.signal_type==="offer"){
          const params = new URLSearchParams(window.location.search);
          const requestedCall = params.get("call_id");
          const requestedAction = requestedCall === activeCall ? params.get("action") : null;
          const accept = requestedAction === "answer" ? true : requestedAction === "decline" ? false : window.confirm("Incoming ZELPX audio call. Answer?");
          if (requestedAction) {
            params.delete("action"); params.delete("call_id"); params.delete("conversation_id");
            const cleanUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
            window.history.replaceState({}, "", cleanUrl);
          }
          if(!accept){await db.from("call_invitations").update({status:"declined"}).eq("call_id",activeCall);await send("decline");await cleanup("Call declined");return;}
          const peer=await ensurePeer(); await peer.setRemoteDescription(row.payload);
          const answer=await peer.createAnswer(); await peer.setLocalDescription(answer);
          await send("answer",peer.localDescription.toJSON());
          await db.from("call_invitations").update({status:"accepted"}).eq("call_id",activeCall);
          say("Connecting…");
        } else if(row.signal_type==="ice" && pc){if(pc.remoteDescription) await pc.addIceCandidate(row.payload); else pendingIce.push(row.payload);}
        else if(row.signal_type==="decline"){await cleanup("The other person declined the call");}
        else if(row.signal_type==="hangup"){await cleanup("The other person ended the call");}
      } catch(e){say("Call error: "+(e.message||"Unable to connect"));await cleanup("Call failed");}
    };
    const subscribe = async callId => {
      activeCall=callId; seen.clear(); pendingIce=[];
      channel=db.channel("zelpx-call-"+callId)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"call_signals",filter:"call_id=eq."+callId},payload=>processSignal(payload.new))
        .subscribe();
      const {data,error}=await db.from("call_signals").select("*").eq("call_id",callId).order("created_at",{ascending:true});
      if(error) throw error;
      for(const row of data||[]) await processSignal(row);
    };
    callBtn.addEventListener("click", async()=>{
      callBtn.disabled=true;
      try{
        if(!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("This browser does not support audio calling.");
        const {data:sessionData}=await db.auth.getSession();
        if(!sessionData.session) throw new Error("Please sign in again.");
        const callId=crypto.randomUUID();
        const {error}=await db.from("call_invitations").insert({call_id:callId,conversation_id:conversationId,caller_user_id:userId,caller_role:role,status:"ringing"});
        if(error) throw error;
        // Ask the authenticated Edge Function to notify registered native Android devices.
        // The call still works in an open chat if no native FCM token is registered yet.
        try {
          const {data:pushData,error:pushError}=await db.functions.invoke("zelpx-fcm-call",{
            body:{action:"incoming_call",call_id:callId,conversation_id:conversationId,caller_role:role,caller_name:role==="customer"?"ZELPX customer":"ZELPX contractor"}
          });
          if(pushError) say("Call started; background alert unavailable: "+pushError.message);
          else if(pushData?.sent===0) say("Calling… no native Android device is registered for background ringing yet.");
        } catch(pushError) { say("Calling… background alert could not be sent."); }
        await subscribe(callId);
        const peer=await ensurePeer(); const offer=await peer.createOffer(); await peer.setLocalDescription(offer);
        await send("offer",peer.localDescription.toJSON());
        say("Calling… waiting for "+otherRole);
        callBtn.textContent="End call";
        callBtn.disabled=false;
        callBtn.onclick=async()=>{try{await send("hangup");}catch(_){} await db.from("call_invitations").update({status:"ended"}).eq("call_id",callId);await cleanup();callBtn.onclick=null;};
      }catch(e){say("Could not start call: "+(e.message||"unknown error"));await cleanup("Call not started");}
    });
    const incoming=db.channel("zelpx-incoming-"+conversationId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"call_invitations",filter:"conversation_id=eq."+conversationId},async payload=>{
        const row=payload.new;if(row.caller_user_id===userId||row.status!=="ringing"||activeCall)return;
        activeCall=row.call_id; callBtn.disabled=true; callBtn.textContent="Incoming call…";
        say("Incoming audio call — opening call controls");
        try{await subscribe(row.call_id);callBtn.disabled=false;callBtn.textContent="End call";callBtn.onclick=async()=>{try{await send("hangup");}catch(_){}await db.from("call_invitations").update({status:"ended"}).eq("call_id",row.call_id);await cleanup();};}catch(e){say("Incoming call error: "+e.message);}
      }).subscribe();
    // Recover an invitation that arrived before this chat was opened (e.g. after
    // tapping Answer on the native Android call notification).
    try {
      const { data: pendingCalls, error: pendingError } = await db.from("call_invitations")
        .select("call_id,caller_user_id,status").eq("conversation_id", conversationId)
        .eq("status", "ringing").neq("caller_user_id", userId)
        .order("created_at", { ascending: false }).limit(1);
      if (pendingError) throw pendingError;
      const pending = pendingCalls && pendingCalls[0];
      if (pending && !activeCall) {
        callBtn.disabled = true; callBtn.textContent = "Incoming call…";
        await subscribe(pending.call_id);
        callBtn.disabled = false; callBtn.textContent = "End call";
        callBtn.onclick = async () => { try { await send("hangup"); } catch (_) {} await db.from("call_invitations").update({status:"ended"}).eq("call_id", pending.call_id); await cleanup(); };
      }
    } catch (e) { say("Could not restore incoming call: " + (e.message || "unknown error")); }
    const poll=window.setInterval(()=>{if(!panel.isConnected||panel.classList.contains("hidden")||panel.offsetParent===null){window.clearInterval(poll);closed=true;db.removeChannel(incoming);if(channel)db.removeChannel(channel);cleanup();}},1500);
    // Incoming call prompt is triggered only after its offer arrives.
    callBtn.addEventListener("contextmenu",e=>e.preventDefault());
    say("Audio calling is ready while this chat is open. Keep this page active.");
  }
  window.ZELPXMountAudioCall = mount;
})();