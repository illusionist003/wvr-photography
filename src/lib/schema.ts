/* Structured data. One business node on every page; pages add their own. */
import { BRAND, SOCIAL } from '../data/site';

const ORIGIN = BRAND.origin;
export const BUSINESS_ID = `${ORIGIN}/#business`;

export function business() {
  return {
    '@type': 'ProfessionalService',
    '@id': BUSINESS_ID,
    name: BRAND.name,
    description: 'Event, product and portrait photography based in Fenton, Michigan.',
    url: `${ORIGIN}/`,
    telephone: '+1-248-759-1578',
    email: BRAND.email,
    image: `${ORIGIN}/og-image.jpg`,
    logo: `${ORIGIN}/icon-512.png`,
    address: { '@type': 'PostalAddress', addressLocality: BRAND.city, addressRegion: BRAND.region, addressCountry: 'US' },
    areaServed: { '@type': 'City', name: 'Fenton, Michigan' },
    founder: { '@type': 'Person', name: BRAND.owner, jobTitle: 'Photographer' },
    sameAs: [SOCIAL.instagram, SOCIAL.facebook],
    knowsAbout: ['Event photography', 'Product photography', 'Portrait photography'],
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...items].map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${ORIGIN}${it.path}`,
    })),
  };
}

export function serviceNode(name: string, path: string, description: string) {
  return {
    '@type': 'Service',
    name,
    serviceType: name,
    description,
    url: `${ORIGIN}${path}`,
    provider: { '@id': BUSINESS_ID },
    areaServed: { '@type': 'City', name: 'Fenton, Michigan' },
  };
}

export function faqNode(items: { q: string; a: string }[], plain: (s: string) => string) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: plain(it.a) } })),
  };
}

export function graph(nodes: object[]) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}
