/**
 * Builds the HTTP response for a published site.
 *
 * The crucial header is `Content-Security-Policy: sandbox`. Applied to a
 * top-level document it forces an *opaque* origin: the page's own inline and
 * CDN scripts still run (allow-scripts), but the document cannot read cookies
 * or localStorage — so even though we serve user HTML from the app's own
 * registrable domain at /s/<slug>, it can't touch the dashboard's session.
 * This mirrors the sandbox of the in-app preview iframe (no allow-same-origin).
 */
export function serveSiteHtml(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        'sandbox allow-scripts allow-forms allow-popups allow-modals',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}

export function notFoundSite(): Response {
  return new Response('Site not found.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
