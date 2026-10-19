/* The three things he photographs, each with its own page. Copy is written
   from what his site and portfolio show; no prices, packages, turnaround
   times or guarantees (see docs/OPEN-QUESTIONS.md before adding any). */
import type { PhotoId } from './photos';

export interface Service {
  id: 'events' | 'products' | 'portraits';
  path: string;
  /** Short name for navigation. */
  nav: string;
  name: string;
  /** Card copy on the home page. */
  card: string;
  title: string;
  description: string;
  kicker: string;
  heading: string;
  lede: string;
  hero: PhotoId;
  cardPhoto: PhotoId;
  coversTitle: string;
  covers: { title: string; body: string }[];
  /** Selected work shown on the page, in order. */
  work: PhotoId[];
  reviews: string[];
  faq: { q: string; a: string }[];
}

export const SERVICES: Service[] = [
  {
    id: 'events',
    path: '/event-photography/',
    nav: 'Events',
    name: 'Event photography',
    card: 'Conferences, galas, launches, pop-ups and fight nights. The key moments, the candids and the group photo before everyone leaves.',
    title: 'Event Photographer in Fenton, MI | WVR Photography',
    description: 'Event photography in Fenton, Michigan for conferences, galas, launches, pop-ups and sports nights. Candid, professional coverage. Get a free quote.',
    kicker: 'Event photography in Fenton, Michigan',
    heading: 'Your event, remembered the way it **felt.**',
    lede: 'Conferences, galas, launches, pop-ups and fight nights. I work the room quietly, catch the moments that matter and hand you photos you will be proud to share.',
    hero: 'event-gala-stage',
    cardPhoto: 'event-wine-room-greeting',
    coversTitle: 'Events I cover',
    covers: [
      { title: 'Conferences and masterminds', body: 'Speakers on stage, the room listening, the conversations in the hallway and the group photo at the end of the day.' },
      { title: 'Galas and dinners', body: 'Moments on stage, candids at the tables and the details you spent weeks planning.' },
      { title: 'Launches and pop-ups', body: 'The product, the setup and the people who came out for it.' },
      { title: 'Classes and workshops', body: 'People relaxed and doing the thing, not stiffly posing for a camera in the corner.' },
      { title: 'Sports and fight nights', body: 'Walkouts, the corner and the action in the ring, in fast, low light.' },
      { title: 'Community events', body: 'Mud bogs, car meets and the kind of day that is loud, fast and a little messy.' },
    ],
    work: ['event-mastermind-keynote', 'event-poolside-group', 'event-wine-room-greeting', 'event-coffee-popup-bar', 'sport-ring-faceoff', 'event-mud-truck-smoke'],
    reviews: ['vmari', 'wentworth'],
    faq: [
      { q: 'Will you get in the way of the event?', a: 'No. I keep a low profile and work around your schedule, so your guests stay focused on the event, not the camera.' },
      { q: 'Can you take group photos too?', a: 'Yes. Tell me who needs to be in them and when, and I will keep it quick so nobody misses anything.' },
      { q: 'How far do you travel for events?', a: 'I am based in Fenton. Tell me where your event is and I will confirm travel in your free quote.' },
      { q: 'How do I book my date?', a: `Send the [contact form](/contact/) or call [(248) 759-1578](tel:+12487591578) with the date, the place and what is happening. I will reply with a free quote.` },
    ],
  },
  {
    id: 'products',
    path: '/product-photography/',
    nav: 'Products',
    name: 'Product photography',
    card: 'Clean shots for your website and online store, styled scenes for social, and storefront photos that show people where to find you.',
    title: 'Product Photography in Fenton, MI | WVR Photography',
    description: 'Product photography in Fenton, Michigan: clean online store shots, styled scenes, close details and storefront photos for local businesses. Get a free quote.',
    kicker: 'Product photography in Fenton, Michigan',
    heading: 'Product photos that make people **want it.**',
    lede: 'Clean shots for your online store, styled scenes for social and storefront photos that show people where to find you, lit so the color, shine and texture come through.',
    hero: 'product-crystal-palm-stones',
    cardPhoto: 'product-coffee-bags',
    coversTitle: 'What I photograph',
    covers: [
      { title: 'Clean product shots', body: 'Simple, consistent photos for your website, online store and listings.' },
      { title: 'Styled and lifestyle scenes', body: 'Your product set up the way a customer would see it on the shelf, the table or the counter.' },
      { title: 'Details and texture', body: 'Close work that shows the finish, the color and the shine, the things that sell the piece.' },
      { title: 'Storefronts and interiors', body: 'Your shop inside and out, so people know what to expect before they walk in.' },
      { title: 'Food and drink', body: 'Packaging, the bar setup and the drinks lined up and ready.' },
    ],
    work: ['product-coffee-bags', 'product-crystal-hearts', 'product-coffee-display', 'product-crystal-shop', 'place-dairy-queen', 'engaged-ring-box'],
    reviews: ['minarealm'],
    faq: [
      { q: 'Where does a product shoot happen?', a: 'Often right at your shop, which is how the Minarealm photos were made. We will pick the spot that shows your products best when we plan.' },
      { q: 'Can you photograph my storefront too?', a: 'Yes. Storefront and interior photos help people recognize you from the street and know what to expect inside. See storefronts and shops in the [portfolio](/portfolio/).' },
      { q: 'How many products can you shoot in one session?', a: 'It depends on how much setup each one needs. Send me your list and I will plan the session and quote it.' },
      { q: 'What does product photography cost?', a: 'Every shoot is quoted on what you need. Tell me about your products and where the photos will be used, and I will send a free quote.' },
    ],
  },
  {
    id: 'portraits',
    path: '/portrait-photography/',
    nav: 'Portraits',
    name: 'Portrait photography',
    card: 'Headshots, personal branding, seniors, couples and families. Relaxed sessions with clear direction and good light.',
    title: 'Portrait Photographer in Fenton, MI | WVR Photography',
    description: 'Portrait photography in Fenton, Michigan: headshots, personal branding, seniors, couples, engagements and families. Relaxed sessions. Get a free quote.',
    kicker: 'Portrait photography in Fenton, Michigan',
    heading: 'Portraits that look like you on a **good day.**',
    lede: 'Headshots, personal branding, seniors, couples and families. I keep it relaxed, give clear direction and find the light that flatters you.',
    hero: 'portrait-couple-lake',
    cardPhoto: 'portrait-cowboy-hat',
    coversTitle: 'Sessions I photograph',
    covers: [
      { title: 'Headshots and personal branding', body: 'Confident, natural photos for your website, LinkedIn and the about page you keep meaning to update.' },
      { title: 'Seniors and graduates', body: 'Cap and gown, or just you, somewhere that feels like you.' },
      { title: 'Couples and engagements', body: 'Close, unforced moments, and the ring photos you will want to share.' },
      { title: 'Families and kids', body: 'Real laughs, not forced smiles, while the kids are still willing.' },
      { title: 'Athletes and teams', body: 'Strong, dramatic portraits for the walkout, the season or the poster.' },
    ],
    work: ['portrait-cowboy-hat', 'portrait-graduate-gazebo', 'engaged-embrace', 'portrait-brothers-bench', 'portrait-friends-stairs', 'sport-boxer-corner'],
    reviews: ['wentworth', 'minarealm'],
    faq: [
      { q: 'I hate having my photo taken. Will this be awkward?', a: 'Most people say that before we start. I give simple direction the whole way through, so you never have to guess what to do with your hands.' },
      { q: 'What should I wear?', a: 'Solid colors and clothes you feel good in usually photograph best. We can go over outfits together when we plan.' },
      { q: 'Where do portrait sessions happen?', a: 'Outdoors around Fenton, at your business or somewhere that means something to you. We will pick the spot when we plan.' },
      { q: 'What does a portrait session cost?', a: 'It depends on the type of session and how many people are in it. Tell me what you have in mind and I will send a free quote.' },
    ],
  },
];

export const service = (id: Service['id']) => SERVICES.find((s) => s.id === id)!;

export const STEPS = [
  { title: 'Tell me about it', body: 'Send the form or call with the date, the place and what you want photographed.' },
  { title: 'Get your free quote', body: 'I reply with a quote and a plan: the shot list, the timing and anything that matters to you.' },
  { title: 'Get your photos', body: 'I shoot it, edit the best of it and send you finished photos ready for your website, socials and print.' },
];
