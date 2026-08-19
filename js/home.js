(async function () {
  const site = await window.BjaySite.load();
  const [products, testimonials] = await Promise.all([
    fetch('/data/products.json').then((r) => r.json()),
    fetch('/data/testimonials.json').then((r) => r.json()),
  ]);

  document.getElementById('heroTagline').textContent = site.tagline;
  document.getElementById('heroDescription').textContent = site.description;
  document.getElementById('heroImage').src = site.heroImage;
  document.getElementById('heroImage').alt = `A collection of women's and men's clothing, shoes and bags from ${site.businessName}`;

  renderWhyUs(site.whyUs);
  renderFeaturedProducts(products.filter((p) => p.featured).slice(0, 4));
  renderTestimonials(testimonials);
  window.BjaySite.wireProductButtons(products, site);

  function renderWhyUs(items) {
    document.getElementById('whyGrid').innerHTML = items.map((item) => `
      <div class="why-card">
        <div class="why-icon">${item.icon}</div>
        <h3>${window.BjaySite.escapeHtml(item.title)}</h3>
        <p>${window.BjaySite.escapeHtml(item.text)}</p>
      </div>
    `).join('');
  }

  function renderFeaturedProducts(items) {
    document.getElementById('productGrid').innerHTML = items.map((p) => window.BjaySite.productCardHtml(p, site)).join('');
  }

  function renderTestimonials(items) {
    document.getElementById('testimonialGrid').innerHTML = items.map((t) => `
      <div class="testimonial-card">
        <p class="testimonial-quote">${window.BjaySite.escapeHtml(t.quote)}</p>
        <div class="testimonial-person">
          <div class="avatar">${window.BjaySite.escapeHtml(t.initials)}</div>
          <div>
            <h4>${window.BjaySite.escapeHtml(t.name)}</h4>
            <span>${window.BjaySite.escapeHtml(t.location)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
})();
