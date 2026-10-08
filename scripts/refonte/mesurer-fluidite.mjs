// Fluidité mesurée, pas supposée : LCP, CLS, octets JS et nombre de requêtes,
// sur réseau lent simulé (1,6 Mb/s, 150 ms, CPU ×4), médiane de 3 essais.
//   SITE_BASE=https://avecstudy.fr node scripts/refonte/mesurer-fluidite.mjs / /connexion /produit
import { chromium } from "playwright-core";

const BASE = (process.env.SITE_BASE ?? "http://localhost:3101").replace(/\/+$/, "");
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/connexion"];
const nav = await chromium.launch({ channel: process.env.NAVIGATEUR_RECETTE ?? "msedge" });
for (const chemin of pages) {
  const essais = [];
  for (let i = 0; i < 3; i += 1) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    let js = 0;
    let requetes = 0;
    page.on("response", async (r) => {
      requetes += 1;
      if ((r.headers()["content-type"] ?? "").includes("javascript")) js += Number(r.headers()["content-length"] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
    });
    await page.addInitScript(() => {
      window.__lcp = 0;
      window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(BASE + chemin, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: Number(window.__cls.toFixed(4)) }));
    essais.push({ ...m, js, requetes });
    await ctx.close();
  }
  const med = (k) => essais.map((e) => e[k]).sort((a, b) => a - b)[1];
  console.log(`${chemin.padEnd(14)} LCP ${med("lcp")} ms · CLS ${Math.max(...essais.map((e) => e.cls))} · JS ${Math.round(med("js") / 1024)} Ko · ${med("requetes")} requêtes`);
}
await nav.close();
