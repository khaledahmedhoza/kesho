import { MY_CONTACTS } from "./data.js";
import { hashContacts } from "./hashing.js";
import { buildHopGraph, renderHopGraphSVG } from "./graph.js";
import { startShakeListener, requestMotionPermission, startCapture, stopCapture, vibrate, HAPTIC } from "./media.js";
import { buildAlertPayload, startCancellableSend, CANCEL_WINDOW_MS } from "./alerts.js";

const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");

const state = {
  screen: "welcome",
  tab: "home",
  includedContactIds: new Set(MY_CONTACTS.map((c) => c.id)),
  hopNodes: [],
  cancelHandle: null,
  countdownMs: CANCEL_WINDOW_MS,
  triggerPhase: "idle", // idle | armed-shake | counting | sent
  triggerKind: null, // "alert" | "video"
  recording: null,
  stopShakeListener: null,
  stopVolumeListener: null,
};

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// ---------------------------------------------------------------- render

function render() {
  if (state.screen === "welcome") return renderWelcome();
  if (state.screen === "contacts") return renderContacts();
  if (state.screen === "consentPreview") return renderConsentPreview();
  if (state.screen === "main") {
    tabbar.hidden = false;
    if (state.tab === "home") return renderHome();
    if (state.tab === "network") return renderNetwork();
    if (state.tab === "trigger") return renderTrigger();
    if (state.tab === "inbox") return renderInbox();
  }
}

function renderWelcome() {
  tabbar.hidden = true;
  app.innerHTML = `
    <h1>Kesho</h1>
    <p class="lede">A community alert that only reaches as far as people have agreed to be reached.</p>
    <div class="card">
      <p>Most panic-button apps stop at your direct contacts, or blast an alert to anyone nearby. Kesho does neither: it can reach further, through people your contacts already trust — but every hop is visible, and nobody is added to a network without knowing it.</p>
    </div>
    <button class="btn btn--primary" id="btn-start">Set up my network</button>
    <p class="hint">This demo uses a small set of mock contacts — see README.md for what's real vs. simulated.</p>
  `;
  document.getElementById("btn-start").onclick = () => setState({ screen: "contacts" });
}

function renderContacts() {
  const rows = MY_CONTACTS.map((c) => {
    const on = state.includedContactIds.has(c.id);
    return `
      <div class="contact">
        <span class="avatar">${initials(c.name)}</span>
        <div style="flex:1">
          <div>${c.name}</div>
          <div class="hint">${c.phone}</div>
        </div>
        <button class="toggle ${on ? "is-on" : ""}" data-id="${c.id}" aria-pressed="${on}" aria-label="Include ${c.name}"></button>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <h1>Your trusted circle</h1>
    <p>Only phone numbers are hashed and checked against Kesho's registered users — no contact list is ever uploaded in the clear.</p>
    <div class="card">${rows}</div>
    <button class="btn btn--primary" id="btn-build">Build my network</button>
    <button class="btn btn--ghost" id="btn-back">Back</button>
  `;

  app.querySelectorAll(".toggle").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      state.includedContactIds.has(id) ? state.includedContactIds.delete(id) : state.includedContactIds.add(id);
      render();
    };
  });
  document.getElementById("btn-back").onclick = () => setState({ screen: "welcome" });
  document.getElementById("btn-build").onclick = async () => {
    const included = MY_CONTACTS.filter((c) => state.includedContactIds.has(c.id));
    const hashed = await hashContacts(included);
    const hopNodes = await buildHopGraph(hashed);
    setState({ hopNodes, screen: "consentPreview" });
  };
}

function renderConsentPreview() {
  const hop2 = state.hopNodes.find((n) => n.hop === 2);
  const exampleName = hop2 ? hop2.name : "a friend of a friend";
  const via = hop2 ? hop2.via : "your contact";

  app.innerHTML = `
    <h1>Before you continue</h1>
    <p>Your network now reaches beyond your direct contacts. Here's exactly what someone at hop 2 would see the first time they're linked in — this is shown to <strong>them</strong>, not just logged quietly on your side.</p>
    <div class="notice">
      <h2>🔔 Network notice</h2>
      <p class="lede" style="margin-bottom:10px">"You're now in a safety network via ${via}, up to 2 connections away. You may occasionally receive flagged alerts asking you to verify or help forward. This is visible because you should always be able to see it."</p>
      <div class="row">
        <span class="hint">Example recipient: ${exampleName}</span>
        <button class="btn btn--ghost" style="width:auto;padding:8px 14px;margin:0" id="btn-see-opt-out">Stay in / Opt out</button>
      </div>
    </div>
    <div class="divider"></div>
    <button class="btn btn--primary" id="btn-continue">I understand — continue</button>
  `;
  document.getElementById("btn-see-opt-out").onclick = () => {
    alert("In production, this opens a real choice for that person: stay in the network, or leave it. In this demo it's illustrative only, since there's a single user.");
  };
  document.getElementById("btn-continue").onclick = () => setState({ screen: "main", tab: "home" });
}

