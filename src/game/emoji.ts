/** Erlaubt Emojis, Satzzeichen und Leerzeichen, aber keine Buchstaben oder Ziffern. */
export function isEmojiOnly(text: string) {
  const withoutKeycaps = text.replace(/[0-9#*]️?⃣/gu, '🔢')
  return withoutKeycaps.trim().length > 0 && !/[\p{L}\p{N}]/u.test(withoutKeycaps)
}
