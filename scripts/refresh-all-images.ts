/**
 * 批量刷新商品图片 — 从 Amazon 搜图替换所有杂图
 * 用法: npx tsx scripts/refresh-all-images.ts
 */

const DB_PATH = "file:./dev.db";
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function searchAmazonImage(title: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(title);
    const url = `https://www.amazon.com/s?k=${query}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    if (html.length < 10000) return null;

    const matches = html.match(
      /https?:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.(?:jpg|png)/g
    );
    if (!matches || matches.length === 0) return null;

    const productImgs = matches.filter((img) =>
      /_(?:AC|SX|SY|UL|SL)/.test(img)
    );
    const best = (productImgs.length > 0 ? productImgs[0] : matches[0])
      .replace(/_QL\d+_/, "_SL1500_")
      .replace(/_AC_U[YS]\d+/, "_AC_SL1500_")
      .replace(/_SX\d+/, "_SX1500_");

    return best;
  } catch {
    return null;
  }
}

async function downloadImage(
  url: string,
  filename: string
): Promise<string | null> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const crypto = await import("crypto");
  const imgDir = path.join(process.cwd(), "public", "product-images");

  const hash = crypto
    .createHash("md5")
    .update(filename)
    .digest("hex")
    .slice(0, 12);
  const fname = `${hash}.jpg`;
  const localPath = path.join(imgDir, fname);

  try {
    await fs.mkdir(imgDir, { recursive: true });

    // 已存在就跳过
    try {
      await fs.access(localPath);
      return `/product-images/${fname}`;
    } catch {}

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "A2A-Xianyu/1.0" },
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) return null;

    await fs.writeFile(localPath, buffer);
    console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(0)}KB → ${fname}`);
    return `/product-images/${fname}`;
  } catch (err) {
    console.error(`  Download failed: ${err}`);
    return null;
  }
}

async function main() {
  console.log("=== 批量刷新商品图片 ===\n");

  // 查找所有杂图商品（placeholder、unsplash、空图）
  const products = await prisma.product.findMany({
    where: {
      status: { not: "deleted" },
    },
    select: { id: true, title: true, category: true, images: true },
  });

  const toRefresh = products.filter((p: any) => {
    const imgs = p.images || "[]";
    return (
      imgs === "[]" ||
      imgs.includes("placehold.co") ||
      imgs.includes("unsplash.com") ||
      !imgs.includes("/product-images/")
    );
  });

  console.log(`找到 ${toRefresh.length} 件需刷新商品\n`);

  let updated = 0;
  let skipped = 0;

  for (const p of toRefresh) {
    console.log(`[${updated + skipped + 1}/${toRefresh.length}] ${p.title}`);
    const amazonUrl = await searchAmazonImage(p.title);

    if (!amazonUrl) {
      console.log("  ⚠️ Amazon 搜索无结果");
      skipped++;
      continue;
    }

    const localPath = await downloadImage(amazonUrl, p.title);
    if (!localPath) {
      console.log("  ⚠️ 下载失败");
      skipped++;
      continue;
    }

    await prisma.product.update({
      where: { id: p.id },
      data: { images: JSON.stringify([localPath]) },
    });
    updated++;
  }

  console.log(`\n完成: ${updated} 件已更新, ${skipped} 件跳过`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
