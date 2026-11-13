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

    let channel, pc, localStream, activeCallId = null, pendingOffer = null, closed = false, queuedIce = [];
    const topic = "zelpx-call:" + conversationId;
    const setStatus = (s) => { state.textContent = s; };
    const signal = async (event, data) => {
      if (!channel) throw new Error("Call channel is not connected.");
      const result = await channel.send({ type:"broadcast", event, payload:{ ...data, sender:userId, role } });
      if (result !== "ok") throw new Error("Call signal could not be sent (" + result + ").");
    };
    async function ensurePeer() {
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: STUN });
      pc.onicecandidate = e => { if (e.candidate && activeCallId) signal("ice", { callId:activeCallId, candidate:e.candidate.toJSON() }).catch(err=>setStatus(err.message)); };
      pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(()=>setStatus("Tap the page once to enable audio playback.")); };
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") setStatus("Connected — audio call");
        if (["failed","disconnected"].includes(pc.connectionState)) setStatus("Connection interrupted. Check your network and try again.");
      };
      localStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false });
      localStream.getAudioTracks().forEach(track=>pc.addTrack(track,localStream));
      return pc;
    }
    async function cleanup(message) {
      const oldId = activeCallId;
      activeCallId = null; pendingOffer = null; queuedIce = [];
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
        activeCallId = crypto.randomUUID();
        await ensurePeer();
        await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio:true }));
        await signal("invite", { callId:activeCallId, description:pc.localDescription });
        callBtn.style.display="none"; endBtn.style.display="inline-block";
        setStatus("Calling… waiting for the other person to answer.");
      } catch(e) { await cleanup("Could not start call: " + (e.message || "permission denied")); }
    });
    answerBtn.addEventListener("click", async () => {
      answerBtn.disabled=true;
      try {
        if (!pendingOffer) throw new Error("This call is no longer available.");
        activeCallId=pendingOffer.callId;
        await ensurePeer();
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.description));
        for (const candidate of queuedIce.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
        await signal("answer", { callId:activeCallId, description:pc.localDescription });
        answerBtn.style.display=rejectBtn.style.display="none"; endBtn.style.display="inline-block"; callBtn.style.display="none";
        setStatus("Connecting…");
      } catch(e) { await cleanup("Could not answer: " + (e.message || "unknown error")); }
      finally { answerBtn.disabled=false; }
    });
    rejectBtn.addEventListener("click", async () => {
      try { if (pendingOffer) await signal("reject",{callId:pendingOffer.callId}); } catch(_) {}
      await cleanup("Call declined.");
    });
    endBtn.addEventListener("click", async () => {
      try { if (activeCallId) await signal("hangup",{callId:activeCallId}); } catch(_) {}
      await cleanup("Call ended.");
    });
    const onSignal = async raw => {
      const p=raw?.payload || raw;
      if (!p || p.sender===userId) return;
      try {
        if (p.event==="invite" && !activeCallId && !pendingOffer && p.description?.type==="offer") {
          pendingOffer={callId:p.callId,description:p.description};
          setStatus("Incoming audio call…");
          callBtn.style.display="none"; answerBtn.style.display=rejectBtn.style.display="inline-block";
        } else if (!activeCallId || p.callId!==activeCallId) return;
        else if (p.event==="answer" && p.description?.type==="answer" && pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(p.description));
          for (const candidate of queuedIce.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          setStatus("Connecting…");
        } else if (p.event==="ice" && p.candidate && pc) {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
          else queuedIce.push(p.candidate);
        } else if (p.event==="reject") {
          await cleanup("The other person declined the call.");
        } else if (p.event==="hangup") {
          await cleanup("The other person ended the call.");
        }
      } catch(e) { setStatus("Call error: " + (e.message || "signal failed")); }
    };
    channel=db.channel(topic,{config:{private:true}})
      .on("broadcast",{event:"call_signal"},onSignal)
      .subscribe((status,err)=>{
        if(status==="SUBSCRIBED") setStatus("Audio calling ready while this chat is open.");
        else if(status==="CHANNEL_ERROR" || status==="TIMED_OUT") setStatus("Call connection unavailable: " + (err?.message || status));
      });
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