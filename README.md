# Kesho — a consented community safety network

Proof of concept for the **Andela × Open Society Foundations civic tech hackathon**,
Safety, Reporting & Protection track.

> "Kesho" (Swahili: *tomorrow*) — reporting a threat should open a path forward,
> not just log an incident.

## The problem this addresses

Underreporting of violence and threats across Africa is driven less by the absence
of technology than by well-documented barriers: fear of retaliation, distrust of
formal channels, and — critically — the risk of being seen or heard while reporting.
Existing panic-button apps (Woza, Usalama, and others) already solve *discreet
triggering* well. What none of them address is what happens once an alert needs to
reach further than a person's direct contacts: today that means either stopping at
hop-1, or broadcasting to "anyone nearby" with no way for recipients to know why
they were contacted, or how much to trust it.

**This PoC's actual contribution is the graph and consent model, not the trigger
gesture.** The trigger UI is included to make the concept demoable end-to-end, not
because it's the novel part — see `docs/market-research.md`-equivalent reasoning
in the write-up for why.

## What it demonstrates

1. **Privacy-preserving contact discovery** — phone numbers are SHA-256 hashed
   client-side (`js/hashing.js`) before ever being "matched" against a mock
   registered-user index, the same pattern Signal/WhatsApp use. No raw contact
   list is transmitted in this design.
2. **A real hop-graph walk** — `js/graph.js` runs an actual breadth-first search
   over a small mock social graph (`js/data.js`) to find hop-1/2/3 reach, matched
   purely on hash equality. The graph logic is real; only the underlying mock
   phone numbers are fake.
3. **Advance, visible consent** — before continuing, the app shows the exact
   one-time notice a hop-2 person would receive the first time they're linked in,
   with a stay-in/opt-out control. This is the feature meant to differentiate the
   submission: reach is opt-out-able *before* an emergency, not just labelled
   during one.
4. **Confidence-tiered alerts** — `js/alerts.js` gives hop-1 recipients a full
   alert with clear next actions ("Call now"), while hop-2/3 recipients get a
   flagged alert that asks them to verify or forward, not to act as if they
   personally know the person. `js/data.js` also includes an optional "verified
   responder" flag (e.g. a community warden) that a production build would use to
   route distant hops toward accountable local nodes rather than random strangers.
5. **A 3-second cancel window** before any alert actually "sends," to guard
   against accidental triggers spamming a person's network.
6. **Real on-device media capture** — `js/media.js` uses `MediaRecorder` and
   `getUserMedia` to actually record audio/video in the browser. Recordings stay
   local (an in-memory object URL you can download) and are never uploaded —
   matching the privacy stance discussed in the project's design notes.
7. **Real shake detection, and only shake** — `DeviceMotionEvent` detects a
   physical shake as the trigger for a silent audio alert. Video capture is a
   separate, deliberate button tap rather than a second shake pattern, since it
   requires holding the phone up and isn't something you'd want to happen by
   accident.
8. **Vibration confirmation, and it escalates** — `js/media.js` uses the
   Vibration API so the person gets physical feedback without needing to look
   at the screen: a short pulse when the shake is picked up (recording is
   running), a reminder pulse partway through the 6-second send window, a
   faster/tighter pulse in the final ~1.2 seconds before it actually sends, one
   more if they cancel it, and a closing pattern once it sends. The window is
   6 seconds rather than 3, and the pulses get more insistent as it closes,
   specifically so a missed first pulse (phone in a pocket or bag) still gets
   a second and third chance to be noticed before an accidental trigger
   reaches other people. **iOS Safari does not implement the Vibration API at
   all** — this works on Android browsers today; a native iOS build would need
   Core Haptics / `UIFeedbackGenerator` for the same effect.

### Trigger options considered, and why shake is the one this PoC treats as real

Hardware volume-button interception was explored and dropped rather than
half-built: a web app cannot catch volume keys in the background on either
platform, and iOS restricts this for native apps too, by design, as a
security/abuse safeguard — not a bug to work around. Rather than fake that
trigger with an on-screen substitute, this PoC keeps shake as the single real,
working, cross-platform trigger. For a native production build, the credible
next options — in rough order of how portable/reliable they are — are:

1. **Shake** (this PoC) — works today on Android and iOS alike, no special permission beyond motion access.
2. **OS-native gesture hooks** — iOS Back Tap (Settings → Accessibility) or the iPhone Action Button, both of which can launch an app/Shortcut without fighting the OS.
3. **Apple Emergency SOS** — build alongside it rather than compete with it; iOS's own 5-click side-button SOS is not something a third-party app can intercept directly.
4. **A dedicated Bluetooth SOS button** — sidesteps every OS restriction at the cost of requiring a second physical object (this is why SOS Naija ships one).
5. **Voice/wake-word** — technically possible, but an always-listening mic has real battery and privacy costs, and speaking a phrase is often the opposite of discreet in an actual threat situation.

## What's simulated, and why

| Simulated | Real system would need |
|---|---|
| Mock contact list & mock registered-user graph (`js/data.js`) | Actual device contact list (with OS permission) and a server-side hashed-contact index |
| "Sending" an alert (rendered as a list, not delivered anywhere) | A backend + push notifications, with an **SMS fallback** (e.g. Africa's Talking, Twilio) for the ~1 billion people across Africa not on mobile internet — this is the most important gap for real-world reach, not a nice-to-have |
| Encrypted storage of recordings | On-device encryption at rest, and an explicit user action before any upload/escalation |
| Opt-out actually removing a person from someone else's graph | A backend that enforces this server-side; in this demo it's a single-user illustration |
| Manual "Test shake trigger" button | A stand-in only for demoing on a laptop, where there's no accelerometer to shake — on a real phone, the shake listener above is the actual trigger |

## Running it

No build step, no dependencies. Because it uses ES modules, open it through a
local server rather than `file://`:

```bash
cd safety-network-poc
python3 -m http.server 8000
# then open http://localhost:8000 in a browser
```

Shake detection and camera/mic capture require a real device (or a desktop
browser's permission prompts) and, for camera/mic, either `localhost` or HTTPS.

## Legal & regulatory notes

- Contact hashing and the opt-in/opt-out hop model are designed with **Kenya's
  Data Protection Act (2019)** in mind, given the hackathon's Kenya focus —
  personal data of third parties (hop-2/3 contacts) should never be processed
  without their own knowledge, which is the reason the consent-preview screen
  exists as a first-class step, not a settings toggle.
- Recording audio/video of another person without consent is legally sensitive
  and varies by jurisdiction; this PoC keeps recordings local-only until a user
  chooses to share them, rather than auto-broadcasting captured media.

## Differentiation from existing apps

Woza (South Africa) and Usalama (Kenya) both already ship shake-triggered panic
buttons with community alerts. This PoC doesn't try to out-build those on the
trigger mechanic — it proposes the piece none of the reviewed competitors have:
a multi-hop network where reach is transparent and trust is labelled by
distance, so extending a safety network doesn't mean extending it blindly.

## Next steps for a production build

1. Real device contact access + server-side hashed index for discovery.
2. Native app (not web) to get real hardware-trigger access on Android, and a
   design workaround for iOS's background restrictions.
3. SMS-based alert fallback for low-connectivity users.
4. A verified-responder layer (community wardens, NGO partners) as the default
   target for hop-2/3 alerts, instead of arbitrary friends-of-friends.
5. Legal review per target country before handling recorded evidence.

## License

MIT — see `LICENSE`.
