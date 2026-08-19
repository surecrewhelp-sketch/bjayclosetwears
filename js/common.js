window.BjaySite = (function () {
  let siteData = null;

  async function load() {
    if (siteData) return siteData;
    const res = await fetch('/data/site.json');
    siteData = await res.json();
    return siteData;
  }

  function buildWhatsAppLink(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function formatPrice(site, amount) {
    return `${site.currencySymbol}${amount.toLocaleString('en-NG')}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function productCardHtml(p, site) {
    const href = `/products/${encodeURIComponent(p.slug)}`;
    return `
      <div class="product-card">
        <a class="product-media" href="${href}">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" />
        </a>
        <div class="product-body">
          <span class="product-category">${escapeHtml(p.category)}</span>
          <h3 class="product-name"><a href="${href}">${escapeHtml(p.name)}</a></h3>
          <p class="product-desc">${escapeHtml(p.description)}</p>
          <div class="product-footer">
            <span class="product-price">${formatPrice(site, p.price)}</span>
            <button class="order-btn" data-order-id="${p.id}">Order</button>
          </div>
        </div>
      </div>
    `;
  }

  function wireProductButtons(products, site) {
    document.querySelectorAll('[data-order-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = products.find((p) => p.id === btn.dataset.orderId);
        const message = `Hi ${site.businessName}, I'd like to order: ${product.name} (${formatPrice(site, product.price)}).`;
        window.open(buildWhatsAppLink(site.whatsappNumber, message), '_blank', 'noopener');
      });
    });
  }

  function applyHeaderFooter(site) {
    document.querySelectorAll('[data-logo]').forEach((el) => {
      const parts = site.businessName.split(' ');
      const last = parts.pop();
      el.innerHTML = `${parts.join(' ')} <span>${last}</span>`;
    });

    const waMessage = `Hi ${site.businessName}, I'd like to know more about your products.`;
    const waLink = buildWhatsAppLink(site.whatsappNumber, waMessage);
    document.querySelectorAll('[data-whatsapp-link]').forEach((el) => { el.href = waLink; });

    document.querySelectorAll('[data-instagram-link]').forEach((el) => { el.href = site.instagram; });
    document.querySelectorAll('[data-email-link]').forEach((el) => { el.href = `mailto:${site.email}`; });
    document.querySelectorAll('[data-address]').forEach((el) => { el.textContent = site.address; });
    document.querySelectorAll('[data-brand-name]').forEach((el) => { el.textContent = site.businessName; });
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  function wireNavToggle() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));
  }

  async function init() {
    const site = await load();
    applyHeaderFooter(site);
    wireNavToggle();
    return site;
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

  return { load, buildWhatsAppLink, formatPrice, escapeHtml, productCardHtml, wireProductButtons, init };
})();
