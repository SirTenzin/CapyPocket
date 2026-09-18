import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { makePageBridge, makeViewportGuard } from '../src/pageBridge';
import { isCapyUrl, parseColors, permittedNavigation } from '../src/policy';

test('navigation and color bridge reject untrusted inputs', () => {
  assert.equal(isCapyUrl('https://capy.ai/thread/example'), true);
  assert.equal(isCapyUrl('https://capy.ai.evil.example'), false);
  assert.equal(isCapyUrl('http://capy.ai'), false);
  assert.equal(permittedNavigation('javascript:alert(1)'), 'blocked');
  assert.equal(permittedNavigation('file:///etc/passwd'), 'blocked');
  assert.equal(permittedNavigation('https://accounts.google.com'), 'web');
  assert.equal(permittedNavigation('mailto:hello@example.com'), 'external');
  assert.equal(parseColors('null'), null);
  assert.equal(parseColors('{"type":"capy-pocket-colors","top":"red","bottom":"#000000"}'), null);
  assert.deepEqual(parseColors('{"type":"capy-pocket-colors","top":"#ffffff","bottom":"#000000"}'), { top: '#ffffff', bottom: '#000000', lightText: false, edgeToEdge: false });
});

test('bridge scales editor text while preserving font, draft and viewport', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://capy.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:rgb(12,9,11);font-family:Georgia}header{height:50px;background:rgb(30,40,50)}textarea{font-size:16px}</style></head><body><header>Capy</header><p>Sample text</p><textarea>Preserve draft</textarea></body></html>' }));
    await page.goto('https://capy.ai/sign-in');
    const messages: string[] = [];
    await page.exposeFunction('capture', (value: string) => messages.push(value));
    await page.evaluate('window.ReactNativeWebView = { postMessage: window.capture }');
    await page.evaluate(makePageBridge(0.82));
    await page.waitForFunction(() => !!document.getElementById('capy-pocket-text-size'));
    const values = await page.evaluate(() => ({
      font: getComputedStyle(document.querySelector('p')!).fontFamily,
      scale: getComputedStyle(document.querySelector('p')!).getPropertyValue('text-size-adjust'),
      editorScale: getComputedStyle(document.querySelector('textarea')!).getPropertyValue('text-size-adjust'),
      draft: document.querySelector('textarea')!.value,
      viewport: document.querySelector('meta[name=viewport]')!.getAttribute('content'),
    }));
    assert.equal(values.font, 'Georgia');
    assert.equal(values.scale, '82%');
    assert.equal(values.editorScale, '82%');
    assert.equal(values.draft, 'Preserve draft');
    assert.equal(values.viewport, 'width=device-width, initial-scale=1, maximum-scale=1');
    assert.deepEqual(JSON.parse(messages.at(-1)!), { type: 'capy-pocket-colors', top: '#1e2832', bottom: '#0c090b', edgeToEdge: false });
    await page.evaluate(makePageBridge(1.3));
    assert.equal(await page.locator('#capy-pocket-text-size').count(), 1);
    await page.evaluate(() => { document.querySelector('header')!.style.backgroundColor = 'white'; });
    await page.waitForTimeout(350);
    assert.equal(JSON.parse(messages.at(-1)!).top, '#ffffff');
    await page.evaluate(() => document.getElementById('capy-pocket-text-size')!.remove());
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#capy-pocket-text-size').count(), 1);
    assert.match(await page.locator('#capy-pocket-text-size').textContent() || '', /130%/);
    await page.route('https://example.org/**', route => route.fulfill({ body: '<html><body>External login</body></html>' }));
    await page.goto('https://example.org');
    await page.evaluate(makePageBridge(0.82));
    assert.equal(await page.locator('#capy-pocket-text-size').count(), 0);
  } finally { await browser.close(); }
});

