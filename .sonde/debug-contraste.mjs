import { chromium } from "playwright-core";
const nav = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
for (const url of ["/connexion", "/", "/produit"]) {
  await page.goto("http://localhost:3100" + url, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    let avecTexte = 0, visibles = 0, total = 0;
    const invisibles = [];
    for (const el of document.body.querySelectorAll("*")) {
      total += 1;
      const propre = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
      if (propre === "") continue;
      avecTexte += 1;
      const st = getComputedStyle(el);
      const vis = st.visibility !== "hidden" && st.opacity !== "0" && el.getClientRects().length > 0;
      if (vis) visibles += 1;
      else invisibles.push(el.tagName + " op=" + st.opacity + " vis=" + st.visibility + " rects=" + el.getClientRects().length + " « " + propre.slice(0,25) + " »");
    }
    return { total, avecTexte, visibles, invisibles: invisibles.slice(0, 6), corps: document.body.innerText.length };
  });
  console.error(url, JSON.stringify(r, null, 1));
}
await nav.close();
