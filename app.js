import { db } from "./firebase-config.js";
import {
  ref, set, get, push, onValue, update, remove, onDisconnect, serverTimestamp, query, limitToLast
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { initVoice, joinVoice, leaveVoice } from "./webrtc.js";

let currentRoom = null;
let myName = "";
let myId = "p_" + Math.random().toString(36).slice(2, 9);
let isHost = false;
let players = {};
let unsubscribers = [];
let spinInProgress = false;
let currentTurnId = null;

const TRUTHS = [
  "What is your biggest fear?",
  "What is the most embarrassing thing you've done?",
  "Who was your first crush?",
  "What is a secret you've never told anyone?",
  "What is the biggest lie you've told?",
  "What is your worst habit?",
  "Have you ever cheated on a test?",
  "What's the most trouble you've been in?",
  "What's something you're insecure about?",
  "Who in this room do you trust most?",
  "What's your most embarrassing childhood memory?",
  "Have you ever lied to your best friend?",
  "What's the weirdest thing you've searched online?",
  "What's your guilty pleasure?",
  "Who do you have a crush on right now?"
];

const DARES = [
  "Do 10 push-ups.",
  "Sing the chorus of any song.",
  "Talk in a foreign accent for 2 minutes.",
  "Do your best dance move.",
  "Text the 3rd person in your contacts 'I miss you'.",
  "Do 10 squats.",
  "Speak only in questions for 3 rounds.",
  "Let someone tickle you for 30 seconds.",
  "Show the last photo in your gallery.",
  "Do your best impression of someone in the room.",
  "Say the alphabet backwards in under 30 seconds.",
  "Do 5 jumping jacks while singing.",
  "Call someone and say 'I love you' then hang up.",
  "Try to lick your elbow for 10 seconds.",
  "Dance with no music for 30 seconds."
];

// ---------- SCREENS ----------
window.showScreen = (id) => {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
};

// ---------- SINGLE PLAYER ----------
window.startSingle = () => {
  const name = document.getElementById("singleName").value.trim() || "Player";
  myName = name;
  showScreen("game");
  document.getElementById("roomCodeDisplay").textContent = "SOLO";
  players = { [myId]: { name, active: true } };
  renderPlayers();
  document.getElementById("voiceBtn").disabled = true;
  document.getElementById("spinBtn").onclick = soloSpin;
  document.getElementById("turnIndicator").textContent = "Tap SPIN to start!";
};

let soloSpin = () => {
  if (spinInProgress) return;
  spinInProgress = true;
  document.getElementById("turnIndicator").textContent = "Spinning...";
  const el = document.getElementById("bottle");
  const to = 360 * 6 + Math.random() * 360;
  el.style.transform = `rotate(${to}deg)`;
  setTimeout(() => {
    currentTurnId = myId;
    document.getElementById("tdPlayer").textContent = myName;
    document.getElementById("tdPrompt").textContent = "Choose your fate";
    showTDModal();
    spinInProgress = false;
  }, 4200);
};

// ---------- MULTIPLAYER ----------
window.createRoom = async () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  myName = "Player " + myId.slice(-3);
  isHost = true;
  await set(ref(db, `rooms/${code}`), {
    host: myId,
    createdAt: serverTimestamp(),
    turn: null,
    turnName: null,
    phase: "idle",
    spinAngle: 0,
    promptType: null,
    promptText: null
  });
  await joinRoomInternal(code, myName);
};

window.joinRoom = async () => {
  const code = document.getElementById("joinCode").value.trim();
  const name = document.getElementById("joinName").value.trim();
  if (!/^\d{6}$/.test(code)) return alert("Enter a valid 6-digit code.");
  if (!name) return alert("Enter your name.");
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) return alert("Room not found.");
  const existing = await get(ref(db, `rooms/${code}/players`));
  if (existing.exists() && Object.keys(existing.val()).length >= 4) {
    return alert("Room is full (max 4 players).");
  }
  await joinRoomInternal(code, name);
};

async function joinRoomInternal(code, name) {
  currentRoom = code;
  myName = name;
  await set(ref(db, `rooms/${code}/players/${myId}`), {
    name, joinedAt: serverTimestamp(), active: true
  });
  onDisconnect(ref(db, `rooms/${code}/players/${myId}`)).remove();

  showScreen("game");
  document.getElementById("roomCodeDisplay").textContent = code;
  document.getElementById("voiceBtn").disabled = false;
  document.getElementById("turnIndicator").textContent = "Waiting for spin...";

  listenRoom();
  listenPlayers();
  listenChat();
  initVoice(code, myId);
}

// ---------- LISTENERS ----------
function listenRoom() {
  const unsub = onValue(ref(db, `rooms/${currentRoom}`), snap => {
    if (!snap.exists()) {
      if (currentRoom) {
        alert("Room closed.");
        cleanupAndHome();
      }
      return;
    }
    const data = snap.val();

    if (data.phase === "spinning" && data.spinAngle !== undefined) {
      const el = document.getElementById("bottle");
      el.style.transform = `rotate(${data.spinAngle + 360 * 6}deg)`;
    }

    if (data.phase === "choice" && data.turn === myId) {
      currentTurnId = myId;
      document.getElementById("tdPlayer").textContent = myName;
      document.getElementById("tdPrompt").textContent = "Choose your fate";
      showTDModal();
    }

    if (data.phase === "prompt" && data.promptText) {
      const isMe = data.turn === myId;
      document.getElementById("tdPlayer").textContent = data.turnName || "Player";
      document.getElementById("tdPrompt").textContent = `${(data.promptType || "").toUpperCase()}: ${data.promptText}`;
      document.getElementById("tdChoices").classList.add("hidden");
      if (isMe) {
        document.getElementById("nextRoundBtn").classList.remove("hidden");
      } else {
        document.getElementById("nextRoundBtn").classList.add("hidden");
      }
      document.getElementById("tdModal").classList.remove("hidden");
    }
  });
  unsubscribers.push(unsub);
}

