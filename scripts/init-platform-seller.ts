import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function initPlatformSeller() {
  const phone = '13800000000'
  const password = 'platform123'

  // 检查是否已存在
  const existing = await db.user.findUnique({
    where: { phone }
  })

  if (existing) {
    console.log('平台卖家账号已存在:', existing.id)
    return existing
  }

  // 创建平台卖家
  const hashedPassword = await bcrypt.hash(password, 10)
  const platformSeller = await db.user.create({
    data: {
      phone,
      password: hashedPassword,
      nickname: '平台精选',
      isPlatformSeller: true,
    }
  })

  console.log('平台卖家账号创建成功:')
  console.log('  ID:', platformSeller.id)
  console.log('  手机号:', phone)
  console.log('  密码:', password)
  console.log('  昵称:', platformSeller.nickname)

  return platformSeller
}

initPlatformSeller()
  .then(() => {
    console.log('Done')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
