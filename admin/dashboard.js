(function () {
  let products = [];
  let currentCategory = 'All';
  let uploadedImageUrl = '';

  const tableBody = document.getElementById('productTableBody');
  const productCount = document.getElementById('productCount');
  const listError = document.getElementById('listError');

  const productModalOverlay = document.getElementById('productModalOverlay');
  const productModalTitle = document.getElementById('productModalTitle');
  const productForm = document.getElementById('productForm');
  const formError = document.getElementById('formError');

  const passwordModalOverlay = document.getElementById('passwordModalOverlay');
  const passwordForm = document.getElementById('passwordForm');
  const passwordError = document.getElementById('passwordError');
  const passwordSuccess = document.getElementById('passwordSuccess');

  init();

  async function init() {
    const session = await fetch('/admin/api/session', { credentials: 'same-origin' }).then((r) => r.json());
    if (!session.loggedIn) {
      window.location.href = '/admin/login';
      return;
    }
    wireEvents();
    await loadProducts();
  }

  function wireEvents() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
    document.getElementById('productModalClose').addEventListener('click', closeProductModal);
    document.getElementById('productCancelBtn').addEventListener('click', closeProductModal);
    productModalOverlay.addEventListener('click', (e) => { if (e.target === productModalOverlay) closeProductModal(); });
    productForm.addEventListener('submit', handleProductSubmit);
    document.getElementById('productImageFile').addEventListener('change', handleImageUpload);

    document.getElementById('changePasswordBtn').addEventListener('click', openPasswordModal);
    document.getElementById('passwordModalClose').addEventListener('click', closePasswordModal);
    document.getElementById('passwordCancelBtn').addEventListener('click', closePasswordModal);
    passwordModalOverlay.addEventListener('click', (e) => { if (e.target === passwordModalOverlay) closePasswordModal(); });
    passwordForm.addEventListener('submit', handlePasswordSubmit);

    document.getElementById('adminFilterBar').querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        currentCategory = chip.dataset.category;
        document.querySelectorAll('#adminFilterBar .filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        renderTable();
      });
    });
  }

  async function logout() {
    await fetch('/admin/api/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = '/admin/login';
  }

  async function loadProducts() {
    listError.hidden = true;
    try {
      const res = await fetch('/admin/api/products', { credentials: 'same-origin' });
      if (res.status === 401) return (window.location.href = '/admin/login');
      if (!res.ok) throw new Error('Failed to load products.');
      products = await res.json();
      renderTable();
    } catch (err) {
      listError.textContent = err.message;
      listError.hidden = false;
    }
  }

  function renderTable() {
    const list = currentCategory === 'All' ? products : products.filter((p) => p.category === currentCategory);
    productCount.textContent = `${products.length} product${products.length === 1 ? '' : 's'} total — showing ${list.length}`;

    if (!list.length) {
      tableBody.innerHTML = `<tr class="empty-row"><td colspan="6">No products in this category yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map((p) => `
      <tr>
        <td><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" /></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>₦${Number(p.price).toLocaleString('en-NG')}</td>
        <td><span class="badge ${p.featured ? 'on' : ''}">${p.featured ? 'Featured' : 'Not featured'}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit="${p.id}">Edit</button>
            <button type="button" class="delete-btn" data-delete="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tableBody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openProductModal(products.find((p) => p.id === btn.dataset.edit)));
    });
    tableBody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteProduct(btn.dataset.delete));
    });
  }

  function openProductModal(product) {
    formError.hidden = true;
    uploadedImageUrl = '';
    productForm.reset();
    document.getElementById('productImagePreview').hidden = true;

    if (product) {
      productModalTitle.textContent = 'Edit Product';
      document.getElementById('productId').value = product.id;
      document.getElementById('productName').value = product.name;
      document.getElementById('productCategory').value = product.category;
      document.getElementById('productPrice').value = product.price;
      document.getElementById('productDescription').value = product.description;
      document.getElementById('productFeatured').checked = !!product.featured;
      uploadedImageUrl = product.image;
      showImagePreview(product.image);
    } else {
      productModalTitle.textContent = 'Add Product';
      document.getElementById('productId').value = '';
    }

    productModalOverlay.hidden = false;
  }

  function closeProductModal() {
    productModalOverlay.hidden = true;
  }

  function showImagePreview(url) {
    const preview = document.getElementById('productImagePreview');
    if (!url) { preview.hidden = true; return; }
    preview.src = url;
    preview.hidden = false;
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    formError.hidden = true;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/admin/api/upload', { method: 'POST', credentials: 'same-origin', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      uploadedImageUrl = data.url;
      showImagePreview(data.url);
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
      e.target.value = '';
    }
  }

  async function handleProductSubmit(e) {
    e.preventDefault();
    formError.hidden = true;

    if (!uploadedImageUrl) {
      formError.textContent = 'Please upload a product image.';
      formError.hidden = false;
      return;
    }

    const id = document.getElementById('productId').value;
    const payload = {
      name: document.getElementById('productName').value.trim(),
      category: document.getElementById('productCategory').value,
      description: document.getElementById('productDescription').value.trim(),
      price: Number(document.getElementById('productPrice').value),
      image: uploadedImageUrl,
      featured: document.getElementById('productFeatured').checked,
    };

    const saveBtn = document.getElementById('productSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const res = await fetch(id ? `/admin/api/products/${id}` : '/admin/api/products', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save product.');

      closeProductModal();
      await loadProducts();
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Product';
    }
  }

  async function deleteProduct(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/admin/api/products/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete product.');
      await loadProducts();
    } catch (err) {
      listError.textContent = err.message;
      listError.hidden = false;
    }
  }

  function openPasswordModal() {
    passwordForm.reset();
    passwordError.hidden = true;
    passwordSuccess.hidden = true;
    passwordModalOverlay.hidden = false;
  }

  function closePasswordModal() {
    passwordModalOverlay.hidden = true;
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    passwordError.hidden = true;
    passwordSuccess.hidden = true;

    try {
      const res = await fetch('/admin/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentPassword: document.getElementById('currentPassword').value,
          newPassword: document.getElementById('newPassword').value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update password.');

      passwordSuccess.textContent = 'Password updated successfully.';
      passwordSuccess.hidden = false;
      passwordForm.reset();
    } catch (err) {
      passwordError.textContent = err.message;
      passwordError.hidden = false;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
