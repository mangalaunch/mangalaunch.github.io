'use strict';

// Convert placeholders only after an actual public destination is configured.
document.querySelectorAll('[data-public-link]').forEach(placeholder => {
  const value = window.SITE_LINKS?.[placeholder.dataset.publicLink];
  if (typeof value !== 'string') return;
  let url;
  try { url = new URL(value); } catch { return; }
  if (url.protocol !== 'https:' || url.username || url.password) return;
  const link = document.createElement('a');
  link.className = placeholder.className;
  link.href = url.href;
  link.dataset.publicLink = placeholder.dataset.publicLink;
  link.append(...placeholder.childNodes);
  link.querySelector('small')?.remove();
  placeholder.replaceWith(link);
});
if (['windowsDownload', 'androidDownload'].every(key => document.querySelector(`a[data-public-link="${key}"]`))) {
  document.querySelector('.release-note')?.setAttribute('hidden', '');
}
