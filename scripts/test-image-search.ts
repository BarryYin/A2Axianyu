/**
 * 搜图功能测试脚本
 * 用法: npx tsx scripts/test-image-search.ts
 */

import { searchProductImage } from "../src/lib/image-search";

const testCases = [
  { title: "机械键盘", category: "数码", imagePrompt: "mechanical keyboard" },
  { title: "蓝牙耳机", category: "数码", imagePrompt: "wireless bluetooth headphones" },
  { title: "棉质T恤", category: "服饰", imagePrompt: "cotton t-shirt" },
];

async function main() {
  console.log("=== 搜图功能测试 ===\n");

  for (const tc of testCases) {
    console.log(`测试: "${tc.title}" (${tc.category})`);
    try {
      const result = await searchProductImage(tc.imagePrompt, tc.title, tc.category);
      const source = result.startsWith("/product-images/")
        ? "✅ 本地下载"
        : result.includes("placehold.co")
          ? "⚠️ 占位图（搜图失败）"
          : "❓ 未知";
      console.log(`  结果: ${source}`);
      console.log(`  路径: ${result}`);
    } catch (err) {
      console.log(`  ❌ 错误: ${err}`);
    }
    console.log();
  }
}

main();
