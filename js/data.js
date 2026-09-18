// Mock data only. In production, "ME"'s contacts would come from the
// device's real contact list (with permission), and the "registered user
// graph" would live server-side, storing only hashed phone numbers —
// never raw contacts. See README.md → "What's simulated vs real".

export const ME = { id: "me", name: "You", phone: "+254700000000" };

// The user's own phone contacts (as if read from the device address book).
export const MY_CONTACTS = [
  { id: "c1", name: "Amara (sister)", phone: "+254700000101" },
  { id: "c2", name: "Brian (workmate)", phone: "+254700000102" },
  { id: "c3", name: "Cynthia (neighbour)", phone: "+254700000103" },
  { id: "c4", name: "David (landlord)", phone: "+254700000104" },
  { id: "c5", name: "Faith (old classmate)", phone: "+254700000105" },
];

// A tiny mock of "who else already uses Kesho," represented as a graph of
// registered users and THEIR contacts (also hashed, in a real system).
// This lets us compute real hop-2 / hop-3 reach from mock hop-1 matches,
// using the same BFS a real backend would run — the graph logic itself
// is not faked, only the underlying phone numbers are.
export const REGISTERED_USER_GRAPH = {
  "+254700000101": { name: "Amara", contacts: ["+254700000201", "+254700000202"] },
  "+254700000103": { name: "Cynthia", contacts: ["+254700000201", "+254700000203", "+254700000204"] },
  "+254700000201": { name: "Grace (community warden)", contacts: ["+254700000301"], verified: true },
  "+254700000202": { name: "Henry", contacts: [] },
  "+254700000203": { name: "Irene", contacts: ["+254700000301", "+254700000302"] },
  "+254700000204": { name: "James", contacts: [] },
  "+254700000301": { name: "Kevin (local clinic contact)", contacts: [] },
  "+254700000302": { name: "Lucy", contacts: [] },
};
