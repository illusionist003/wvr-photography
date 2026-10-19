/* Every business fact on the site lives here. Sources: his Wix site
   (wvrphotography.com, read 2026-10-18). Anything not on that site is an
   open question in docs/OPEN-QUESTIONS.md, not a guess on a page. */

export const BRAND = {
  name: 'WVR Photography',
  owner: 'Matthew Weaver',
  ownerFirst: 'Matthew',
  role: 'Owner and photographer',
  city: 'Fenton',
  region: 'MI',
  regionName: 'Michigan',
  phone: '(248) 759-1578',
  phoneHref: 'tel:+12487591578',
  email: 'Matthew@wvrphotography.com',
  emailHref: 'mailto:Matthew@wvrphotography.com',
  origin: 'https://wvrphotography.com',
} as const;

export const SOCIAL = {
  instagram: 'https://www.instagram.com/wvr.photography/',
  instagramHandle: '@wvr.photography',
  facebook: 'https://www.facebook.com/people/WvrPhotography/61577900592093/',
} as const;

/* The contact form. With no access key the form opens the visitor's email app
   with the request filled in (it still reaches Matthew, and nothing is lost to
   a dead key). Paste a Web3Forms access key here once one is made for
   Matthew@wvrphotography.com and a real test message has arrived. */
export const FORM = {
  web3formsKey: '',
  subject: 'New photo request from wvrphotography.com',
} as const;

export const QUOTE_CTA = 'Get a free quote';
