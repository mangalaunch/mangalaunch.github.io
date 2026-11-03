async (page) => {
  const base = new URL('.', page.url()).href;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const errors=[];
  const onError=error=>errors.push(error.message);
  page.on('pageerror', onError);
  for(const locale of ['en','ru']){
    await page.goto(base+`index.html?lang=${locale}`);
    const geometry=await page.locator('.sync-route').evaluateAll(paths=>paths.map(path=>({
      edge:path.dataset.flow,start:path.getPointAtLength(0).y,end:path.getPointAtLength(path.getTotalLength()).y,
      marker:getComputedStyle(path).markerEnd,
    })));
    check(geometry.length===4, 'Four directed connections');
    for(const route of geometry){
      check(route.marker!=='none',`${route.edge}: visible arrowhead`);
      check(route.edge.endsWith('to-drive') ? route.start>route.end : route.start<route.end,`${route.edge}: direction`);
    }
    check(await page.locator('.sync-flow-key > span').count()===2,'Send/receive legend');
    await page.emulateMedia({reducedMotion:'reduce'});
    check(await page.locator('.sync-route').first().evaluate(path=>getComputedStyle(path).animationName)==='none','Reduced motion keeps a static diagram');
    await page.emulateMedia({reducedMotion:'no-preference'});
    for(const name of ['privacy','terms']){
      await page.goto(base+`index.html?lang=${locale}`);
      await page.locator(`.footer-legal a[href*="${name}.html"]`).click();
      check(new URL(page.url()).pathname.endsWith(`/${name}.html`),'Public policy navigation');
      check(new URL(page.url()).searchParams.get('lang')===locale,'Policy navigation keeps language');
      check(await page.locator('html').getAttribute('lang')===locale,'Translated policy');
      check(await page.locator('article.legal-content').innerText().then(text=>text.length>2000),'Full policy text');
      check(await page.locator('a[href="mailto:mangalaunch@proton.me"]').count()>=2,'Contact address is available');
      if(name==='terms')check((await page.locator('#unofficial-extensions').innerText()).includes(locale==='en'?'at your own risk':'на свой страх и риск'),'Unofficial extension responsibility');
      for(const width of [320,390,768,1440]){
        await page.setViewportSize({width,height:900});
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${locale}/${width}: no overflow`);
      }
      const targetLocale=locale==='en'?'ru':'en';
      await page.getByRole('button',{name:targetLocale.toUpperCase(),exact:true}).click();
      check(await page.locator('html').getAttribute('lang')===targetLocale,'Policy language switch');
      const other=name==='privacy'?'terms':'privacy';
      await page.locator(`.footer-legal a[href*="${other}.html"]`).click();
      check(new URL(page.url()).searchParams.get('lang')===targetLocale,'Cross-policy language survives');
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'index.html?lang=en');
  await page.locator('#sync').scrollIntoViewIfNeeded();
  await page.locator('.sync-demo').screenshot({path:'output/playwright/sync-directions-desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'index.html?lang=ru');
  await page.locator('#sync').scrollIntoViewIfNeeded();
  await page.locator('.sync-demo').screenshot({path:'output/playwright/sync-directions-mobile.png',animations:'disabled'});
  await page.goto(base+'privacy.html?lang=ru');
  await page.screenshot({path:'output/playwright/privacy-mobile.png',animations:'disabled'});
  check(errors.length===0,`Browser errors: ${errors.join('; ')}`);
  page.off('pageerror',onError);
  return {status:'passed',policies:2,languages:2,diagramConnections:4,browserErrors:errors};
}
