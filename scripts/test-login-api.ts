import bcrypt from 'bcryptjs'
import { db } from '../src/lib/db'

async function testLogin() {
  console.log('=== 测试登录 API ===\n')

  const phone = '13912345678'
  const password = 'buyer123'

  console.log('测试登录:', phone)

  // 直接查询数据库
  const user = await db.user.findUnique({
    where: { phone }
  })

  if (!user) {
    console.log('❌ 用户不存在')
    return
  }

  console.log('✓ 找到用户:', user.nickname)
  console.log('  数据库密码:', user.password.substring(0, 20) + '...')

  // 直接验证密码
  const isValid = await bcrypt.compare(password, user.password)
  console.log('  密码验证结果:', isValid)

  // 模拟 API 调用
  console.log('\n模拟 API 请求...')
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    })

    const data = await res.json()
    console.log('API 响应状态:', res.status)
    console.log('API 响应内容:', data)
  } catch (err) {
    console.log('❌ API 调用失败:', err)
    console.log('请确保服务器在运行: npm run dev')
  }
}

testLogin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
