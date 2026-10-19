/* His nine galleries, at the same addresses the Wix site used
   (/portfolio-collections/<slug>), so old links and bookmarks keep working.
   Titles follow his own labels; where his spelling and the photos disagree,
   the question is in docs/OPEN-QUESTIONS.md. */
import type { PhotoId } from './photos';

export type Group = 'business' | 'action' | 'people';

export interface Collection {
  slug: string;
  title: string;
  /** Short type label shown on cards. */
  kind: string;
  group: Group;
  /** One or two plain sentences: what is in the gallery. */
  blurb: string;
  cover: PhotoId;
  photos: PhotoId[];
  /** The service page this work belongs to. */
  service: 'events' | 'products' | 'portraits';
  review?: string;
}

export const GROUPS: { id: Group; title: string; intro: string }[] = [
  { id: 'business', title: 'Businesses and events', intro: 'Teams, launches, and shops and the products they sell.' },
  { id: 'action', title: 'Sports and action', intro: 'Fight nights, mud bogs and cars. Fast, loud and in low light.' },
  { id: 'people', title: 'People and places', intro: 'Portraits, couples and the storefronts people drive past every day.' },
];

export const COLLECTIONS: Collection[] = [
  {
    slug: 'wentworth',
    title: 'Wentworth Real Estate',
    kind: 'Events and team photos',
    group: 'business',
    blurb: 'Mastermind days, a gala night and the group photos in between, from a dinner in a wine room to a team lined up along a pool at sunset.',
    cover: 'event-poolside-group',
    photos: ['event-poolside-group', 'event-wine-room-greeting', 'event-gala-stage', 'event-living-room-group', 'event-mastermind-dinner', 'event-pool-group-dusk', 'event-restaurant-group'],
    service: 'events',
    review: 'wentworth',
  },
  {
    slug: 'vmari',
    title: 'Vmari Coffee',
    kind: 'Pop-up event and product',
    group: 'business',
    blurb: 'A coffee pop-up: the bags, the table display and the drinks lined up on the bar.',
    cover: 'product-coffee-bags',
    photos: ['product-coffee-bags', 'product-coffee-display', 'event-coffee-popup-bar'],
    service: 'products',
    review: 'vmari',
  },
  {
    slug: 'minearealm',
    title: 'Minarealm',
    kind: 'Product and storefront',
    group: 'business',
    blurb: 'A crystal shop in Fenton Township. The stones up close, where the color and shine have to come through, and the shop floor.',
    cover: 'product-crystal-palm-stones',
    photos: ['product-crystal-palm-stones', 'product-crystal-hearts', 'product-crystal-shop'],
    service: 'products',
    review: 'minarealm',
  },
  {
    slug: 'oscota-dairy-queen',
    title: 'Dairy Queen',
    kind: 'Storefront',
    group: 'people',
    blurb: 'A classic stone walk-up, shot straight on so the building, the sign and the street all read clearly.',
    cover: 'place-dairy-queen',
    photos: ['place-dairy-queen'],
    service: 'products',
  },
  {
    slug: 'boxing',
    title: 'Boxing',
    kind: 'Sports',
    group: 'action',
    blurb: 'Fight night under the lights, from the walkout to the corner, plus sparring days in the gym.',
    cover: 'sport-ring-faceoff',
    photos: ['sport-ring-faceoff', 'sport-boxer-corner', 'sport-boxer-walkout', 'sport-ring-exchange', 'sport-gym-sparring', 'sport-gym-clinch', 'sport-sprinter'],
    service: 'events',
  },
  {
    slug: 'mud-bogs',
    title: 'Mud bogs',
    kind: 'Motorsport',
    group: 'action',
    blurb: 'Trucks in the pit, smoke in the air and a monster truck clearing the jump.',
    cover: 'event-mud-truck-smoke',
    photos: ['event-mud-truck-smoke', 'event-monster-truck-jump'],
    service: 'events',
  },
  {
    slug: 'cars',
    title: 'Cars',
    kind: 'Automotive',
    group: 'action',
    blurb: 'A Supra in the sun and a Camaro after dark.',
    cover: 'auto-camaro-night',
    photos: ['auto-camaro-night', 'auto-supra'],
    service: 'products',
  },
  {
    slug: 'portraits',
    title: 'Portraits',
    kind: 'Portraits',
    group: 'people',
    blurb: 'Seniors, couples, brothers, friends and personal portraits, mostly outdoors in natural light.',
    cover: 'portrait-couple-lake',
    photos: ['portrait-couple-lake', 'portrait-cowboy-hat', 'portrait-graduate-gazebo', 'portrait-brothers-bench', 'portrait-friends-stairs', 'portrait-friends-lights', 'portrait-fire-spin'],
    service: 'portraits',
  },
  {
    slug: 'engagements',
    title: 'Engagements',
    kind: 'Couples',
    group: 'people',
    blurb: 'Close, quiet moments for a newly engaged couple, and the ring that started it.',
    cover: 'engaged-embrace',
    photos: ['engaged-embrace', 'engaged-dock', 'engaged-ring-box', 'engaged-ring-hand'],
    service: 'portraits',
  },
];

export const collectionPath = (c: Collection) => `/portfolio-collections/${c.slug}/`;
export const collection = (slug: string) => COLLECTIONS.find((c) => c.slug === slug)!;
