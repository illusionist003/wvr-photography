/* What his clients wrote, as published on his own site. Kept word for word;
   the long one is shortened with an ellipsis, never reworded. */

export interface Review {
  id: string;
  name: string;
  business: string;
  text: string;
  collection?: string;
}

export const REVIEWS: Review[] = [
  {
    id: 'wentworth',
    name: 'Christian Wentworth',
    business: 'Wentworth Real Estate',
    text: 'Matthew showed up on time and professionally. Photos all turned out great and he provided PLENTY of photos for us.',
    collection: 'wentworth',
  },
  {
    id: 'minarealm',
    name: 'Cynthia Rodriguez',
    business: 'Owner, Minarealm',
    text: 'Matthew did an incredible job photographing my crystals at Minarealm Crystals! He captured the shine, color, and energy of each piece perfectly. The photos are stunning and make my products stand out. … He is so kind and genuine, we love working with Matthew!',
    collection: 'minearealm',
  },
  {
    id: 'vmari',
    name: 'Neveah Wyper',
    business: 'Owner, Vmari Coffee',
    text: 'I absolutely LOVE how my photos turned out for my pop up coffee event. Matthew was professional, communicative, and the pictures were beautiful! Highly recommend to any business looking for an event photographer!!',
    collection: 'vmari',
  },
];

export const review = (id: string) => REVIEWS.find((r) => r.id === id);
