import { db } from '../src/lib/db'

const sampleProducts = [
  {
    title: 'iPhone 14 Pro 256G 深空黑',
    description: '自用一年，保护的很好，带原盒原配件。电池健康度92%，无拆无修，屏幕无划痕。',
    price: 5200,
    category: '数码',
    condition: '95新',
    images: ['https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=400'],
    minPrice: 4800,
    autoAcceptPrice: 5000,
  },
  {
    title: 'MacBook Air M2 午夜色 16G+512G',
    description: '2023年购入，轻度办公使用，成色极新。带原装充电器和包装盒。',
    price: 6800,
    category: '数码',
    condition: '99新',
    images: ['https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400'],
    minPrice: 6300,
    autoAcceptPrice: 6500,
  },
  {
    title: 'Sony WH-1000XM5 降噪耳机',
    description: '仅拆封试听，几乎全新。降噪效果顶级，音质出色。带全部配件。',
    price: 1800,
    category: '数码',
    condition: '99新',
    images: ['https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400'],
    minPrice: 1600,
    autoAcceptPrice: 1700,
  },
  {
    title: 'Nintendo Switch OLED 白色',
    description: '买了几个月，玩了几次就闲置了。带保护壳和收纳包，屏幕贴好膜。',
    price: 1500,
    category: '数码',
    condition: '95新',
    images: ['https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400'],
    minPrice: 1350,
    autoAcceptPrice: 1400,
  },
  {
    title: '优衣库轻薄羽绒服 L码 黑色',
    description: '去年冬天买的，只穿过两三次，几乎全新。非常轻便保暖，适合通勤。',
    price: 180,
    category: '服装',
    condition: '95新',
    images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400'],
    minPrice: 150,
    autoAcceptPrice: 165,
  },
  {
    title: 'MUJI 香薰机 大号',
    description: '闲置转让，功能完好，超声波静音，带原装电源。赠送两瓶精油。',
    price: 280,
    category: '家居',
    condition: '9成新',
    images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400'],
    minPrice: 230,
    autoAcceptPrice: 250,
  },
  {
    title: 'Kindle Paperwhite 5 16G',
    description: '买了不到一年，看了几本书。屏幕完美无划痕，续航很好。带保护套。',
    price: 750,
    category: '数码',
    condition: '95新',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400'],
    minPrice: 680,
    autoAcceptPrice: 700,
  },
  {
    title: 'Dyson V12 Detect Slim 吸尘器',
    description: '公司年会奖品，全新未拆封。激光探测，轻量化设计，非常适合家用。',
    price: 3200,
    category: '家居',
    condition: '全新',
    images: ['https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400'],
    minPrice: 3000,
    autoAcceptPrice: 3100,
  },
]

async function seedProducts() {
  // 查找平台卖家
  const platformSeller = await db.user.findFirst({
    where: { isPlatformSeller: true }
  })

  if (!platformSeller) {
    console.error('错误：平台卖家账号不存在')
    console.log('请先运行: npx tsx scripts/init-platform-seller.ts')
    process.exit(1)
  }

  console.log('平台卖家:', platformSeller.nickname, `(${platformSeller.id})`)
  console.log('')

  // 检查已有商品数量
  const existingCount = await db.product.count({
    where: { sellerId: platformSeller.id }
  })

  if (existingCount > 0) {
    console.log(`平台已有 ${existingCount} 个商品，跳过添加`)
    console.log('如需重新添加，请先删除现有商品')
    process.exit(0)
  }

  // 添加示例商品
  console.log('开始添加示例商品...')
  console.log('')

  for (const product of sampleProducts) {
    const created = await db.product.create({
      data: {
        ...product,
        images: JSON.stringify(product.images),
        sellerId: platformSeller.id,
        platformListed: true,
        source: 'manual',
        aiPersonality: '平台官方AI代理，专业、友好、善于协商。会根据商品状况给出合理价格，但也愿意听取买家的诚意报价。',
      }
    })
    console.log(`✓ ${created.title} - ¥${created.price}`)
  }

  console.log('')
  console.log(`成功添加 ${sampleProducts.length} 个示例商品！`)
  console.log('')
  console.log('您可以：')
  console.log('  1. 访问 http://localhost:3000 查看商品列表')
  console.log('  2. 访问 http://localhost:3000/marketplace 浏览市场')
  console.log('  3. 注册/登录后进行议价测试')
}

seedProducts()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
