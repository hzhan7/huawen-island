#!/usr/bin/env node
// 无头 Chrome 试玩/截图工具（puppeteer-core + 本机 Chrome）。
// 用法：
//   node tools/shot.js --page <html> [--game <id>] [--grade p3] [--size 390x844] [--dark]
//                      [--wait 2500] [--out shot.png] [--steps steps.json]
// steps.json 是动作数组，按顺序执行：
//   {"wait":800} {"tap":[x,y]} {"click":[x,y]} {"drag":[x1,y1,x2,y2]} {"key":"ArrowLeft"}
//   {"eval":"JS 表达式（页面内执行，结果打印）"} {"shot":"a.png"}
// 结束时打印 console 错误 / 页面异常（有则退出码 1）。坐标是 CSS 像素。
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? (a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true) : d; };

(async () => {
  const page0 = opt('page');
  if (!page0) { console.error('need --page'); process.exit(2); }
  const [w, h] = String(opt('size', '390x844')).split('x').map(Number);
  const mobile = w < 768;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-first-run'],
  });
  const errs = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    if (opt('dark')) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[console.${m.type()}] ${m.text()}`); });
    page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
    const url = page0.startsWith('http') ? page0 : 'file://' + path.resolve(page0);
    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 600));
    const grade = opt('grade');
    if (grade) await page.evaluate(g => window.HW && HW.setGrade && HW.setGrade(g), grade);
    const game = opt('game');
    if (game) await page.evaluate(id => HW.start(id), game);
    await new Promise(r => setTimeout(r, Number(opt('wait', 2500))));
    const stepsFile = opt('steps');
    if (stepsFile) {
      const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
      for (const s of steps) {
        if (s.wait) await new Promise(r => setTimeout(r, s.wait));
        if (s.tap) { if (mobile) await page.touchscreen.tap(s.tap[0], s.tap[1]); else await page.mouse.click(s.tap[0], s.tap[1]); }
        if (s.click) await page.mouse.click(s.click[0], s.click[1]);
        if (s.drag) {
          const [x1, y1, x2, y2] = s.drag;
          await page.mouse.move(x1, y1); await page.mouse.down();
          for (let i = 1; i <= 12; i++) await page.mouse.move(x1 + (x2 - x1) * i / 12, y1 + (y2 - y1) * i / 12);
          await page.mouse.up();
        }
        if (s.key) await page.keyboard.press(s.key);
        if (s.eval) { const r = await page.evaluate(s.eval); console.log('[eval]', JSON.stringify(r)); }
        if (s.shot) { await page.screenshot({ path: s.shot }); console.log('[shot]', s.shot); }
      }
    }
    const out = opt('out');
    if (out) { await page.screenshot({ path: out }); console.log('[shot]', out); }
  } finally {
    await browser.close();
  }
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
  console.log('[ok] no console errors');
})().catch(e => { console.error(e); process.exit(3); });
