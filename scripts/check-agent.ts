import { db } from '../src/lib/db'
import { hashAgentApiKey } from '../src/lib/auth'

async function checkAgent() {
  const apiKey = 'agt_32a4212ac273e61772b62ca6e2d5c2d7b9f98c6dca5c74f'
  const hash = hashAgentApiKey(apiKey)

  console.log('API Key:', apiKey)
  console.log('Hash:', hash)
  console.log('')

  const client = await db.agentClient.findFirst({
    where: { apiKeyHash: hash },
    include: { ownerUser: true }
  })

  if (client) {
    console.log('找到 Agent Client:')
    console.log('  ID:', client.id)
    console.log('  Name:', client.name)
    console.log('  Status:', client.status)
    console.log('  Owner:', client.ownerUser?.nickname)
    console.log('  Scopes:', client.scopes)
  } else {
    console.log('未找到 Agent Client')

    // 列出所有 agent clients
    console.log('\n所有 Agent Clients:')
    const all = await db.agentClient.findMany()
    for (const c of all) {
      console.log(`  ${c.id}: ${c.name} (${c.status})`)
      console.log(`    Hash: ${c.apiKeyHash}`)
    }
  }
}

checkAgent()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
