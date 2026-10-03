export const PACKAGE_IDS = ['glade', 'summer', 'horizon'] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];
export type PackageLanguage = 'en' | 'sv' | 'da';
export interface PackageValues {
  id: PackageId;
  titles: Record<PackageLanguage, string>;
  price: number;
}
export interface PackageCatalogue {
  revision: number;
  packages: PackageValues[];
}
export interface PackageService {
  read(): PackageCatalogue;
  update(value: unknown): PackageCatalogue;
}
