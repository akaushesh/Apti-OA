export function getSeededRandom(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = Math.imul(31, seed) + seedStr.charCodeAt(i) | 0;
  }
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function seededShuffle(array, seedStr) {
  if (!array || !array.length) return [];
  const random = getSeededRandom(seedStr);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
