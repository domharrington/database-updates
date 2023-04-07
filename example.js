const { MongoClient } = require('mongodb')
const DatabaseUpdates = require('.')

async function main() {
  const client = await MongoClient.connect(
    'mongodb://localhost/database-updates'
  )

  await client.db().dropDatabase()

  const updates = new DatabaseUpdates({
    db: client.db(),
    updatePath: `${__dirname}/test/fixtures/`,
  })

  updates.on('file', (file) => console.log(`Processing file: ${file}`))
  updates.on('end', () => {
    console.log('Done!')
    return client.close()
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
