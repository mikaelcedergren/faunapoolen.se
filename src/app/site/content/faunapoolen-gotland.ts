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
    '1528',
    1920,
    1440,
    $localize`:@@site.gotland.photo.1528:The nature pool surrounded by stone and greenery, with the house beyond`,
  ),
  photo(
    '1455',
    1440,
    1920,
    $localize`:@@site.gotland.photo.1455:Sunlight across the stones beneath the water`,
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
    '1423',
    1920,
    1440,
    $localize`:@@site.gotland.photo.1423:Stone steps leading down into the nature pool`,
  ),
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
  enlarge: $localize`:@@site.gotland_copy.enlarge:Enlarge image`,
  previous: $localize`:@@site.gotland_copy.previous:Previous image`,
  next: $localize`:@@site.gotland_copy.next:Next image`,
  attribution: $localize`:@@site.gotland_copy.attribution:From Britta`,
} satisfies Record<string, string>;

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
    heading: $localize`:@@site.gotland.story.life.heading:Room for everyday moments`,
    body: $localize`:@@site.gotland.story.life.body:For Britta and her grandchildren, the pool has become a place to swim and enjoy being together. This is what we hope to create: a part of your garden that you want to use, day after day.`,
  },
] as const;