function listenPlayers() {
  const unsub = onValue(ref(db, `rooms/${currentRoom}/players`), snap => {
    players = snap.val() || {};
    renderPlayers();
    const count = Object.keys(players).length;
    if (count === 0 && isHost) remove(ref(db, `rooms/${currentRoom}`));
  });
  unsubscribers.push(unsub);
}

function listenChat() {
  const q = query(ref(db, `rooms/${currentRoom}/chat`), limitToLast(100));
  const unsub = onValue(q, snap => {
    const box = document.getElementById("chatMessages");
    box.innerHTML = "";
    if (!snap.exists()) return;
    snap.forEach(child => {
      const m = child.val();
      const div = document.createElement("div");
      div.className = "chat-msg" + (m.system ? " system" : "");
      if (m.system) div.textContent = m.text;
      else div.innerHTML = `<span class="name">${escapeHtml(m.name)}:</span> ${escapeHtml(m.text)}`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
  unsubscribers.push(unsub);
}

// ---------- RENDER ----------
function renderPlayers() {
  const bar = document.getElementById("playersBar");
  bar.innerHTML = "";
  Object.entries(players).forEach(([id, p]) => {
    const chip = document.createElement("div");
    chip.className = "player-chip" + (id === myId ? " active" : "");
    chip.textContent = p.name;
    bar.appendChild(chip);
  });
}

// ---------- SPIN ----------
window.spinBottle = async () => {
  if (!currentRoom || spinInProgress) return;
  const ids = Object.keys(players);
  if (ids.length < 2) return alert("Need at least 2 players.");
  spinInProgress = true;
  const target = ids[Math.floor(Math.random() * ids.length)];
  const angle = Math.random() * 360;
  currentTurnId = target;
  await update(ref(db, `rooms/${currentRoom}`), {
    phase: "spinning",
    spinAngle: angle,
    turn: target,
    turnName: players[target]?.name || "Player",
    promptText: null,
    promptType: null
  });
  setTimeout(async () => {
    await update(ref(db, `rooms/${currentRoom}`), { phase: "choice" });
    spinInProgress = false;
  }, 4200);
};

// ---------- TRUTH/DARE ----------
function showTDModal() {
  document.getElementById("tdModal").classList.remove("hidden");
  document.getElementById("tdChoices").classList.remove("hidden");
  document.getElementById("nextRoundBtn").classList.add("hidden");
}

window.chooseTruthDare = async (type) => {
  const list = type === "truth" ? TRUTHS : DARES;
  const promptText = list[Math.floor(Math.random() * list.length)];
  document.getElementById("tdPlayer").textContent = players[currentTurnId]?.name || myName;
  document.getElementById("tdPrompt").textContent = `${type.toUpperCase()}: ${promptText}`;
  document.getElementById("tdChoices").classList.add("hidden");
  document.getElementById("nextRoundBtn").classList.remove("hidden");

  if (currentRoom) {
    await update(ref(db, `rooms/${currentRoom}`), {
      phase: "prompt",
      promptType: type,
      promptText: promptText,
      turnName: players[currentTurnId]?.name || myName
    });
  }
};

window.nextRound = async () => {
  document.getElementById("tdModal").classList.add("hidden");
  if (currentRoom) {
    await update(ref(db, `rooms/${currentRoom}`), {
      phase: "idle", turn: null, turnName: null, promptText: null, promptType: null
    });
  }
  document.getElementById("turnIndicator").textContent = currentRoom ? "Tap SPIN to continue" : "Tap SPIN";
};

// ---------- CHAT ----------
window.sendChat = async () => {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !currentRoom) return;
  input.value = "";
  await push(ref(db, `rooms/${currentRoom}/chat`), {
    name: myName, text, ts: serverTimestamp()
  });
};

// ---------- VOICE ----------
window.toggleVoice = async () => {
  const btn = document.getElementById("voiceBtn");
  if (btn.dataset.on === "1") {
    await leaveVoice();
    btn.dataset.on = "0";
    btn.textContent = "🎙 Join Voice";
    document.getElementById("voiceStatus").textContent = "";
  } else {
    try {
      await joinVoice(currentRoom, myId, players);
      btn.dataset.on = "1";
      btn.textContent = "🔴 Leave Voice";
      document.getElementById("voiceStatus").textContent = "Voice connected";
    } catch (e) {
      document.getElementById("voiceStatus").textContent = "Mic access denied";
    }
  }
};

// ---------- LEAVE ----------
window.leaveRoom = async () => {
  if (currentRoom) {
    await remove(ref(db, `rooms/${currentRoom}/players/${myId}`)).catch(() => {});
    if (isHost) {
      await remove(ref(db, `rooms/${currentRoom}`)).catch(() => {});
    }
  }
  await cleanupAndHome();
};

async function cleanupAndHome() {
  unsubscribers.forEach(u => u && u());
  unsubscribers = [];
  try { await leaveVoice(); } catch (e) {}
  currentRoom = null;
  isHost = false;
  players = {};
  currentTurnId = null;
  document.getElementById("chatMessages").innerHTML = "";
  document.getElementById("tdModal").classList.add("hidden");
  document.getElementById("voiceBtn").dataset.on = "0";
  document.getElementById("voiceBtn").textContent = "🎙 Join Voice";
  document.getElementById("voiceStatus").textContent = "";
  document.getElementById("spinBtn").onclick = spinBottle;
  showScreen("home");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
