/** Turn any text into a URL slug: "Clutch Plate (Set of 5)" -> "clutch-plate-set-of-5". */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(s: string): boolean {
  return s.length > 0 && s.length <= 120 && SLUG_PATTERN.test(s);
}
