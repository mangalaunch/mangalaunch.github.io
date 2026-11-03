async (page) => {
  const base = new URL('.', page.url()).href;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.goto(base + 'index.html?lang=en');
  check(await page.locator('html').getAttribute('lang') === 'en', 'English page');
  check(await page.locator('.hero h1').innerText() === 'Your manga.\nYour rhythm.', 'English headline');
  check(await page.locator('.social-placeholder').isDisabled(), 'Telegram is a placeholder');
  await page.getByRole('tab', { name: 'Read later 2', exact: true }).click();
  check(await page.locator('.book:visible').count() === 2, 'Library demo still switches collections');
  await page.locator('[data-page-step="1"]').click();
  check((await page.locator('.page-counter').innerText()).startsWith('13'), 'Reader next page');
  await page.locator('.reader-demo').focus();
  await page.keyboard.press('ArrowLeft');
  check((await page.locator('.page-counter').innerText()).startsWith('12'), 'Reader keyboard navigation');
  await page.locator('[data-mode="webtoon"]').click();
  check(await page.locator('.reader-demo').evaluate(element => element.classList.contains('is-webtoon')), 'Webtoon demo');
  await page.locator('[data-mode="manga"]').click();
  await page.locator('.translation-toggle').click();
  check(await page.locator('.speech-bubble').innerText() === 'The story is just beginning.', 'English translation');
  const contrast = await page.locator('.speech-bubble').evaluate(element => {
    const style = getComputedStyle(element);
    function luminance(color) {
      const parts = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => v / 255);
      return parts.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0);
    }
    const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a,b) => b-a);
    return (values[0]+.05)/(values[1]+.05);
  });
  check(contrast >= 4.5, `Speech contrast: ${contrast}`);
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  check(await page.locator('.speech-bubble').innerText() === 'История только начинается.', 'Russian translation');
  check(await page.locator('.translation-toggle').getAttribute('aria-pressed') === 'true', 'Language keeps translation state');
  check(await page.locator('.book:visible').count() === 2, 'Language keeps collection state');
  await page.goto(base + 'index.html');
  check(await page.locator('html').getAttribute('lang') === 'ru', 'Remembered language');
  await page.goto(base + 'index.html?lang=en');
  check(await page.locator('html').getAttribute('lang') === 'en', 'Explicit language overrides storage');

  for (const locale of ['en','ru']) {
    for (const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + `index.html?lang=${locale}`);
      check(await page.locator('meta[property="og:locale"]').getAttribute('content') === (locale === 'en' ? 'en_US' : 'ru_RU'), `Social locale ${locale}`);
      check(await page.locator('meta[name="description"]').getAttribute('content') === await page.locator('meta[name="twitter:description"]').getAttribute('content'), `Matching metadata descriptions ${locale}`);
      check(!(await page.locator('body').innerText()).includes('✳'), 'Removed decorative asterisks');
      const actions = await page.locator('.extension-actions .text-link').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom, width:rect.width };
      }));
      check(actions.length === 2 && actions.every(action => action.width > 0), 'Two separate extension actions');
      const [first,second] = actions;
      check(first.right + 10 <= second.left || first.bottom + 10 <= second.top, `Extension action spacing ${locale}/${width}`);
      check(await page.locator('.hero-description').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), `Readable hero text ${locale}/${width}`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Landing overflow ${locale}/${width}`);
      if (width === 390) {
        await page.locator('.menu-toggle').click();
        check(await page.locator('#main-nav').isVisible(), 'Mobile navigation opens');
        await page.keyboard.press('Escape');
        check(await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false', 'Escape closes mobile navigation');
      }
      const text = await page.locator('body').innerText();
      if (locale === 'en') check(!/[А-Яа-яЁё]/.test(text), 'No untranslated Russian in English landing');
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + 'extensions.html?lang=en');
  check(await page.locator('article:visible').count() === 1, 'One guide language visible');
  check(await page.locator('article:visible').getAttribute('lang') === 'en', 'English guide');
  check(await page.locator('meta[property="og:title"]').getAttribute('content') === await page.title(), 'Guide social title matches the page');
  check(!(await page.locator('article:visible').innerText()).match(/\b(flutter|dart)\b/i), 'Guide has no application implementation details');
  check(!(await page.locator('article:visible').innerText()).match(/(?:nsfw_)?ml_extensions/), 'Guide has no internal repository names');
  check(await page.locator('.guide-article:visible').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), 'Readable guide text');
  await page.locator('.guide-toc:visible a').nth(4).click();
  check(new URL(page.url()).hash.startsWith('#en-'), 'English guide anchor');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  check(await page.locator('article:visible').getAttribute('lang') === 'ru', 'Russian guide');
  check(await page.locator('meta[property="og:locale"]').getAttribute('content') === 'ru_RU', 'Russian guide metadata');
  check(new URL(page.url()).hash.startsWith('#ru-'), 'Language switches the guide anchor');
  await page.reload();
  check(await page.locator('article:visible').getAttribute('lang') === 'ru', 'Russian guide deep link survives reload');
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Guide overflow ${width}`);
  }
  if (base.startsWith('http')) {
    // Keep the document at a repository-like URL while serving only the site
    // directory. This checks project Pages without exposing a workspace parent.
    const projectBase = base + 'project-demo/';
    await page.route(projectBase + '**', async route => {
      const upstream = new URL(route.request().url());
      upstream.pathname = upstream.pathname.replace('/project-demo/', '/');
      await route.fulfill({ response: await route.fetch({ url: upstream.href }) });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(projectBase + 'index.html?lang=en');
    check(await page.locator('.brand img').evaluate(image => image.complete && image.naturalWidth > 0), 'Project Pages image path');
    await page.getByRole('link', { name: 'Developer guide', exact: true }).click();
    check(page.url().startsWith(projectBase + 'extensions.html'), 'Project Pages guide path');
    check(await page.locator('article:visible').count() === 1, 'Project Pages scripts and styles');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + 'index.html?lang=en');
  await page.locator('.reader-demo').scrollIntoViewIfNeeded();
  await page.locator('.translation-toggle').click();
  await page.locator('.reader-demo').screenshot({ path: 'output/playwright/reader-translation.png', animations: 'disabled' });
  await page.locator('#sync').scrollIntoViewIfNeeded();
  await page.locator('#sync').screenshot({ path: 'output/playwright/google-drive.png', animations: 'disabled' });
  await page.locator('#extensions').scrollIntoViewIfNeeded();
  await page.locator('#extensions').screenshot({ path: 'output/playwright/extension-actions-desktop.png', animations: 'disabled' });
  await page.goto(base + 'extensions.html?lang=en');
  await page.screenshot({ path: 'output/playwright/guide-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + 'index.html?lang=ru');
  await page.screenshot({ path: 'output/playwright/landing-mobile.png', animations: 'disabled' });
  await page.locator('#extensions').scrollIntoViewIfNeeded();
  await page.locator('#extensions').screenshot({ path: 'output/playwright/extension-actions-mobile.png', animations: 'disabled' });
  await page.route('**/site-config.js', route => route.fulfill({ contentType:'text/javascript',
    body:'window.SITE_LINKS={windowsDownload:"https://example.org/windows",androidDownload:"https://example.org/android",telegram:"https://t.me/example"};' }));
  await page.goto(base + 'index.html?lang=en');
  check(await page.locator('a[data-public-link]').count() === 3, 'Configured public links replace all placeholders');
  check(await page.locator('.release-note').isHidden(), 'Published download destinations hide the placeholder note');
  check(await page.locator('.social-placeholder small').count() === 0, 'Connected Telegram hides Coming soon');
  await page.getByRole('button', { name:'RU', exact:true }).click();
  check(await page.locator('a[data-public-link="telegram"]').getAttribute('href') === 'https://t.me/example', 'Language keeps configured destinations');
  await page.unroute('**/site-config.js');
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  page.off('pageerror', onError);
  return { status: 'passed', speechContrast: contrast.toFixed(2), languages: 2, viewportWidths: [320,390,768,1024,1440], browserErrors: errors };
}
