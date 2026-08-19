(async function () {
  const site = await window.BjaySite.load();
  const about = await fetch('/data/about.json').then((r) => r.json());

  document.getElementById('aboutHeading').textContent = about.heading;
  document.getElementById('aboutSubheading').textContent = about.subheading;

  document.getElementById('storyParagraphs').innerHTML = about.story
    .map((p) => `<p>${window.BjaySite.escapeHtml(p)}</p>`)
    .join('');

  document.getElementById('statsGrid').innerHTML = about.stats.map((s) => `
    <div class="stat-card">
      <div class="stat-value">${window.BjaySite.escapeHtml(s.value)}</div>
      <div class="stat-label">${window.BjaySite.escapeHtml(s.label)}</div>
    </div>
  `).join('');

  document.getElementById('whyGrid').innerHTML = site.whyUs.map((item) => `
    <div class="why-card">
      <div class="why-icon">${item.icon}</div>
      <h3>${window.BjaySite.escapeHtml(item.title)}</h3>
      <p>${window.BjaySite.escapeHtml(item.text)}</p>
    </div>
  `).join('');
})();
