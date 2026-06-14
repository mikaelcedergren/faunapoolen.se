(function () {
  const STORAGE_KEY = 'faunapoolen-language';
  const base = document.querySelector('meta[name="faunapoolen-baseurl"]')?.content || '';

  document.querySelectorAll('[data-lang-switch]').forEach((link) => {
    link.addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, link.getAttribute('data-lang-switch'));
    });
  });

  const path = window.location.pathname;
  const homePaths = ['/', '/index.html', `${base}/`, `${base}/index.html`].filter(Boolean);
  const isHome = homePaths.includes(path);
  if (!isHome) return;

  if (localStorage.getItem(STORAGE_KEY)) return;

  const language = (navigator.language || navigator.userLanguage || '').toLowerCase();
  const prefersSwedish = language.startsWith('sv');
  if (prefersSwedish) return;

  localStorage.setItem(STORAGE_KEY, 'en');
  const target = `${base}/en/`.replace(/\/{2,}/g, '/');
  if (path !== target) {
    window.location.replace(target);
  }
})();
