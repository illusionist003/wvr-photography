/* Content strings may carry two bits of inline markup and nothing else:
     **bold**            and            [link text](/site/path/)
   Everything else is escaped. Links get the base path, and outside links open
   in a new tab. */

import { href, isExternal } from './paths';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function rich(text: string): string {
  let out = escape(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, target: string) => {
    const url = target.replace(/&amp;/g, '&');
    const attrs = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${escape(href(url))}"${attrs}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

/** Plain text for meta descriptions and schema: markup stripped. */
export function plain(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
}

/** A heading as HTML: escaped, a ** phrase set as the accent, and hyphenated
    words kept whole so they never break at the hyphen. */
export function heading(text: string, accentClass = 'accent'): string {
  let out = escape(text).replace(/([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)/g, '<span class="nw">$1</span>');
  out = out.replace(/\*\*([^*]+)\*\*/g, `<span class="${accentClass}">$1</span>`);
  return out;
}
