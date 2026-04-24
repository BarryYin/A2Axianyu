import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function checkUsers() {
  console.log('=== 检查数据库用户 ===\n')

  const users = await db.user.findMany({
    select: {
      id: true,
      phone: true,
      nickname: true,
      isPlatformSeller: true,
      createdAt: true,
    }
  })

  console.log(`共有 ${users.length} 个用户:\n`)

  for (const user of users) {
    console.log(`ID: ${user.id}`)
    console.log(`手机号: ${user.phone}`)
    console.log(`昵称: ${user.nickname}`)
    console.log(`平台卖家: ${user.isPlatformSeller ? '是' : '否'}`)
    console.log(`创建时间: ${user.createdAt}`)
    console.log('---')
  }

  // 验证密码
  console.log('\n=== 验证密码 ===\n')

  const testUser = await db.user.findUnique({
    where: { phone: '13912345678' }
  })

  if (testUser) {
    console.log('找到测试买家:', testUser.nickname)
    const testPassword = 'buyer123'
    const isValid = await bcrypt.compare(testPassword, testUser.password)
    console.log(`密码 "${testPassword}" 验证结果:`, isValid ? '✅ 正确' : '❌ 错误')
  } else {
    console.log('❌ 未找到测试买家 (13912345678)')
  }

  const platformUser = await db.user.findUnique({
    where: { phone: '13800000000' }
  })

  if (platformUser) {
    console.log('\n找到平台卖家:', platformUser.nickname)
    const testPassword = 'platform123'
    const isValid = await bcrypt.compare(testPassword, platformUser.password)
    console.log(`密码 "${testPassword}" 验证结果:`, isValid ? '✅ 正确' : '❌ 错误')
  }
}

checkUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