test('modern Capy colors and safe-area variables are handled without extra padding', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://capy.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head><style>:root{--safe-top:59px;--safe-bottom:34px}html,body{margin:0;background:oklch(0% 0 0)}header{background:color-mix(in oklab,white 50%,black);height:44px}footer{padding-bottom:calc(4px + var(--safe-bottom))}textarea,[contenteditable]{font-size:1rem!important}</style></head><body><header>Header</header><footer>Cloud</footer><div contenteditable="true"><p>My draft</p></div></body></html>' }));
    await page.goto('https://capy.ai/thread/test');
    const messages: string[] = [];
    await page.exposeFunction('capture', (value: string) => messages.push(value));
    await page.evaluate('window.ReactNativeWebView = { postMessage: window.capture }');
    assert.equal(await page.locator('footer').evaluate(e => getComputedStyle(e).paddingBottom), '38px');
    await page.evaluate(makePageBridge(0.82));
    assert.equal(await page.locator('footer').evaluate(e => getComputedStyle(e).paddingBottom), '16px');
    assert.equal(await page.locator('html').evaluate(e => getComputedStyle(e).getPropertyValue('--safe-top').trim()), '0px');
    assert.equal(await page.locator('[contenteditable] p').evaluate(e => getComputedStyle(e).getPropertyValue('text-size-adjust')), '82%');
    assert.deepEqual(JSON.parse(messages.at(-1)!), { type: 'capy-pocket-colors', top: '#636363', bottom: '#000000', edgeToEdge: false });
    await page.evaluate(() => { document.querySelector('header')!.style.backgroundColor = 'oklch(100% 0 0 / 0.5)'; });
    await page.waitForTimeout(350);
    const blended = JSON.parse(messages.at(-1)!).top;
    for (const offset of [1, 3, 5]) assert.ok(Math.abs(parseInt(blended.slice(offset, offset + 2), 16) - 128) <= 1);
  } finally { await browser.close(); }
});

test('focus-zoom guard starts early and survives viewport replacement without losing site settings', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(makeViewportGuard());
    await page.route('https://capy.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><input autofocus></body></html>' }));
    await page.goto('https://capy.ai');
    await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name=viewport]')).every(m => m.content.includes('maximum-scale=1')));
    const original = await page.locator('meta[name=viewport]').last().getAttribute('content');
    assert.match(original!, /viewport-fit=cover/);
    await page.evaluate(() => {
      document.querySelectorAll('meta[name=viewport]').forEach(m => m.remove());
      const meta = document.createElement('meta'); meta.name = 'viewport'; meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5'; document.head.appendChild(meta);
    });
    await page.waitForFunction(() => document.querySelector<HTMLMetaElement>('meta[name=viewport]')?.content.endsWith('maximum-scale=1'));
    assert.equal(await page.locator('meta[name=viewport]').count(), 1);
    assert.equal(await page.locator('meta[name=viewport]').getAttribute('content'), 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1');
  } finally { await browser.close(); }
});

test('live home backdrop and sidebar extend behind status bar while controls remain inset', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const html = await readFile(new URL('./edge-layout.html', import.meta.url), 'utf8');
    await page.route('https://capy.ai/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('https://capy.ai/new');
    const messages: string[] = [];
    await page.exposeFunction('capture', (value: string) => messages.push(value));
    await page.evaluate('window.ReactNativeWebView = { postMessage: window.capture }; window.originalCanvas = document.querySelector("canvas")');
    await page.evaluate(makePageBridge(0.82, 59));
    assert.equal(JSON.parse(messages.at(-1)!).edgeToEdge, true);
    assert.equal((await page.locator('canvas').boundingBox())!.y, 0);
    assert.equal((await page.locator('button').first().boundingBox())!.y, 65);
    if (process.env.CAPY_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.CAPY_EVIDENCE_DIR}/edge-teal.png` });
    await page.evaluate('window.paintTheme("#8649bd"); document.querySelector("aside").hidden = false');
    assert.equal((await page.locator('aside').boundingBox())!.y, 0);
    assert.equal((await page.locator('aside header').boundingBox())!.y, 59);
    assert.equal(await page.evaluate('window.originalCanvas === document.querySelector("canvas")'), true);
    if (process.env.CAPY_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.CAPY_EVIDENCE_DIR}/edge-purple-sidebar.png` });
    await page.evaluate('history.pushState({}, "", "/thread/test"); dispatchEvent(new PopStateEvent("popstate"))');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-capy-pocket-home'));
    assert.equal(await page.locator('[data-slot=sidebar-wrapper]').evaluate(e => getComputedStyle(e).paddingTop), '59px');
    assert.equal(await page.locator('html').evaluate(e => getComputedStyle(e).getPropertyValue('--safe-bottom').trim()), '12px');
    await page.evaluate(() => document.querySelector('[data-slot=sidebar-wrapper]')!.remove());
    await page.waitForTimeout(350);
    assert.equal(JSON.parse(messages.at(-1)!).edgeToEdge, false);
  } finally { await browser.close(); }
});
