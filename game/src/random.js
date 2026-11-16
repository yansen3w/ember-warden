// A small seeded random source (mulberry32), so a screenshot seed always stages the same
// night: the same moths, the same drops, the same stars. Nothing in the game reads
// Math.random during play; the seed comes from ?seed=N, or a fresh one each visit.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
