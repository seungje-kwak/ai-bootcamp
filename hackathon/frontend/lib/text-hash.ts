/** FNV-1a (32-bit) over UTF-16 code units, base 36. Used only to tell whether a reviewed
 *  translation still belongs to the English text the API returned. */
export function textHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
