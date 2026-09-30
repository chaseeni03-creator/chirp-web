// Shared PIN hashing (Web Crypto — no dependency). Used by both groups.js
// (per-group guest PINs) and leaderboardIdentity.js (global nickname
// claims) — same scheme, one source of truth instead of two copies.
//
// Note: guest reads are public RPCs in both systems, so this hash is
// readable by anyone who already knows the nickname it belongs to. Hashing
// stops a plaintext PIN showing up in a network tab, but a 4-digit space
// (10,000 combos) is not a real secret against someone willing to
// brute-force it offline — a nickname-squatting deterrent, not a security
// boundary.
export async function hashPin(pin) {
  const data = new TextEncoder().encode(`chirp-sports-guest-pin:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
