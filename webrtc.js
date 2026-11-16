import { db } from "./firebase-config.js";
import {
  ref, set, onValue, remove, push
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let pcs = {};
let localStream = null;
let roomId = null;
let myId = null;
let signallingUnsubs = [];

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export async function initVoice(room, id) {
  roomId = room;
  myId = id;
}

export async function joinVoice(room, id, players) {
  roomId = room;
  myId = id;
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  document.getElementById("voiceStatus").textContent = "Requesting mic...";

  // Listen for incoming offers/answers/candidates on my signalling node
  const mySigRef = ref(db, `rooms/${room}/voice/${myId}`);
  const unsub = onValue(mySigRef, async snap => {
    const data = snap.val() || {};
    if (data.offer && data.offer.from !== myId) {
      await handleOffer(data.offer);
    }
    if (data.answer) {
      await handleAnswer(data.answer);
    }
    if (data.candidates) {
      for (const [k, c] of Object.entries(data.candidates)) {
        await addCandidate(c);
      }
    }
  });
  signallingUnsubs.push(unsub);

  // Create offer to each other player
  for (const peerId of Object.keys(players)) {
    if (peerId === myId) continue;
    await createOfferTo(peerId);
  }
}

async function createOfferTo(peerId) {
  if (pcs[peerId]) return;
  const p = new RTCPeerConnection(ICE);
  pcs[peerId] = p;
  localStream.getTracks().forEach(t => p.addTrack(t, localStream));
  p.onicecandidate = e => {
    if (e.candidate) {
      push(ref(db, `rooms/${roomId}/voice/${peerId}/candidates`), e.candidate.toJSON());
    }
  };
  p.ontrack = e => attachAudio(peerId, e.streams[0]);

  const offer = await p.createOffer();
  await p.setLocalDescription(offer);
  await set(ref(db, `rooms/${roomId}/voice/${peerId}/offer`), {
    from: myId, sdp: offer.sdp, type: offer.type
  });
}

async function handleOffer(offer) {
  const from = offer.from;
  if (pcs[from]) return;
  const p = new RTCPeerConnection(ICE);
  pcs[from] = p;
  localStream.getTracks().forEach(t => p.addTrack(t, localStream));
  p.onicecandidate = e => {
    if (e.candidate) {
      push(ref(db, `rooms/${roomId}/voice/${from}/candidates`), e.candidate.toJSON());
    }
  };
  p.ontrack = e => attachAudio(from, e.streams[0]);

  await p.setRemoteDescription(new RTCSessionDescription({ type: offer.type, sdp: offer.sdp }));
  const answer = await p.createAnswer();
  await p.setLocalDescription(answer);
  await set(ref(db, `rooms/${roomId}/voice/${from}/answer`), {
    sdp: answer.sdp, type: answer.type
  });
}

async function handleAnswer(answer) {
  for (const p of Object.values(pcs)) {
    if (p.signalingState === "have-local-offer") {
      try {
        await p.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {}
      break;
    }
  }
}

async function addCandidate(c) {
  for (const p of Object.values(pcs)) {
    try {
      await p.addIceCandidate(new RTCIceCandidate(c));
    } catch (e) {}
  }
}

function attachAudio(peerId, stream) {
  let audio = document.getElementById("audio-" + peerId);
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = "audio-" + peerId;
    audio.autoplay = true;
    document.getElementById("audioContainer").appendChild(audio);
  }
  audio.srcObject = stream;
}

export async function leaveVoice() {
  signallingUnsubs.forEach(u => u && u());
  signallingUnsubs = [];
  if (roomId && myId) {
    await remove(ref(db, `rooms/${roomId}/voice/${myId}`)).catch(() => {});
  }
  for (const p of Object.values(pcs)) {
    try { p.close(); } catch (e) {}
  }
  pcs = {};
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  const c = document.getElementById("audioContainer");
  if (c) c.innerHTML = "";
}
