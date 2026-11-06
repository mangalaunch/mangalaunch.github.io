'use strict';
document.documentElement.classList.add('js');

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
const closeMenu = (restoreFocus = false) => {
  menuToggle.setAttribute('aria-expanded', 'false');
  navigation.dataset.open = 'false';
  menuToggle.setAttribute('aria-label', SiteI18n.t('menu.open'));
  if (restoreFocus) menuToggle.focus();
};
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', SiteI18n.t(open ? 'menu.close' : 'menu.open'));
  navigation.dataset.open = String(open);
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
const desktopMenu = matchMedia('(min-width: 1101px)');
desktopMenu.addEventListener('change', () => closeMenu());

const demo = document.querySelector('.video-demo');
if (demo) {
  const devices = demo.querySelector('.demo-devices');
  const buttons = [...devices.querySelectorAll('[data-demo-device]')];
  const play = demo.querySelector('.demo-play');
  const poster = play.querySelector('img');
  const video = demo.querySelector('video');
  const errorMessage = demo.querySelector('.demo-error');
  const directLink = errorMessage.querySelector('a');
  let device = 'phone';

  function resetVideo() {
    if (video.hidden) return;
    video.pause();
    video.hidden = true;
    video.removeAttribute('src');
    video.load();
    play.hidden = false;
  }

  function updateDemo() {
    const asset = `assets/${SiteI18n.locale}_${device}`;
    const source = `${asset}.mp4`;
    if (play.getAttribute('href') === source) return;
    resetVideo();
    errorMessage.hidden = true;
    play.setAttribute('href', source);
    directLink.setAttribute('href', source);
    poster.src = `${asset}.webp`;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.demoDevice === device)));
  }

  function showVideoError() {
    if (video.hidden) return;
    const restoreFocus = document.activeElement === video;
    resetVideo();
    errorMessage.hidden = false;
    if (restoreFocus) directLink.focus({ preventScroll: true });
  }

  devices.hidden = false;
  buttons.forEach(button => button.addEventListener('click', () => {
    device = button.dataset.demoDevice;
    updateDemo();
  }));
  play.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const moveFocus = document.activeElement === play;
    errorMessage.hidden = true;
    video.poster = poster.src;
    video.src = play.href;
    video.hidden = false;
    play.hidden = true;
    if (moveFocus) video.focus({ preventScroll: true });
    video.play().catch(error => { if (error.name !== 'AbortError') showVideoError(); });
  });
  video.addEventListener('error', showVideoError);
  document.addEventListener('site:languagechange', updateDemo);
  updateDemo();
}

const libraryTabs = [...document.querySelectorAll('[data-library]')];
const books = [...document.querySelectorAll('[data-collection]')];
function selectCollection(tab, focus = false) {
  libraryTabs.forEach(button => {
    const active = button === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  books.forEach(book => { book.hidden = !book.dataset.collection.split(' ').includes(tab.dataset.library); });
  document.querySelector('#library-books').setAttribute('aria-labelledby', tab.id);
  if (focus) tab.focus();
}
libraryTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectCollection(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % libraryTabs.length;
    if (event.key === 'ArrowLeft') next = (index + libraryTabs.length - 1) % libraryTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = libraryTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectCollection(libraryTabs[next], true); }
  });
});

const reader = document.querySelector('.reader-demo');
if (reader) {
const viewport = reader.querySelector('.reader-viewport');
const bubble = reader.querySelector('.speech-bubble');
const range = reader.querySelector('.page-range');
const counter = reader.querySelector('.page-counter');
const translation = document.querySelector('.translation-toggle');
const phrases = [
  { original: '物語はここから始まる。', en: 'The story is just beginning.', ru: 'История только начинается.' },
  { original: '新しい日、新しい冒険。', en: 'A new day. A new adventure.', ru: 'Новый день. Новое приключение.' },
  { original: 'その先を見つけよう。', en: 'Let’s find out what’s next.', ru: 'Узнаем, что будет дальше.' },
];
let page = 12;
let translated = false;
function updateReader() {
  bubble.textContent = phrases[(page - 12 + 48) % phrases.length][translated ? SiteI18n.locale : 'original'];
  translation.querySelector('span').textContent = SiteI18n.t(translated ? 'reader.translated' : 'reader.translate');
  counter.replaceChildren(document.createTextNode(`${page} `));
  const total = document.createElement('span');
  total.textContent = '/ 48';
  counter.append(total);
  reader.querySelector('.js-page').textContent = String(page);
  range.value = String(page);
  reader.querySelector('[data-page-step="-1"]').disabled = page === 1;
  reader.querySelector('[data-page-step="1"]').disabled = page === 48;
  reader.classList.toggle('is-translated', translated);
}
function changePage(value) {
  page = Math.max(1, Math.min(48, value));
  updateReader();
}
reader.querySelectorAll('[data-page-step]').forEach(button => {
  button.addEventListener('click', () => changePage(page + Number(button.dataset.pageStep)));
});
range.addEventListener('input', () => changePage(Number(range.value)));
reader.addEventListener('keydown', event => {
  if (event.target.matches('input')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); changePage(page + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});
document.querySelectorAll('[data-mode]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    reader.classList.toggle('is-webtoon', button.dataset.mode === 'webtoon');
    viewport.scrollTop = 0;
  });
});
translation.addEventListener('click', () => {
  translated = !translated;
  translation.setAttribute('aria-pressed', String(translated));
  updateReader();
});
updateReader();
document.addEventListener('site:languagechange', updateReader);
}

document.addEventListener('site:languagechange', () => closeMenu());

const extensionHow = document.querySelector('.extension-how');
extensionHow?.addEventListener('click', () => {
  const open = extensionHow.getAttribute('aria-expanded') !== 'true';
  extensionHow.setAttribute('aria-expanded', String(open));
  document.querySelector('#extension-steps').hidden = !open;
});

const revealElements = [...document.querySelectorAll('.reveal')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.08 });
  revealElements.forEach(element => observer.observe(element));
} else revealElements.forEach(element => element.classList.add('is-visible'));

const progress = document.querySelector('.scroll-progress');
let scrollScheduled = false;
function updateProgress() {
  const available = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${available > 0 ? Math.min(1, Math.max(0, scrollY / available)) : 0})`;
  scrollScheduled = false;
}
addEventListener('scroll', () => {
  if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
addEventListener('resize', updateProgress, { passive: true });
document.addEventListener('site:languagechange', updateProgress);
updateProgress();
document.querySelector('#year').textContent = String(new Date().getFullYear());
