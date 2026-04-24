import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function testBargainFlow() {
  console.log('=== A2A 闲鱼议价流程测试 ===\n')

  // 1. 获取平台卖家
  const platformSeller = await db.user.findFirst({
    where: { isPlatformSeller: true }
  })

  if (!platformSeller) {
    console.error('❌ 平台卖家不存在')
    process.exit(1)
  }
  console.log('✓ 平台卖家:', platformSeller.nickname, `(${platformSeller.phone})`)

  // 2. 创建测试买家账号
  const testBuyerPhone = '13912345678'
  let testBuyer = await db.user.findUnique({
    where: { phone: testBuyerPhone }
  })

  if (!testBuyer) {
    const hashedPassword = await bcrypt.hash('buyer123', 10)
    testBuyer = await db.user.create({
      data: {
        phone: testBuyerPhone,
        password: hashedPassword,
        nickname: '测试买家小A',
      }
    })
    console.log('✓ 创建测试买家:', testBuyer.nickname, `(${testBuyer.phone})`)
    console.log('  登录密码: buyer123')
  } else {
    console.log('✓ 测试买家已存在:', testBuyer.nickname, `(${testBuyer.phone})`)
  }

  // 3. 获取一个平台商品
  const product = await db.product.findFirst({
    where: {
      sellerId: platformSeller.id,
      status: 'active'
    }
  })

  if (!product) {
    console.error('❌ 没有可用的平台商品')
    process.exit(1)
  }
  console.log('✓ 选择商品:', product.title, `¥${product.price}`)

  // 4. 模拟买家出价
  const offerPrice = product.price * 0.85 // 85折
  const offer = await db.offer.create({
    data: {
      productId: product.id,
      buyerId: testBuyer.id,
      price: Math.round(offerPrice),
      message: '诚心要，价格可以谈吗？',
      status: 'pending',
    }
  })
  console.log('✓ 买家出价:', `¥${offer.price}`, `- "${offer.message}"`)

  // 5. 模拟平台卖家AI回应（接受并还价）
  const counterPrice = product.price * 0.92 // 92折
  const updatedOffer = await db.offer.update({
    where: { id: offer.id },
    data: {
      sellerDecision: 'counter',
      counterPrice: Math.round(counterPrice),
    }
  })
  console.log('✓ 平台AI回应:', `还价 ¥${updatedOffer.counterPrice}`)
  console.log('  AI代理性格:', product.aiPersonality)

  // 6. 最终买家接受
  const finalOffer = await db.offer.update({
    where: { id: offer.id },
    data: {
      status: 'pending_confirmation',
      sellerDecision: 'accept',
    }
  })
  console.log('✓ 议价结果:', `待确认成交 ¥${finalOffer.counterPrice}`)

  console.log('\n=== 测试完成 ===')
  console.log('\n您可以：')
  console.log(`  1. 用买家账号登录: ${testBuyer.phone} / buyer123`)
  console.log(`  2. 访问 http://localhost:3000/products/${product.id}`)
  console.log(`  3. 在「我的」页面查看待确认订单`)
  console.log(`  4. 确认成交完成交易`)
}

testBargainFlow()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
