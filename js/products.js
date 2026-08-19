(async function () {
  const site = await window.BjaySite.load();
  const products = await fetch('/data/products.json').then((r) => r.json());

  let currentCategory = 'All';
  let searchTerm = '';
  let sortMode = 'default';

  wireFilters();
  wireSearch();
  wireSort();
  render();

  function getFilteredList() {
    let list = currentCategory === 'All'
      ? products
      : products.filter((p) => p.category === currentCategory);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
    }

    list = [...list];
    if (sortMode === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sortMode === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (sortMode === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => Number(b.featured) - Number(a.featured));

    return list;
  }

  function render() {
    const grid = document.getElementById('productGrid');
    const list = getFilteredList();

    document.getElementById('resultCount').textContent = list.length
      ? `Showing ${list.length} of ${products.length} products`
      : '';

    if (!list.length) {
      grid.innerHTML = `<p class="empty-state">No products match your search. Try a different keyword or category.</p>`;
      return;
    }

    grid.innerHTML = list.map((p) => window.BjaySite.productCardHtml(p, site)).join('');
    window.BjaySite.wireProductButtons(products, site);
  }

  function wireFilters() {
    const filterBar = document.getElementById('filterBar');
    filterBar.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        currentCategory = chip.dataset.category;
        filterBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        render();
      });
    });
  }

  function wireSearch() {
    const input = document.getElementById('searchInput');
    input.addEventListener('input', () => {
      searchTerm = input.value.trim();
      render();
    });
  }

  function wireSort() {
    const select = document.getElementById('sortSelect');
    select.addEventListener('change', () => {
      sortMode = select.value;
      render();
    });
  }
})();
