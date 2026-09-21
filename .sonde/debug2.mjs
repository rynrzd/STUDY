import { chromium } from "playwright-core";
const nav = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
for (const url of ["/", "/produit", "/etablissements", "/connexion"]) {
  await page.goto("http://localhost:3100" + url, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => ({
    hauteur: document.body.scrollHeight,
    innerH: window.innerHeight,
    corps: document.body.innerText.length,
    visiblesAvecTexte: [...document.body.querySelectorAll("*")].filter(el => {
      const p = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
      if (p === "") return false;
      const st = getComputedStyle(el);
      return st.visibility !== "hidden" && st.opacity !== "0" && el.getClientRects().length > 0;
    }).length,
  }));
  console.error(url.padEnd(18), JSON.stringify(r));
}
await nav.close();
