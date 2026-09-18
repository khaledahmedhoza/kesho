// Turns a hop-graph into what each recipient actually sees. The point
// being demonstrated: reach doesn't imply certainty — a hop-3 stranger
// gets told to verify, not told to come running.

const TIER_COPY = {
  1: {
    label: "Trusted contact",
    detail: "Full alert: your location, and a note this is someone they know directly.",
    actions: ["Call now", "I'm on my way"],
  },
  2: {
    label: "Extended network — verify first",
    detail: "Flagged alert: general area only, labelled as two connections away.",
    actions: ["Notify a closer contact", "Can't help, forward to others nearby"],
  },
  3: {
    label: "Extended network — verify first",
    detail: "Flagged alert: general area only, labelled as three connections away.",
    actions: ["Notify a closer contact", "Can't help, forward to others nearby"],
  },
};

export function buildAlertPayload(nodes, triggerKind) {
  return nodes.map((n) => ({
    ...n,
    triggerKind,
    tier: TIER_COPY[n.hop],
  }));
}

// 6 seconds, not 3: a silent, vibration-only warning needs enough time for
// someone to actually notice a pulse (phone in a pocket or bag) and react —
// 3s was tuned for "send fast," not for "give a false trigger a real chance
// to be caught." See media.js's escalating pulses for the other half of
// this tradeoff: the warning gets more insistent as time runs out, rather
// than making the whole window longer at a single, flat intensity.
export const CANCEL_WINDOW_MS = 6000;

export function startCancellableSend(onFire, onTick) {
  let remaining = CANCEL_WINDOW_MS;
  const interval = setInterval(() => {
    remaining -= 100;
    onTick(Math.max(remaining, 0));
    if (remaining <= 0) {
      clearInterval(interval);
      onFire();
    }
  }, 100);
  return () => clearInterval(interval); // returns a cancel function
}
