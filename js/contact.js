(async function () {
  const site = await window.BjaySite.load();

  document.querySelectorAll('[data-email-text]').forEach((el) => { el.textContent = site.email; });

  const form = document.getElementById('enquireForm');
  const successMessage = document.getElementById('formSuccess');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('enqName').value.trim();
    const phone = document.getElementById('enqPhone').value.trim();
    const message = document.getElementById('enqMessage').value.trim();
    const text = `Hi ${site.businessName}, my name is ${name} (${phone}). ${message}`;
    window.open(window.BjaySite.buildWhatsAppLink(site.whatsappNumber, text), '_blank', 'noopener');
    form.reset();
    successMessage.hidden = false;
  });
})();
