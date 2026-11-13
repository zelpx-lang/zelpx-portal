/* ZELPX audio-call prototype. Calls are available while both chat pages are open.
   Background Android ringing and TURN relay are separate integration steps. */
(() => {
  "use strict";
  const STUN = [{ urls: "stun:stun.l.google.com:19302" }];
  window.ZELPXAttachAudioCall = function ({ db, conversationId, userId, role, host }) {
    if (!db || !conversationId || !userId || !host) throw new Error("Audio call setup is missing chat information.");
    if (host.dataset.zelpxCallReady === "1") return;
    host.dataset.zelpxCallReady = "1";
    const bar = document.createElement("div");
    bar.className = "zelpx-call-bar";
    bar.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;border:1px solid #e3e7ed;border-radius:10px;background:#fff;";
    const callBtn = document.createElement("button");
    callBtn.type = "button"; callBtn.textContent = "☎ Call"; callBtn.style.cssText = "width:auto;margin:0;background:#e87524;padding:10px 16px;";
    const answerBtn = document.createElement("button");
    answerBtn.type = "button"; answerBtn.textContent = "Answer"; answerBtn.style.cssText = "display:none;width:auto;margin:0;background:#16834a;padding:10px 16px;";
    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button"; rejectBtn.textContent = "Decline"; rejectBtn.style.cssText = "display:none;width:auto;margin:0;background:#667085;padding:10px 16px;";
    const endBtn = document.createElement("button");
    endBtn.type = "button"; endBtn.textContent = "End call"; endBtn.style.cssText = "display:none;width:auto;margin:0;background:#b42318;padding:10px 16px;";
    const state = document.createElement("span");
    state.setAttribute("role","status"); state.style.cssText = "font-size:13px;color:#475467;";
    const audio = document.createElement("audio"); audio.autoplay = true; audio.playsInline = true; audio.style.display = "none";
    bar.append(callBtn, answerBtn, rejectBtn, endBtn, state, audio);
    host.prepend(bar);

    const clientInstanceId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (String(Date.now()) + "-" + Math.random().toString(36).slice(2));
    let channel, pc, localStream, activeCallId = null, pendingOffer = null, closed = false, queuedIce = [], localIceQueue = [], channelReady = false, localDescriptionSent = false;
    let ringContext = null, ringOscillators = [], ringTimer = null;
    let ringbackOscillators = [], ringbackTimer = null;
    const topic = "zelpx-call:" + conversationId;
    const setStatus = (s) => { state.textContent = s; };
    function unlockCallSound() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        ringContext ||= new AudioContextClass();
        if (ringContext.state === "suspended") ringContext.resume().catch(() => {});
      } catch (_) {}
    }
    // Android Chrome unlocks Web Audio only after a real user gesture on the page.
    // The recipient may tap "Open conversation", not the call bar itself.
    document.addEventListener("pointerdown", unlockCallSound, { once: true, capture: true });
    document.addEventListener("touchstart", unlockCallSound, { once: true, capture: true, passive: true });
    function stopRingtone() {
      if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
      ringOscillators.forEach(osc => { try { osc.stop(); } catch (_) {} });
      ringOscillators = [];
    }
    function startRingtone() {
      stopRingtone();
      unlockCallSound();
      if (!ringContext) return;
      const playBurst = () => {
        if (!ringContext || ringContext.state !== "running") return;
        [0, 0.22].forEach(offset => {
          const osc = ringContext.createOscillator();
          const gain = ringContext.createGain();
          osc.type = "sine";
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, ringContext.currentTime + offset);
          gain.gain.linearRampToValueAtTime(0.16, ringContext.currentTime + offset + 0.025);
          gain.gain.setValueAtTime(0.16, ringContext.currentTime + offset + 0.13);
          gain.gain.linearRampToValueAtTime(0.0001, ringContext.currentTime + offset + 0.18);
          osc.connect(gain); gain.connect(ringContext.destination);
          osc.start(ringContext.currentTime + offset);
          osc.stop(ringContext.currentTime + offset + 0.19);
          ringOscillators.push(osc);
        });
      };
      playBurst();
      ringTimer = setInterval(playBurst, 1400);
    }
    function stopRingback() {
      if (ringbackTimer) { clearInterval(ringbackTimer); ringbackTimer = null; }
      ringbackOscillators.forEach(osc => { try { osc.stop(); } catch (_) {} });
      ringbackOscillators = [];
    }
    // Caller-side US-style ringback: two soft tones while waiting for an answer.
    function startRingback() {
      stopRingback();
      unlockCallSound();
      if (!ringContext) return;
      const playBurst = () => {
        if (!ringContext || ringContext.state !== "running" || !activeCallId) return;
        [440, 480].forEach(frequency => {
          const osc = ringContext.createOscillator();
          const gain = ringContext.createGain();
          const now = ringContext.currentTime;
          osc.type = "sine";
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.055, now + 0.08);
          gain.gain.setValueAtTime(0.055, now + 1.75);
          gain.gain.linearRampToValueAtTime(0.0001, now + 1.9);
          osc.connect(gain); gain.connect(ringContext.destination);
          osc.start(now);
          osc.stop(now + 1.91);
          ringbackOscillators.push(osc);
        });
      };
      playBurst();
      ringbackTimer = setInterval(playBurst, 6000);
    }
    function showIncomingCallNotification() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const options = {
          body: "A customer or contractor is calling you.",
          tag: "zelpx-call-" + conversationId,
          renotify: true,
          requireInteraction: true,
          vibrate: [500, 250, 500]
        };
        if (navigator.serviceWorker?.getRegistration) {
          navigator.serviceWorker.getRegistration().then(reg => {
            if (reg?.showNotification) return reg.showNotification("Incoming ZELPX audio call", options);
            return new Notification("Incoming ZELPX audio call", options);
          }).catch(() => {});
        } else {
          const note = new Notification("Incoming ZELPX audio call", options);
          note.onclick = () => { window.focus(); note.close(); };
        }
      } catch (_) {}
    }
    const signal = async (event, data) => {
      if (!channel) throw new Error("Call channel is not connected.");
      const result = await channel.send({ type:"broadcast", event:"call_signal", payload:{ ...data, kind:event, sender:userId, senderClientId:clientInstanceId, role } });
      if (result !== "ok") throw new Error("Call signal could not be sent (" + result + ").");
    };
    async function ensurePeer() {
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: STUN });
      pc.onicecandidate = e => { if (!e.candidate || !activeCallId) return; const candidate = e.candidate.toJSON(); if (!localDescriptionSent) { localIceQueue.push(candidate); return; } signal("ice", { callId:activeCallId, candidate }).catch(err=>setStatus(err.message)); };
      pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(()=>setStatus("Tap the page once to enable audio playback.")); };
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") { stopRingback(); setStatus("Connected — audio call"); }
        if (["failed","disconnected"].includes(pc.connectionState)) setStatus("Connection interrupted. Check your network and try again.");
      };
      localStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false });
      localStream.getAudioTracks().forEach(track=>pc.addTrack(track,localStream));
      return pc;
    }
    async function cleanup(message) {
      const oldId = activeCallId;
      activeCallId = null; pendingOffer = null; queuedIce = []; localIceQueue = []; localDescriptionSent = false;
      stopRingtone();
      stopRingback();
      if (pc) { pc.onicecandidate=null; pc.ontrack=null; pc.close(); pc=null; }
      if (localStream) { localStream.getTracks().forEach(t=>t.stop()); localStream=null; }
      audio.srcObject=null;
      answerBtn.style.display=rejectBtn.style.display=endBtn.style.display="none";
      callBtn.style.display="inline-block"; callBtn.disabled=false;
      setStatus(message || "Call ended.");
      return oldId;
    }
    callBtn.addEventListener("click", async () => {
      callBtn.disabled=true;
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("This browser does not support audio calling. Open ZELPX in Chrome over HTTPS.");
        if (!channelReady) throw new Error("Call service is not connected yet. Wait a moment and try again.");
        activeCallId = crypto.randomUUID(); localDescriptionSent = false; localIceQueue = [];
        await ensurePeer();
        await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio:true }));
        const { error: inviteSaveError } = await db.from("call_invitations").insert({
          call_id: activeCallId,
          conversation_id: conversationId,
          caller_user_id: userId,
          caller_role: role,
          offer: pc.localDescription.toJSON(),
          status: "ringing"
        });
        if (inviteSaveError) throw new Error("Could not save incoming call invitation: " + inviteSaveError.message);
        // Deliver a Web Push alert in addition to the live Realtime invite.
        // This lets Android show an incoming-call notification when the chat is backgrounded.
        try {
          const { data: pushResult, error: pushError } = await db.functions.invoke("send-chat-push", {
            body: { action:"incoming_call", conversation_id:conversationId, call_id:activeCallId, caller_role:role, client_origin:"https://zelpx-portal-git-feature-android-call-prototype-zelpx.vercel.app" }
          });
          if (pushError) console.warn("ZELPX incoming-call push failed:", pushError.message);
          else if (pushResult?.sent === 0) console.warn("ZELPX incoming-call push not delivered:", pushResult.reason || "no active recipient subscription");
        } catch (pushError) {
          console.warn("ZELPX incoming-call push failed:", pushError);
        }
        await signal("invite", { callId:activeCallId, description:pc.localDescription });
        localDescriptionSent = true;
        for (const candidate of localIceQueue.splice(0)) await signal("ice", { callId:activeCallId, candidate });
        callBtn.style.display="none"; endBtn.style.display="inline-block";
        startRingback();
        setStatus("Calling… waiting for the other person to answer.");
      } catch(e) { await cleanup("Could not start call: " + (e.message || "permission denied")); }
    });
    answerBtn.addEventListener("click", async () => {
      stopRingtone();
      answerBtn.disabled=true;
      try {
        if (!pendingOffer) throw new Error("This call is no longer available.");
        activeCallId=pendingOffer.callId; localDescriptionSent = false; localIceQueue = [];
        await ensurePeer();
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.description));
        for (const candidate of queuedIce.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
        await signal("answer", { callId:activeCallId, description:pc.localDescription });
        await db.from("call_invitations").update({ status:"accepted", updated_at:new Date().toISOString() }).eq("call_id",activeCallId);
        localDescriptionSent = true;
        for (const candidate of localIceQueue.splice(0)) await signal("ice", { callId:activeCallId, candidate });
        answerBtn.style.display=rejectBtn.style.display="none"; endBtn.style.display="inline-block"; callBtn.style.display="none";
        setStatus("Connecting…");
      } catch(e) { await cleanup("Could not answer: " + (e.message || "unknown error")); }
      finally { answerBtn.disabled=false; }
    });
    rejectBtn.addEventListener("click", async () => {
      try { if (pendingOffer) { await signal("reject",{callId:pendingOffer.callId}); await db.from("call_invitations").update({ status:"declined", updated_at:new Date().toISOString() }).eq("call_id",pendingOffer.callId); } } catch(_) {}
      await cleanup("Call declined.");
    });
    endBtn.addEventListener("click", async () => {
      try { if (activeCallId) { await signal("hangup",{callId:activeCallId}); await db.from("call_invitations").update({ status:"ended", updated_at:new Date().toISOString() }).eq("call_id",activeCallId); } } catch(_) {}
      await cleanup("Call ended.");
    });
    const onSignal = async raw => {
      // supabase-js Broadcast callback envelope is { event, payload }.
      const p = raw?.payload;
      const event = p?.kind;
      // Ignore only this browser instance. The same account may be signed in on
      // two phones (customer/contractor testing); those devices must receive calls.
      if (!p || p.senderClientId===clientInstanceId) return;
      try {
        if (event==="invite" && !activeCallId && !pendingOffer && p.description?.type==="offer") {
          pendingOffer={callId:p.callId,description:p.description};
          setStatus("Incoming audio call…");
          startRingtone();
          showIncomingCallNotification();
          callBtn.style.display="none"; answerBtn.style.display=rejectBtn.style.display="inline-block";
        } else if (event==="ice" && pendingOffer && p.callId===pendingOffer.callId && !activeCallId && p.candidate) {
          queuedIce.push(p.candidate);
        } else if (!activeCallId || p.callId!==activeCallId) return;
        else if (event==="answer" && p.description?.type==="answer" && pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(p.description));
          for (const candidate of queuedIce.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          setStatus("Connecting…");
        } else if (event==="ice" && p.candidate && pc) {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
          else queuedIce.push(p.candidate);
        } else if (event==="reject") {
          await cleanup("The other person declined the call.");
        } else if (event==="hangup") {
          await cleanup("The other person ended the call.");
        }
      } catch(e) { setStatus("Call error: " + (e.message || "signal failed")); }
    };
    callBtn.disabled = true;
    setStatus("Connecting call service…");
    // Refresh the signed-in user's JWT BEFORE joining the private Realtime channel.
    // Subscribing before setAuth resolves can leave the recipient unable to receive broadcasts.
    (async () => {
      try {
        if (db.realtime?.setAuth) await db.realtime.setAuth();
        channel = db.channel(topic,{config:{private:true}})
          .on("broadcast",{event:"call_signal"},onSignal)
          .subscribe((status,err)=>{
            if(status==="SUBSCRIBED") {
              channelReady = true; callBtn.disabled = false; setStatus("Audio calling ready while this chat is open.");
              db.from("call_invitations").select("call_id,offer,caller_user_id,created_at")
                .eq("conversation_id",conversationId).eq("status","ringing")
                .gte("created_at",new Date(Date.now()-60000).toISOString())
                .order("created_at",{ascending:false}).limit(1).maybeSingle()
                .then(({data,error})=>{
                  if(error) { console.warn("Could not check pending call invitation:",error.message); return; }
                  if(data && data.caller_user_id!==userId && !activeCallId && !pendingOffer && data.offer?.type==="offer") {
                    pendingOffer={callId:data.call_id,description:data.offer};
                    setStatus("Incoming audio call… tap Answer.");
                    startRingtone();
                    showIncomingCallNotification();
                    callBtn.style.display="none";
                    answerBtn.style.display=rejectBtn.style.display="inline-block";
                  }
                });
            }
            else if(status==="CHANNEL_ERROR" || status==="TIMED_OUT") { channelReady = false; callBtn.disabled = true; setStatus("Call connection unavailable: " + (err?.message || status)); }
            else if(status==="CLOSED") { channelReady = false; callBtn.disabled = true; setStatus("Call connection closed. Reopen this chat."); }
          });
      } catch (err) {
        setStatus("Call authorization failed: " + (err?.message || "sign-in required"));
      }
    })();
    const teardown=async()=>{
      if(closed)return; closed=true;
      try { if(activeCallId) await signal("hangup",{callId:activeCallId}); } catch(_) {}
      await cleanup("Chat closed.");
      if(channel) await db.removeChannel(channel);
    };
    window.addEventListener("pagehide",teardown,{once:true});
    host.addEventListener("DOMNodeRemoved",()=>{ if(!host.isConnected) teardown(); },{once:true});
  };
})();