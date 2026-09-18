// Real hashing (SubtleCrypto, SHA-256) — this part is not simulated.
// The point being demonstrated: a phone number never needs to leave the
// device in the clear for "which of my contacts also use this app" to
// work. A production server would store only these hashes and return
// matches, the same pattern Signal/WhatsApp use for contact discovery.

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashContacts(contacts) {
  const hashed = [];
  for (const c of contacts) {
    hashed.push({ ...c, hash: await sha256Hex(c.phone) });
  }
  return hashed;
}
