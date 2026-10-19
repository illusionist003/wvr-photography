/* Every photo on the site is Matthew's own work, taken from his Wix galleries
   (originals in _source, not committed). `alt` says what is in the frame;
   `caption` is the short line shown under it where a caption is used. A
   caption names a client or place only when his own site did or it is plainly
   in the picture. */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.jpg', { eager: true });
const crops = import.meta.glob<{ default: ImageMetadata }>('../assets/crops/*-m.jpg', { eager: true });

export const PHOTOS = {
  'event-mastermind-keynote': { alt: 'A speaker addresses a seated room in front of screens reading One Day Mastermind', caption: 'One Day Mastermind keynote' },
  'event-wine-room-greeting': { alt: 'Guests greet each other with hugs and handshakes in a room lined with wine racks', caption: 'Arrivals at a mastermind dinner' },
  'event-poolside-group': { alt: 'A large group in matching black shirts poses on a pool deck at sunset, mirrored in the water', caption: 'Group photo at golden hour' },
  'event-living-room-group': { alt: 'A group of about thirty people posed together in a bright living room', caption: 'Team photo, indoors' },
  'event-pool-group-dusk': { alt: 'A group stands along the edge of a backyard pool at dusk', caption: 'Poolside group at dusk' },
  'event-gala-stage': { alt: 'Guests in evening wear stand together on a stage under chandeliers and blue drapes', caption: 'Gala night on stage' },
  'event-mastermind-dinner': { alt: 'Men in black shirts stand with heads bowed beneath a Winners Circle Mastermind sign', caption: 'Winners Circle Mastermind' },
  'event-restaurant-group': { alt: 'A large group poses between dining tables in a restaurant private room', caption: 'Dinner group photo' },
  'event-coffee-popup-bar': { alt: 'Iced coffee drinks lined up on a wooden bar at a coffee pop-up', caption: 'Drinks at a coffee pop-up' },
  'event-mud-truck-smoke': { alt: 'A mud-covered pickup on huge tires churns through a mud pit, black smoke pouring from its stack', caption: 'Mud bog, full throttle' },
  'event-monster-truck-jump': { alt: 'A purple monster truck in mid-air over a dirt jump as a safety worker watches', caption: 'Airborne at the mud bog' },

  'product-coffee-bags': { alt: 'Three gradient coffee bags in pink, gold and orange standing on a dark wooden bench', caption: 'Coffee packaging' },
  'product-coffee-display': { alt: 'Coffee bags, cups and a framed logo arranged on a wooden table display', caption: 'Pop-up display' },
  'product-crystal-palm-stones': { alt: 'A colorful pile of polished palm stones in greens, pinks and golds', caption: 'Polished palm stones' },
  'product-crystal-hearts': { alt: 'Two polished stone hearts, one green and one smoky brown, on a wooden tray', caption: 'Stone hearts, up close' },
  'product-crystal-shop': { alt: 'Shelves of crystals, books and gifts inside a small crystal shop', caption: 'The shop floor' },
  'place-dairy-queen': { alt: 'A small stone Dairy Queen walk-up with its red sign on a clear winter day', caption: 'Dairy Queen storefront' },

  'sport-boxer-corner': { alt: 'A boxer in red gloves leans on the ropes in his corner, a crowd behind him', caption: 'In the corner' },
  'sport-boxer-walkout': { alt: 'A boxer in a red bandana stands in the ring with his team under the lights', caption: 'Walkout' },
  'sport-ring-faceoff': { alt: 'Two boxers square off in an outdoor ring at night, seen from ring level', caption: 'Fight night' },
  'sport-ring-exchange': { alt: 'Two boxers exchange punches in the ring under a dark sky', caption: 'The exchange' },
  'sport-gym-sparring': { alt: 'Two fighters in headgear spar in a gym ring with a red wall behind them', caption: 'Sparring day' },
  'sport-gym-clinch': { alt: 'Two fighters in headgear clinch in a dim boxing gym', caption: 'Inside the gym' },
  'sport-sprinter': { alt: 'A runner in a red and blue Motown jersey mid-stride on a tree-lined street', caption: 'Mid-stride' },

  'portrait-cowboy-hat': { alt: 'A bearded man in a black cowboy hat and leather jacket looks off to the side among bare trees', caption: 'Personal portrait' },
  'portrait-couple-lake': { alt: 'A young man in a dark suit holds a young woman in a sequined dress in front of a lake', caption: 'Couple portrait by the water' },
  'portrait-graduate-gazebo': { alt: 'A graduate in cap, gown and stoles stands in the center of a wooden gazebo', caption: 'Graduation portrait' },
  'portrait-brothers-bench': { alt: 'Three young brothers lean on each other and laugh on a park bench', caption: 'Family portrait' },
  'portrait-friends-stairs': { alt: 'Four friends walk down a white wooden staircase under a bright blue sky', caption: 'Friends portrait' },
  'portrait-friends-lights': { alt: 'Two friends squeeze together and pull faces in front of colorful string lights', caption: 'Just for fun' },
  'portrait-fire-spin': { alt: 'Sparks swirl from a burning wire spun at night, the spinner barely visible in the dark', caption: 'Sparks at night' },
  'portrait-sunglasses': { alt: 'A young man in aviator sunglasses and a black shirt looks to the side in a sunny field', caption: 'Outdoor portrait' },

  'engaged-embrace': { alt: 'A couple embraces by a window, her eyes closed and his lips on her forehead', caption: 'Engagement session' },
  'engaged-dock': { alt: 'A couple leans on a wooden dock railing, arms around each other, looking over a pond', caption: 'On the dock' },
  'engaged-ring-box': { alt: 'A diamond engagement ring in an open wooden ring box', caption: 'The ring' },
  'engaged-ring-hand': { alt: 'A hand wearing a diamond engagement ring against a dark background', caption: 'Ring detail' },

  'auto-supra': { alt: 'A white Toyota Supra parked at a curb under a blue summer sky', caption: 'Toyota Supra' },
  'auto-camaro-night': { alt: 'An orange Chevrolet Camaro at night with glowing blue headlight rings', caption: 'Camaro after dark' },
} as const;

export type PhotoId = keyof typeof PHOTOS;

export function photo(id: PhotoId) {
  const file = files[`../assets/photos/${id}.jpg`];
  if (!file) throw new Error(`photo file missing: ${id}`);
  const crop = crops[`../assets/crops/${id}-m.jpg`];
  return { id, ...PHOTOS[id], src: file.default, phone: crop?.default };
}