function renderHome() {
  const counts = hopCounts(state.hopNodes);
  app.innerHTML = `
    <h1>Your network</h1>
    <p>Built from ${state.includedContactIds.size} trusted contacts.</p>
    <div class="card row">
      <div><span class="pill pill--trust">Hop 1</span></div>
      <strong>${counts[1]} people</strong>
    </div>
    <div class="card row">
      <div><span class="pill pill--caution">Hop 2</span></div>
      <strong>${counts[2]} people</strong>
    </div>
    <div class="card row">
      <div><span class="pill pill--caution">Hop 3</span></div>
      <strong>${counts[3]} people</strong>
    </div>
    <div class="divider"></div>
    <p>Hop 1 contacts see a full alert. Hop 2–3 see a flagged alert asking them to verify before acting — reach without borrowed certainty.</p>
    <button class="btn btn--ghost" id="btn-goto-network">View network map</button>
  `;
  document.getElementById("btn-goto-network").onclick = () => setTab("network");
  bindTabbar();
}

function renderNetwork() {
  app.innerHTML = `
    <h1>Network map</h1>
    <div class="graph-legend">
      <span><span class="graph-legend__dot" style="background:#4FB6A6"></span>Hop 1</span>
      <span><span class="graph-legend__dot" style="background:#E0A458"></span>Hop 2–3</span>
    </div>
    <div class="graph-wrap">${renderHopGraphSVG(state.hopNodes)}</div>
    <div class="card">
      ${state.hopNodes.map((n) => `
        <div class="row" style="padding:6px 0">
          <span>${n.name}${n.verified ? " · verified responder" : ""}</span>
          <span class="pill ${n.hop === 1 ? "pill--trust" : "pill--caution"}">Hop ${n.hop}</span>
        </div>
      `).join("") || `<p>No matches yet in this mock dataset.</p>`}
    </div>
  `;
  bindTabbar();
}

function renderTrigger() {
  const kindLabel = state.triggerKind === "video" ? "Video" : "Audio + alert";
  const shakeArmed = !!state.stopShakeListener;
  app.innerHTML = `
    <h1>Alert</h1>
    <p>Shake is the real, working trigger — a physical gesture that needs no unlock, no visible tap, and works the same on Android and iPhone. You'll feel a short pulse when it's picked up, then a reminder pulse partway through the 6-second window, and a faster, more urgent pulse just before it sends — so a missed first pulse still gets a second and third chance to be noticed. Recording video is a separate, deliberate action, since it means holding the phone up rather than reacting silently.</p>
    <div class="trigger-stage">
      <div class="trigger-dial ${state.triggerPhase !== "idle" ? "is-armed" : ""}">
        <div>
          <div class="trigger-dial__label">${state.triggerPhase === "idle" ? (shakeArmed ? "Shake to alert" : "Not armed yet") : kindLabel}</div>
          <div class="trigger-dial__state">${dialState()}</div>
        </div>
      </div>
      ${state.triggerPhase === "counting" ? `
        <div class="countdown">${(state.countdownMs / 1000).toFixed(1)}s</div>
        <button class="btn btn--ghost" id="btn-cancel">Cancel</button>
      ` : ""}
      ${state.triggerPhase === "idle" ? `
        <button class="btn btn--primary" id="btn-enable-shake" ${shakeArmed ? "disabled" : ""}>${shakeArmed ? "Shake-to-alert armed" : "Enable shake-to-alert"}</button>
        <div class="sim-controls">
          <button class="btn btn--danger" id="btn-test-shake">Test shake trigger<br><span class="hint" style="color:inherit">for this demo, on a laptop</span></button>
          <button class="btn btn--caution" id="btn-record-video">Record video<br><span class="hint" style="color:inherit">manual, deliberate</span></button>
        </div>
      ` : ""}
      ${state.triggerPhase === "sent" ? renderSentDetail() : ""}
    </div>
  `;
  bindTabbar();

  const testBtn = document.getElementById("btn-test-shake");
  const videoBtn = document.getElementById("btn-record-video");
  if (testBtn) testBtn.onclick = () => arm("alert");
  if (videoBtn) videoBtn.onclick = () => arm("video");

  const cancelBtn = document.getElementById("btn-cancel");
  if (cancelBtn) cancelBtn.onclick = () => {
    state.cancelHandle?.();
    stopCapture();
    vibrate(HAPTIC.sendCancelled);
    setState({ triggerPhase: "idle", triggerKind: null, countdownMs: CANCEL_WINDOW_MS });
  };

  const enableShakeBtn = document.getElementById("btn-enable-shake");
  if (enableShakeBtn) enableShakeBtn.onclick = async () => {
    const granted = await requestMotionPermission();
    if (!granted) { alert("Motion permission was not granted."); return; }
    state.stopShakeListener?.();
    state.stopShakeListener = startShakeListener(() => arm("alert"));
    enableShakeBtn.textContent = "Shake-to-alert armed";
    enableShakeBtn.disabled = true;
  };
}

