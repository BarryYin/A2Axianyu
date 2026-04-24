async function testNegotiateAPI() {
  const productId = 'cmod0srob0007knzqrtgpl5k8' // Dyson 吸尘器

  console.log('=== 测试 AI 议价 API ===\n')
  console.log('商品ID:', productId)
  console.log('')

  try {
    // 先登录获取 session
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13912345678',
        password: 'buyer123'
      }),
    })

    const loginData = await loginRes.json()
    console.log('登录结果:', loginData.success ? '✅ 成功' : '❌ 失败')

    if (!loginData.success) {
      console.log('错误:', loginData.error)
      return
    }

    // 获取 cookie
    const cookies = loginRes.headers.get('set-cookie')
    console.log('获取到 session cookie')
    console.log('')

    // 调用议价 API
    console.log('调用议价 API...')
    const negotiateRes = await fetch(`http://localhost:3000/api/products/${productId}/negotiate`, {
      method: 'POST',
      headers: {
        'Cookie': cookies || '',
      },
    })

    const negotiateData = await negotiateRes.json()
    console.log('API 响应状态:', negotiateRes.status)
    console.log('')

    if (negotiateData.code === 0) {
      console.log('✅ 议价成功!')
      console.log('结果:', negotiateData.data.outcome)
      if (negotiateData.data.finalPrice) {
        console.log('最终价格:', `¥${negotiateData.data.finalPrice}`)
      }
      if (negotiateData.data.logs) {
        console.log('\n议价过程:')
        negotiateData.data.logs.forEach((log: any, i: number) => {
          console.log(`  ${i+1}. ${log.role === 'buyer' ? '买家AI' : '卖家AI'}: ${log.action}${log.price ? ` ¥${log.price}` : ''}${log.reason ? ` - ${log.reason}` : ''}`)
        })
      }
    } else {
      console.log('❌ 议价失败')
      console.log('错误码:', negotiateData.code)
      console.log('错误信息:', negotiateData.message)
    }
  } catch (err) {
    console.error('测试失败:', err)
  }
}

testNegotiateAPI()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
