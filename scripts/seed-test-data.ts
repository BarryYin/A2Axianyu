import { OrderStatus, PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({ adapter })
}

const db = createPrismaClient()

async function main() {
  console.log('Seeding test data...')

  // Create a test user
  const user = await db.user.upsert({
    where: { secondmeUserId: 'test-user-001' },
    update: {},
    create: {
      secondmeUserId: 'test-user-001',
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      tokenExpiresAt: new Date(Date.now() + 86400000),
      nickname: '测试用户',
    },
  })
  console.log('  ✓ Seller user created')

  // Create test products
  const products = [
    {
      title: 'iPhone 13 128G 国行 充新',
      description: '自用iPhone 13，电池健康95%，无磕碰，配件齐全',
      price: 2800,
      category: '电子产品',
      condition: '充新',
      images: JSON.stringify(['https://picsum.photos/400/400?random=1']),
      minPrice: 2400,
      maxPrice: 2800,
      autoAcceptPrice: 2600,
      xianyuUrl: 'https://www.gotokeep.com/item/test-001',
      source: 'xianyu',
      platformListed: true,
      sellerId: user.id,
    },
    {
      title: 'Nintendo Switch OLED 白色',
      description: '日版Switch OLED，含塞尔达传说卡带，95新',
      price: 1800,
      category: '游戏',
      condition: '95新',
      images: JSON.stringify(['https://picsum.photos/400/400?random=2']),
      minPrice: 1500,
      maxPrice: 1800,
      autoAcceptPrice: 1650,
      xianyuUrl: 'https://www.gotokeep.com/item/test-002',
      source: 'xianyu',
      platformListed: true,
      sellerId: user.id,
    },
    {
      title: 'AirPods Pro 2 USB-C',
      description: '苹果AirPods Pro第二代，USB-C接口，99新',
      price: 1200,
      category: '电子产品',
      condition: '99新',
      images: JSON.stringify(['https://picsum.photos/400/400?random=3']),
      minPrice: 1000,
      maxPrice: 1200,
      autoAcceptPrice: 1100,
      xianyuUrl: 'https://www.gotokeep.com/item/test-003',
      source: 'xianyu',
      platformListed: true,
      sellerId: user.id,
    },
  ]

  for (let i = 0; i < products.length; i++) {
    await db.product.upsert({
      where: { id: `test-product-${i + 1}` },
      update: products[i],
      create: { id: `test-product-${i + 1}`, ...products[i] },
    })
  }
  console.log('  ✓ 3 products created')

  // Create test buyer
  const buyer = await db.user.upsert({
    where: { secondmeUserId: 'test-buyer-001' },
    update: {},
    create: {
      secondmeUserId: 'test-buyer-001',
      accessToken: 'buyer-token',
      refreshToken: 'buyer-refresh',
      tokenExpiresAt: new Date(Date.now() + 86400000),
      nickname: '测试买家',
    },
  })
  console.log('  ✓ Buyer user created')

  // Create test orders
  const orderData = [
    { status: 'PENDING', productIdx: 0, price: 2600, failureReason: null },
    { status: 'PENDING', productIdx: 1, price: 1650, failureReason: null },
    { status: 'PURCHASED', productIdx: 2, price: 1100, failureReason: null, tracking: 'SF1234567890', courier: '顺丰速运' },
    { status: 'FAILED', productIdx: 0, price: 2500, failureReason: '卖家涨价' },
  ] satisfies Array<{
    status: OrderStatus
    productIdx: number
    price: number
    failureReason: string | null
    tracking?: string
    courier?: string
  }>

  for (let i = 0; i < orderData.length; i++) {
    const o = orderData[i]
    await db.order.upsert({
      where: { id: `test-order-${i + 1}` },
      update: {},
      create: {
        id: `test-order-${i + 1}`,
        productId: `test-product-${o.productIdx + 1}`,
        buyerId: buyer.id,
        status: o.status,
        negotiatedPrice: o.price,
        originalPrice: products[o.productIdx].price,
        xianyuUrl: products[o.productIdx].xianyuUrl ?? '',
        trackingNumber: (o as any).tracking || null,
        courierCompany: (o as any).courier || null,
        failureReason: o.failureReason,
        purchasedAt: o.status === 'PURCHASED' ? new Date() : null,
        failedAt: o.status === 'FAILED' ? new Date() : null,
      },
    })
  }
  console.log(`  ✓ ${orderData.length} orders created`)

  console.log('\nSeed complete!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
