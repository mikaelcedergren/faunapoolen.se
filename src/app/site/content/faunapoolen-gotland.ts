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

// One browsing order for the masonry and photo lightbox. Provenance lives in docs/IMAGERY.md.
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
  film: $localize`:@@site.gotland_copy.film:Film`,
  vimeo: $localize`:@@site.gotland_copy.vimeo:Open on Vimeo`,
} satisfies Record<string, string>;
