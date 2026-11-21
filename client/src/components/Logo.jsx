/**
 * Brand artwork.
 *
 * The supplied SYXTEAM logo is used as-is (cropped only, never redrawn). Its
 * emblem is white + orange with a black background, so two crops are shipped:
 *
 *   logo-emblem.png        white "S" + orange swoosh — for dark backgrounds
 *                          (sidebar, login brand panel, favicon tile)
 *   logo-emblem-light.png  charcoal "S" + orange swoosh — for light surfaces
 *                          (mobile login header, loading screens)
 *
 * Only the neutral white pixels were recoloured in the light variant; the
 * orange and the geometry are untouched, so proportions/appearance are
 * preserved. Use `tone="dark"` when the surrounding surface is dark.
 */
export function Logo({ tone = 'dark', height = 32, className = '', style, alt = 'SYXTEAM' }) {
  const src = tone === 'light' ? '/brand/logo-emblem-light.png' : '/brand/logo-emblem.png';
  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      style={{ height, width: 'auto', ...style }}
      width={890}
      height={517}
      draggable="false"
    />
  );
}

/**
 * Wordmark crop of the supplied logo. Recropped from the original artwork
 * (never redrawn). Rendered in white on dark surfaces.
 */
export function LogoWordmark({ height = 18, className = '', style, alt = 'SYXTEAM' }) {
  return (
    <img
      src="/brand/logo-wordmark.png"
      alt={alt}
      className={`brand-lockup ${className}`.trim()}
      style={{ height, width: 'auto', ...style }}
      width={1037}
      height={122}
      draggable="false"
    />
  );
}

/** Full horizontal lockup (emblem + SYXTEAM wordmark). */
export function LogoLockup({ height = 40, className = '', style, alt = 'SYXTEAM' }) {
  return (
    <img
      src="/brand/logo-lockup.png"
      alt={alt}
      className={`brand-lockup ${className}`.trim()}
      style={{ height, width: 'auto', ...style }}
      width={1080}
      height={702}
      draggable="false"
    />
  );
}
