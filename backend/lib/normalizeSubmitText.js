const TYPO_FIXES = [
  [/\bphiliphines\b/gi, "Philippines"],
  [/\bphillipines\b/gi, "Philippines"],
  [/\bphilippenes\b/gi, "Philippines"],
  [/\bamoung\b/gi, "among"],
  [/\brecieve\b/gi, "receive"],
  [/\boccured\b/gi, "occurred"],
  [/\bgoverment\b/gi, "government"],
  [/\bdefinately\b/gi, "definitely"],
];

export function normalizeSubmitText(text) {
  let out = text.trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of TYPO_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export const MIN_SUBMIT_WORDS = 8;
