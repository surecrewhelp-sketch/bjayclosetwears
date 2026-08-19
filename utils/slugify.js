function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function uniqueSlug(base, existingSlugs) {
  let slug = base || 'product';
  let i = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

module.exports = { slugify, uniqueSlug };
