/** Einfache Verschiebe-Verschlüsselung für den Bauplan: Buchstaben und Ziffern rotieren. */
export function shiftText(text: string, shift: number) {
  return text.replace(/[A-ZÄÖÜ0-9]/g, (c) => {
    if (c >= '0' && c <= '9') return String((Number(c) + shift + 1000) % 10)
    const plain = c.replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U')
    return String.fromCharCode(((plain.charCodeAt(0) - 65 + shift + 2600) % 26) + 65)
  })
}
