/**
 * 闲鱼搜图脚本 — 部署到国内服务器运行
 * 用法: npx tsx scripts/search-xianyu-images.ts "机械键盘" 数码
 * 输出: 下载图片到 public/product-images/
 */

const GOOFISH_SEARCH = "https://www.goofish.com/search?q=";

interface ScrapedItem {
  title: string;
  price: number;
  images: string[];
}

async function searchXianyu(keyword: string): Promise<ScrapedItem[]> {
  const url = GOOFISH_SEARCH + encodeURIComponent(keyword);
  console.log(`[xianyu-search] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    console.error(`[xianyu-search] HTTP ${response.status}`);
    return [];
  }

  const html = await response.text();

  if (html.includes("非法访问") || html.length < 5000) {
    console.error("[xianyu-search] Blocked or empty response");
    return [];
  }

  // Extract item IDs from links: /item?id=xxxx
  const itemIds: string[] = [];
  const idRegex = /\/item\?id=(\d+)/g;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    const id = match[1];
    if (!itemIds.includes(id)) itemIds.push(id);
    if (itemIds.length >= 10) break; // max 10 items
  }

  console.log(
    `[xianyu-search] Found ${itemIds.length} item IDs: ${itemIds.slice(0, 5).join(", ")}`
  );

  // Scrape each item page for images
  const results: ScrapedItem[] = [];
  for (const id of itemIds.slice(0, 5)) {
    const itemUrl = `https://www.goofish.com/item?id=${id}`;
    try {
      const itemRes = await fetch(itemUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!itemRes.ok) continue;
      const itemHtml = await itemRes.text();

      // Extract images from __INITIAL_STATE__ or meta tags
      const images: string[] = [];

      // Try __INITIAL_STATE__
      const stateMatch = itemHtml.match(
        /__INITIAL_STATE__\s*=\s*({.+?});/
      );
      if (stateMatch) {
        try {
          const data = JSON.parse(stateMatch[1]);
          const itemData = data?.item?.itemData || data?.itemData || data;
          const pics =
            itemData?.images ||
            itemData?.itemPictureList ||
            itemData?.pics ||
            [];
          for (const pic of pics) {
            const imgUrl =
              typeof pic === "string" ? pic : pic.url || pic.imgUrl || pic.src;
            if (imgUrl && imgUrl.startsWith("http")) {
              images.push(imgUrl);
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Fallback: og:image meta
      if (images.length === 0) {
        const ogMatch = itemHtml.match(
          /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i
        );
        if (ogMatch) images.push(ogMatch[1]);
      }

      // Fallback: any alicdn images
      if (images.length === 0) {
        const imgMatches = itemHtml.match(
          /https?:\/\/[^"\s]+(?:alicdn\.com|goofish\.com)[^"\s]+\.(?:jpg|png|webp)/gi
        );
        if (imgMatches) images.push(...imgMatches.slice(0, 5));
      }

      if (images.length > 0) {
        // Get title from meta
        const titleMatch = itemHtml.match(
          /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i
        );
        const title =
          titleMatch?.[1]?.replace(/ - 闲鱼$/, "").trim() || `商品${id}`;

        results.push({
          title,
          price: 0,
          images: [...new Set(images)].slice(0, 5),
        });
      }
    } catch (err) {
      console.error(`[xianyu-search] Failed to scrape item ${id}:`, err);
    }
  }

  return results;
}

// ──── CLI entry ────
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("用法: npx tsx scripts/search-xianyu-images.ts <关键词> [分类]");
    process.exit(1);
  }

  const keyword = args[0];
  const category = args[1] || "其他";

  console.log(
    `[xianyu-search] Searching: "${keyword}" (category: ${category})`
  );
  const results = await searchXianyu(keyword);

  if (results.length === 0) {
    console.log("[xianyu-search] No results found");
    process.exit(0);
  }

  // Download first result's first image
  const first = results[0];
  console.log(
    `[xianyu-search] Best match: "${first.title}" with ${first.images.length} images`
  );

  // Output JSON for programmatic use
  console.log(JSON.stringify({ keyword, results }, null, 2));
}

main().catch((err) => {
  console.error("[xianyu-search] Fatal:", err);
  process.exit(1);
});
