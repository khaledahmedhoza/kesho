import { REGISTERED_USER_GRAPH } from "./data.js";
import { sha256Hex } from "./hashing.js";

const MAX_HOP = 3;

// Builds the hop graph by matching HASHES only — at no point does this
// function compare or transmit a raw phone number. A real backend would
// do the identical walk against its own hashed-contact index.
export async function buildHopGraph(myHashedContacts, maxHop = MAX_HOP) {
  const myHashSet = new Set(myHashedContacts.map((c) => c.hash));

  // Pre-hash the mock "registered user" phone numbers, standing in for
  // a server-side index that would already be stored hashed.
  const registeredEntries = Object.entries(REGISTERED_USER_GRAPH);
  const hashToRecord = new Map();
  for (const [phone, record] of registeredEntries) {
    const hash = await sha256Hex(phone);
    hashToRecord.set(hash, { phone, ...record });
  }

  const nodes = new Map(); // hash -> node
  const queue = [];

  for (const [hash, record] of hashToRecord.entries()) {
    if (myHashSet.has(hash)) {
      nodes.set(hash, { hash, name: record.name, hop: 1, verified: !!record.verified, via: "you" });
      queue.push({ hash, record, hop: 1 });
    }
  }

  while (queue.length) {
    const { record, hop } = queue.shift();
    if (hop >= maxHop) continue;
    for (const nextPhone of record.contacts) {
      const nextHash = await sha256Hex(nextPhone);
      const nextRecord = hashToRecord.get(nextHash);
      if (!nextRecord) continue; // not a registered user — graph stops here
      if (nodes.has(nextHash)) continue; // already reached at an equal/shorter hop
      const node = {
        hash: nextHash,
        name: nextRecord.name,
        hop: hop + 1,
        verified: !!nextRecord.verified,
        via: record.name,
      };
      nodes.set(nextHash, node);
      queue.push({ hash: nextHash, record: nextRecord, hop: hop + 1 });
    }
  }

  return Array.from(nodes.values()).sort((a, b) => a.hop - b.hop);
}

export function renderHopGraphSVG(nodes) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const ringR = { 1: 55, 2: 90, 3: 125 };
  const color = { 1: "#4FB6A6", 2: "#E0A458", 3: "#E0A458" };
  const opacity = { 1: 1, 2: 0.85, 3: 0.6 };

  const byHop = { 1: [], 2: [], 3: [] };
  nodes.forEach((n) => byHop[n.hop]?.push(n));

  let svg = `<svg viewBox="0 0 ${size} ${size}" width="100%" role="img" aria-label="Your safety network, shown by hop distance">`;

  // rings
  [1, 2, 3].forEach((hop) => {
    svg += `<circle cx="${cx}" cy="${cy}" r="${ringR[hop]}" fill="none" stroke="#2C3948" stroke-dasharray="3 4"/>`;
  });

  // center = you
  svg += `<circle cx="${cx}" cy="${cy}" r="16" fill="#4FB6A6"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" fill="#06211C" font-weight="700">You</text>`;

  // nodes
  Object.entries(byHop).forEach(([hop, list]) => {
    const r = ringR[hop];
    const n = list.length || 1;
    list.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="${color[hop]}" opacity="${opacity[hop]}"/>`;
      svg += `<title>${escapeXml(node.name)} — hop ${hop}${node.verified ? " — verified responder" : ""}</title>`;
    });
  });

  svg += `</svg>`;
  return svg;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
}
