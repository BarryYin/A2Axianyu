import { db } from '../src/lib/db'

async function testAINegotiate() {
  console.log('=== AI 谈价流程测试 ===\n')

  // 1. 获取商品
  const product = await db.product.findFirst({
    where: { platformListed: true },
    include: { seller: true }
  })

  if (!product) {
    console.log('❌ 没有平台商品')
    return
  }

  console.log('商品:', product.title, `¥${product.price}`)
  console.log('卖家:', product.seller.nickname)
  console.log('AI性格:', product.aiPersonality?.slice(0, 30) + '...')
  console.log('')

  // 2. 创建或获取测试买家
  const testPhone = '13912345678'
  let buyer = await db.user.findUnique({ where: { phone: testPhone } })

  if (!buyer) {
    console.log('❌ 测试买家不存在，请先运行 test-bargain-flow.ts')
    return
  }

  console.log('买家:', buyer.nickname)
  console.log('')

  // 3. 模拟买家AI出价（85折）
  const buyerOfferPrice = Math.round(product.price * 0.85)
  console.log('→ 买家AI分析商品...')
  console.log(`  原价: ¥${product.price}`)
  console.log(`  建议出价: ¥${buyerOfferPrice} (约${Math.round(buyerOfferPrice/product.price*100)}%)`)
  console.log(`  理由: 成色不错，但想争取更好价格`)
  console.log('')

  // 4. 创建出价记录
  const offer = await db.offer.create({
    data: {
      productId: product.id,
      buyerId: buyer.id,
      price: buyerOfferPrice,
      message: '诚心要，能便宜点吗？',
      status: 'pending',
    }
  })
  console.log('✓ 出价已创建:', `¥${offer.price}`)
  console.log('')

  // 5. 平台AI卖家决策
  console.log('→ 平台AI卖家思考中...')

  // 简单决策逻辑
  const minAcceptable = product.minPrice || product.price * 0.9
  let sellerDecision: string
  let counterPrice: number | undefined
  let reason: string

  if (buyerOfferPrice >= (product.autoAcceptPrice || product.price * 0.95)) {
    sellerDecision = 'accept'
    reason = '价格合理，直接成交！'
    console.log(`  决策: 接受`)
  } else if (buyerOfferPrice < minAcceptable) {
    sellerDecision = 'counter'
    counterPrice = Math.round((product.price + buyerOfferPrice) / 2)
    reason = `这个价格太低了，最低${counterPrice}可以出`
    console.log(`  决策: 还价 ¥${counterPrice}`)
  } else {
    sellerDecision = 'counter'
    counterPrice = Math.round(product.price * 0.95)
    reason = '接近心理价位，再让一点'
    console.log(`  决策: 还价 ¥${counterPrice}`)
  }

  console.log(`  理由: ${reason}`)
  console.log('')

  // 6. 更新出价
  await db.offer.update({
    where: { id: offer.id },
    data: {
      sellerDecision,
      counterPrice,
    }
  })

  // 7. 买家AI回应
  console.log('→ 买家AI回应...')

  if (sellerDecision === 'accept') {
    await db.offer.update({
      where: { id: offer.id },
      data: { status: 'pending_confirmation' }
    })
    console.log('  买家: 太好了，成交！')
    console.log(`\n✅ 谈价成功！最终价格: ¥${buyerOfferPrice}`)
  } else {
    // 买家决定是否接受还价
    const buyerAccepts = counterPrice && counterPrice <= product.price * 0.92

    if (buyerAccepts) {
      await db.offer.update({
        where: { id: offer.id },
        data: { status: 'pending_confirmation' }
      })
      console.log(`  买家: 这个价格可以接受，成交！`)
      console.log(`\n✅ 谈价成功！最终价格: ¥${counterPrice}`)
    } else {
      // 买家再还价
      const newOffer = Math.round((buyerOfferPrice + counterPrice) / 2)
      console.log(`  买家: 还是有点贵，${newOffer}可以吗？`)

      const secondOffer = await db.offer.create({
        data: {
          productId: product.id,
          buyerId: buyer.id,
          price: newOffer,
          message: '再让一点吧',
          status: 'pending',
          inReplyToId: offer.id,
        }
      })

      console.log(`\n⏸ 第二轮出价: ¥${newOffer}`)
      console.log('  (实际流程中会继续AI对话)')
    }
  }

  console.log('\n=== 测试完成 ===')
  console.log('\n议价记录已保存到数据库')
  console.log(`您可以访问商品页面查看: http://localhost:3000/products/${product.id}`)
}

testAINegotiate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