function renderSentDetail() {
  const payload = buildAlertPayload(state.hopNodes, state.triggerKind);
  const items = payload.map((p) => `
    <div class="alert-item">
      <span class="alert-item__dot" style="background:${p.hop === 1 ? "var(--trust)" : "var(--caution)"}"></span>
      <div>
        <div><strong>${p.name}</strong> — ${p.tier.label}</div>
        <div class="hint">${p.tier.detail}</div>
      </div>
    </div>
  `).join("") || `<p>No network matches to notify in this mock dataset.</p>`;

  return `
    <div class="card" style="width:100%;text-align:left;margin-top:10px">
      <h2>Sent — here's what each hop received</h2>
      ${items}
      <div class="divider"></div>
      ${state.recording ? `
        <p class="hint">Local recording captured (${(state.recording.size / 1024).toFixed(0)} KB) — stored on this device only, not uploaded.</p>
        <a href="${state.recording.url}" download="kesho-recording">Download local recording</a>
      ` : `<p class="hint">Recording in progress or unavailable in this browser context.</p>`}
    </div>
    <button class="btn btn--ghost" id="btn-reset-trigger" style="margin-top:14px">Reset</button>
  `;
}

function renderInbox() {
  const sample = [
    { hop: 1, name: "Amara (sister)", note: "Full alert: exact location shared, marked as a direct trusted contact." },
    { hop: 2, name: "Grace (community warden)", note: "Flagged alert: general area only — two connections away, verify before acting." },
  ];
  app.innerHTML = `
    <h1>Inbox — recipient view</h1>
    <p>This is what confidence-tiered alerts look like from the other side, for two example recipients.</p>
    ${sample.map((s) => `
      <div class="card">
        <div class="row">
          <strong>${s.name}</strong>
          <span class="pill ${s.hop === 1 ? "pill--trust" : "pill--caution"}">Hop ${s.hop}</span>
        </div>
        <p style="margin-top:8px">${s.note}</p>
        <button class="btn btn--ghost">${s.hop === 1 ? "Call now" : "Notify a closer contact"}</button>
      </div>
    `).join("")}
  `;
  bindTabbar();
}

// ---------------------------------------------------------------- helpers

function arm(kind) {
  setState({ triggerKind: kind, triggerPhase: "counting", countdownMs: CANCEL_WINDOW_MS });
  vibrate(HAPTIC.recordingStarted);
  startCapture(kind === "video" ? "video" : "audio").catch(() => {});
  // A second, distinct pulse shortly after: recording is already running
  // (no confirmation needed for that, it's local and reversible), but a
  // send to the network is now queued and needs to be felt as a separate,
  // higher-stakes event the person can still stop.
  setTimeout(() => vibrate(HAPTIC.sendQueued), 250);

  // The warning gets more insistent as the window closes, rather than
  // relying on one pulse at the very start that's easy to miss if the
  // phone is in a pocket or bag. Each threshold fires once, as the
  // countdown crosses it going down.
  const escalationThresholds = [
    Math.round(CANCEL_WINDOW_MS * 0.6), // roughly halfway through: a reminder
    1200,                                // final stretch: last chance to cancel
  ];
  const fired = new Set();

  const cancel = startCancellableSend(
    async () => {
      const recording = await stopCapture().catch(() => null);
      vibrate(HAPTIC.sendComplete);
      setState({ triggerPhase: "sent", recording });
    },
    (ms) => {
      escalationThresholds.forEach((threshold) => {
        if (ms <= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          vibrate(threshold <= 1200 ? HAPTIC.sendImminent : HAPTIC.sendQueued);
        }
      });
      setState({ countdownMs: ms });
    }
  );
  state.cancelHandle = cancel;
}

function dialState() {
  if (state.triggerPhase === "idle") return "Tap or shake";
  if (state.triggerPhase === "counting") return "Sending…";
  if (state.triggerPhase === "sent") return "Sent";
  return "";
}

function hopCounts(nodes) {
  const c = { 1: 0, 2: 0, 3: 0 };
  nodes.forEach((n) => { c[n.hop] = (c[n.hop] || 0) + 1; });
  return c;
}

function initials(name) {
  return name.split(" ")[0].slice(0, 2).toUpperCase();
}

function setTab(tab) {
  setState({ tab });
}

function bindTabbar() {
  tabbar.querySelectorAll(".tabbar__btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === state.tab);
    btn.onclick = () => {
      if (btn.dataset.tab === "trigger" && state.triggerPhase === "sent") {
        setState({ triggerPhase: "idle", triggerKind: null, recording: null });
      }
      setTab(btn.dataset.tab);
    };
  });
  // reset-trigger button, if present on this render
  const resetBtn = document.getElementById("btn-reset-trigger");
  if (resetBtn) resetBtn.onclick = () => setState({ triggerPhase: "idle", triggerKind: null, recording: null });
}

export function mount() {
  render();
}
