/**
 * Pulls a single HTML document out of a model response. The model is asked to
 * return only the document, but in practice it may wrap it in a Markdown code
 * fence or sandwich it in prose, so we handle both. Falls back to the trimmed
 * input when no HTML markers are found.
 */
export function extractHtml(raw: string): string {
  const text = raw.trim()

  // 1) First fenced code block (```html, ```HTML, or bare ```).
  const fence = text.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/)
  if (fence && fence[1].trim().length > 0) {
    return fence[1].trim()
  }

  // 2) A raw document embedded in prose: slice from the first doctype/<html>
  //    to the last </html>.
  const start = text.match(/<!doctype html|<html[\s>]/i)
  if (start && start.index !== undefined) {
    let doc = text.slice(start.index)
    const close = doc.toLowerCase().lastIndexOf('</html>')
    if (close !== -1) doc = doc.slice(0, close + '</html>'.length)
    return doc.trim()
  }

  // 3) Nothing recognizable — hand back what we got.
  return text
}
