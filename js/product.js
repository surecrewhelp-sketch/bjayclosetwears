(async function () {
  const site = await window.BjaySite.load();
  const products = await fetch('/data/products.json').then((r) => r.json());

  const slug = decodeURIComponent(window.location.pathname.replace(/\/+$/, '').split('/').pop());
  const product = products.find((p) => p.slug === slug);

  if (!product) {
    document.getElementById('backToProducts').hidden = true;
    document.getElementById('productContent').hidden = true;
    document.getElementById('notFoundContent').hidden = false;
    return;
  }

  document.title = `${product.name} — ${site.businessName}`;
  document.getElementById('pageDescription').setAttribute('content', product.description);

  document.getElementById('productImage').src = product.image;
  document.getElementById('productImage').alt = product.name;
  document.getElementById('productCategory').textContent = product.category;
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productPrice').textContent = window.BjaySite.formatPrice(site, product.price);
  document.getElementById('productDescription').textContent = product.description;

  document.getElementById('orderBtn').addEventListener('click', () => {
    const message = `Hi ${site.businessName}, I'd like to order: ${product.name} (${window.BjaySite.formatPrice(site, product.price)}).`;
    window.open(window.BjaySite.buildWhatsAppLink(site.whatsappNumber, message), '_blank', 'noopener');
  });

  const MIN_RELATED = 4;
  const MAX_RELATED = 5;

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, MAX_RELATED);

  if (related.length < MIN_RELATED) {
    const usedIds = new Set([product.id, ...related.map((p) => p.id)]);
    const fillers = products
      .filter((p) => !usedIds.has(p.id))
      .sort((a, b) => Number(b.featured) - Number(a.featured));

    for (const p of fillers) {
      if (related.length >= MIN_RELATED) break;
      related.push(p);
    }
  }

  if (related.length) {
    document.getElementById('relatedGrid').innerHTML = related.map((p) => window.BjaySite.productCardHtml(p, site)).join('');
    window.BjaySite.wireProductButtons(related, site);
    document.getElementById('relatedSection').hidden = false;
  }
})();
