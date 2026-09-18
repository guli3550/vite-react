const API = "https://guli-gateway.parizodabaxtiyorov.workers.dev";
const SITE = "https://www.gulii.uz";
const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
const absolute = (v) => { try { const u=new URL(String(v||"")); return /^https?:$/.test(u.protocol) ? u.toString() : ""; } catch { return ""; } };

module.exports = async function handler(req,res) {
  try {
    const r = await fetch(`${API}/api/products?limit=1000`, {headers:{Accept:"application/json"}});
    if (!r.ok) throw new Error(`Catalog HTTP ${r.status}`);
    const json=await r.json();
    const products=Array.isArray(json?.data) ? json.data.filter(p=>p?.active!==false) : [];
    const urls=[`<url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
    for (const p of products) {
      const ref=String(p.product_code||p.id||"").trim();
      if(!ref) continue;
      const loc=`${SITE}/product/${encodeURIComponent(ref)}/`;
      const images=[p.image,...(Array.isArray(p.images)?p.images:[])].map(absolute).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10);
      const imageXml=images.map(x=>`<image:image><image:loc>${esc(x)}</image:loc></image:image>`).join("");
      urls.push(`<url><loc>${esc(loc)}</loc>${imageXml}<changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    }
    const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join("")}</urlset>`;
    res.setHeader("Content-Type","application/xml; charset=utf-8");
    res.setHeader("Cache-Control","public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(xml);
  } catch(error) {
    console.error("Dynamic sitemap error:",error);
    res.setHeader("Content-Type","application/xml; charset=utf-8");
    return res.status(503).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.gulii.uz/</loc></url></urlset>');
  }
};
