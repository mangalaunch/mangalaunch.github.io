'use strict';

(() => {
  const messages = window.SITE_MESSAGES;
  const supported = ['en', 'ru'];
  const storageKey = 'mangalaunch.site.language';
  let locale = 'en';

  function t(key) { return messages[locale][key] ?? messages.en[key] ?? key; }

  function setLocale(next, { persist = true, updateUrl = true } = {}) {
    if (!supported.includes(next)) next = 'en';
    const previous = locale;
    locale = next;
    const url = new URL(location.href);
    const oldTarget = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    const oldArticle = oldTarget?.closest('article[data-locale-content]');
    const headingIndex = oldArticle ? [...oldArticle.querySelectorAll('h2,h3,h4')].indexOf(oldTarget) : -1;
    document.documentElement.lang = locale;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      // Dictionaries are bundled, trusted markup; no remote/user HTML is used.
      element.innerHTML = t(element.dataset.i18n);
    });
    for (const attribute of ['aria-label', 'title', 'content']) {
      document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
        element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
      });
    }
    document.querySelectorAll('[data-locale-content]').forEach(element => {
      element.hidden = element.dataset.localeContent !== locale;
    });
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === locale));
    });
    document.querySelectorAll('a[href]').forEach(link => {
      const raw = link.getAttribute('href');
      if (raw.startsWith('#')) return;
      const destination = new URL(raw, document.baseURI);
      if (destination.origin === location.origin && /\/(index|extensions)\.html$/.test(destination.pathname)) {
        destination.searchParams.set('lang', locale);
        link.href = destination.href;
      }
    });
    if (url.hash && previous !== locale && oldArticle) {
      const sameAnchor = document.getElementById(url.hash.slice(1).replace(/^(en|ru)-/, `${locale}-`));
      const equivalent = sameAnchor ?? document.querySelectorAll(`article[lang="${locale}"] h2,article[lang="${locale}"] h3,article[lang="${locale}"] h4`)[headingIndex];
      url.hash = equivalent?.id ?? '';
    }
    if (updateUrl) {
      url.searchParams.set('lang', locale);
      try { history.replaceState(null, '', url); } catch { /* file previews may restrict history */ }
    }
    if (persist) {
      try { localStorage.setItem(storageKey, locale); } catch { /* URL navigation still carries the choice */ }
    }
    document.dispatchEvent(new CustomEvent('site:languagechange', { detail: { locale } }));
    if (oldArticle && updateUrl && url.hash) requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView());
  }

  let initial;
  const query = new URLSearchParams(location.search).get('lang');
  if (supported.includes(query)) initial = query;
  else if (query !== null) initial = 'en';
  else { try { initial = localStorage.getItem(storageKey); } catch { /* default English */ } }
  window.SiteI18n = Object.freeze({ t, setLocale, get locale() { return locale; } });
  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => setLocale(button.dataset.language));
  });
  setLocale(initial ?? 'en', { persist: false, updateUrl: false });
})();
