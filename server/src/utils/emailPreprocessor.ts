/**
 * Email Preprocessor — transforms outgoing email HTML to add tracking.
 *
 * 1. Tracking pixel injection: appends a 1x1 transparent image that records opens.
 * 2. Link rewriting: rewrites <a href> URLs to route through the tracking endpoint.
 *
 * Both transformations are skipped when the corresponding campaign flag is false.
 */

export interface PreprocessOptions {
  emailJobId: string;
  trackingBaseUrl: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

/**
 * 1x1 transparent GIF as a base64 data URI fallback.
 * The actual pixel is served by the /track/open endpoint.
 */
const TRACKING_PIXEL_TEMPLATE = (src: string) =>
  `<img src="${src}" width="1" height="1" style="display:block!important;width:1px!important;height:1px!important;border:0!important;margin:0!important;padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;position:absolute!important" alt="" />`;

/**
 * Regex to match <a href="..."> tags.
 * Captures the full tag with attributes, the href value, and preserves the rest.
 * Uses a non-greedy match on the href value to handle both single and double quotes.
 */
const LINK_REGEX = /<a\s([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>/gi;

/**
 * Preprocesses email HTML to inject tracking pixel and rewrite links.
 *
 * - If trackOpens is true, appends a tracking pixel before </body> or at the end.
 * - If trackClicks is true, rewrites all <a href> URLs (except mailto: and #) to
 *   route through /track/click/:emailJobId?url=<encoded>.
 */
export function preprocessEmailHtml(
  html: string,
  options: PreprocessOptions
): string {
  let result = html;

  // Link rewriting (must happen before pixel injection to avoid rewriting the pixel's URL)
  if (options.trackClicks) {
    result = rewriteLinks(result, options);
  }

  // Pixel injection
  if (options.trackOpens) {
    result = injectTrackingPixel(result, options);
  }

  return result;
}

function injectTrackingPixel(html: string, options: PreprocessOptions): string {
  const pixelUrl = `${options.trackingBaseUrl}/track/open/${options.emailJobId}`;
  const pixelTag = TRACKING_PIXEL_TEMPLATE(pixelUrl);

  // Insert before </body> if present, otherwise append to end
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

function rewriteLinks(html: string, options: PreprocessOptions): string {
  return html.replace(LINK_REGEX, (match, before, href, after) => {
    // Skip mailto: links
    if (href.startsWith("mailto:")) return match;
    // Skip anchor links
    if (href.startsWith("#")) return match;
    // Skip already-rewritten tracking links
    if (href.includes("/track/click/")) return match;

    const trackingUrl = `${options.trackingBaseUrl}/track/click/${options.emailJobId}?url=${encodeURIComponent(href)}`;
    return `<a ${before}href="${trackingUrl}"${after}>`;
  });
}
