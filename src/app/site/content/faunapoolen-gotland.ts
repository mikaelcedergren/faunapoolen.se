const ROOT = '/assets/images/faunapoolen/gotland';

interface GotlandPhoto {
  kind: 'photo';
  id: string;
  src: string;
  preview: string;
  width: number;
  height: number;
  alt: string;
}

export interface GotlandFilm {
  kind: 'film';
  id: string;
  number: number;
  duration: string;
  portrait: boolean;
}

function photo(id: string, width: number, height: number, alt: string): GotlandPhoto {
  return {
    kind: 'photo',
    id,
    src: `${ROOT}/${id}.webp`,
    preview: `${ROOT}/${id}-small.webp`,
    width,
    height,
    alt,
  };
}

function film(id: string, number: number, duration: string, portrait = false): GotlandFilm {
  return { kind: 'film', id, number, duration, portrait };
}

// Original project media. Photo order is shared by the gallery and lightbox.
// The portrait film remains in the archive but is not part of the page stories.
export const GOTLAND_MEDIA: readonly (GotlandPhoto | GotlandFilm)[] = [
  photo(
    'gotland-waterfall',
    1920,
    1920,
    $localize`:@@site.gotland.photo.gotland-waterfall:A wooden walkway beside the Gotland nature pool, with natural stone, planting and a small waterfall in warm evening light`,
  ),
  photo(
    '1528',
    1920,
    1440,
    $localize`:@@site.gotland.photo.1528:The nature pool surrounded by stone and greenery, with the house beyond`,
  ),
  film('1226470321', 1, '0:32', false),
  photo(
    '1496',
    1440,
    1920,
    $localize`:@@site.gotland.photo.1496:A view towards the nature pool through a timber window`,
  ),
  photo(
    '1451',
    1920,
    1440,
    $localize`:@@site.gotland.photo.1451:The nature pool seen from the rocks at the water’s edge`,
  ),
  film('1226558236', 3, '0:14', false),
  photo(
    '1437',
    1920,
    1440,
    $localize`:@@site.gotland.photo.1437:The house and nature pool with planting along the water’s edge`,
  ),
  film('1226470011', 2, '0:14', true),
  photo(
    '1525',
    1440,
    1920,
    $localize`:@@site.gotland.photo.1525:Low sunlight over the nature pool and garden`,
  ),
  film('1226558237', 4, '0:12', false),
  photo(
    '1418',
    1440,
    1920,
    $localize`:@@site.gotland.photo.1418:The path down to the pool with Gotland’s open landscape beyond`,
  ),
  photo(
    '1538',
    1440,
    1920,
    $localize`:@@site.gotland.photo.1538:A red flower beside the nature pool at dusk`,
  ),
  film('1226558235', 5, '0:10', false),
  photo(
    '1541',
    1920,
    1440,
    $localize`:@@site.gotland.photo.1541:Underwater lights illuminate the pool between the rocks after dark`,
  ),
];

export const GOTLAND_COPY = {
  view: $localize`:@@site.gotland_copy.view:View gallery`,
  enlarge: $localize`:@@site.gotland_copy.enlarge:Enlarge image`,
  previous: $localize`:@@site.gotland_copy.previous:Previous image`,
  next: $localize`:@@site.gotland_copy.next:Next image`,
  attribution: $localize`:@@site.gotland_copy.attribution:From Brita`,
} satisfies Record<string, string>;

// Case-study context only; these photographs are not part of the shared gallery.
export const GOTLAND_BEFORE = {
  heading: $localize`:@@site.gotland.before.heading:Before the pool`,
  body: $localize`:@@site.gotland.before.body:Gotland is known for its limestone bedrock, with thin soils and exposed rock across large parts of the island. Here, the ground was very hard, with grass, shrubs and scattered trees. Beside the small cottages, an open area offered a natural place for a pool.`,
  photos: [
    photo(
      'before-house',
      1200,
      900,
      $localize`:@@site.gotland.before.house.alt:Small timber cottages and a stone path beside open, grassy ground before the nature pool was built.`,
    ),
    photo(
      'before-landscape',
      1200,
      900,
      $localize`:@@site.gotland.before.landscape.alt:Grass, shrubs, scattered trees and a large stone in the garden before the nature pool was built.`,
    ),
    photo(
      'before-terrace',
      1200,
      1260,
      $localize`:@@site.gotland.before.terrace.alt:View from the main house across the open garden, with three people on the stone terrace before the nature pool was built.`,
    ),
    photo(
      'before-aerial',
      1200,
      1261,
      $localize`:@@site.gotland.before.aerial.alt:Aerial view of the buildings and garden before the nature pool was built, with yellow property boundary markings.`,
    ),
  ],
} as const;

export const GOTLAND_AFTER = {
  heading: $localize`:@@site.gotland.after.heading:The finished pool`,
  body: $localize`:@@site.gotland.after.body:The open space beside the cottages is now a nature pool, edged with natural stone and planting. These films and photographs show the completed project.`,
} as const;

export const GOTLAND_STORIES = [
  {
    film: film('1226470321', 1, '0:32'),
    heading: $localize`:@@site.gotland.story.home.heading:A swimming spot beside the house`,
    body: $localize`:@@site.gotland.story.home.body:Just outside the house, the garden opens onto water. We built this nature pool to feel part of the surroundings, with room for a swim and a place to spend time together.`,
  },
  {
    film: film('1226558236', 3, '0:14'),
    heading: $localize`:@@site.gotland.story.stone.heading:Stone, water and a softer edge`,
    body: $localize`:@@site.gotland.story.stone.body:Natural stone gives the pool its shape, while planting connects the water to the garden. The irregular edges make each view a little different as you move around the pool.`,
  },
  {
    film: film('1226558237', 4, '0:12'),
    heading: $localize`:@@site.gotland.story.garden.heading:Part of the garden, even between swims`,
    body: $localize`:@@site.gotland.story.garden.body:A nature pool brings more to a garden than a place to swim. Reflections, ripples and planting give you something to enjoy from the water’s edge or from inside the house.`,
  },
  {
    film: film('1226558235', 5, '0:10'),
    heading: $localize`:@@site.gotland.story.life.heading:A path into the water`,
    body: $localize`:@@site.gotland.story.life.body:A walkway leads to the stone steps at the pool’s edge. The steps continue below the surface, making the entrance part of the pool’s natural stone edge.`,
  },
] as const;
