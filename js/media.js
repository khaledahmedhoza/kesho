// Trigger detection. Shake is the one trigger this PoC treats as real:
// it works today, in a browser, on a real phone, with no OS-level
// interception problem to solve. (An earlier version of this PoC also
// stood in for hardware volume buttons, but that path is a dead end for
// a web app — and restricted even for native apps on iOS — so it's been
// dropped rather than faked. See README.md → "Trigger options considered".)

const SHAKE_THRESHOLD = 18; // m/s^2 delta — tune per device in real use
let lastShakeCheck = { x: 0, y: 0, z: 0, t: 0 };

export function startShakeListener(onShake) {
  if (typeof DeviceMotionEvent === "undefined") return () => {};

  function handleMotion(event) {
    const a = event.accelerationIncludingGravity;
    if (!a) return;
    const now = Date.now();
    if (now - lastShakeCheck.t < 120) return; // debounce
    const delta =
      Math.abs((a.x || 0) - lastShakeCheck.x) +
      Math.abs((a.y || 0) - lastShakeCheck.y) +
      Math.abs((a.z || 0) - lastShakeCheck.z);
    lastShakeCheck = { x: a.x || 0, y: a.y || 0, z: a.z || 0, t: now };
    if (delta > SHAKE_THRESHOLD) onShake();
  }

  window.addEventListener("devicemotion", handleMotion);
  return () => window.removeEventListener("devicemotion", handleMotion);
}

export async function requestMotionPermission() {
  // iOS 13+ requires an explicit user-gesture permission prompt.
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true; // not required on this platform
}

export function vibrate(pattern) {
  // Confirms a trigger without requiring the person to look at the screen —
  // important, since the whole point of a discreet gesture is not needing
  // to check a display. Feature-detected because iOS Safari does not
  // implement the Vibration API at all (a real platform gap, not a bug
  // here) — a native iOS build would need to use haptics (Core Haptics /
  // UIFeedbackGenerator) instead to get the equivalent effect.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

export const HAPTIC = {
  recordingStarted: [80],           // one short pulse: "we felt that, recording"
  sendQueued: [40, 60, 40],         // three quick pulses: "sending unless you stop it"
  sendImminent: [30, 30, 30, 30, 30], // fast, tighter pulses: "last chance to cancel"
  sendCancelled: [180],             // one longer pulse: "stopped"
  sendComplete: [40, 80, 40, 80, 40], // a short pattern: "sent"
};

// --- Local-only media capture -----------------------------------------
// Recordings are held in memory as object URLs for this demo session and
// are never uploaded anywhere. A production build would encrypt them at
// rest on-device and only transmit on explicit user confirmation.

let activeStream = null;
let recorder = null;
let chunks = [];

export async function startCapture(kind /* "audio" | "video" */) {
  const constraints = kind === "video" ? { audio: true, video: { facingMode: "environment" } } : { audio: true };
  activeStream = await navigator.mediaDevices.getUserMedia(constraints);
  chunks = [];
  recorder = new MediaRecorder(activeStream);
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start();
  return true;
}

export function stopCapture() {
  return new Promise((resolve) => {
    if (!recorder) return resolve(null);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      activeStream?.getTracks().forEach((t) => t.stop());
      activeStream = null;
      recorder = null;
      resolve({ url, size: blob.size });
    };
    recorder.stop();
  });
}
