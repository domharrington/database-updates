const { MongoClient } = require('mongodb')
const databaseUpdates = require('.')

async function main() {
  const client = await MongoClient.connect(
    'mongodb://localhost/database-updates'
  )

  await client.db().dropDatabase()

  await databaseUpdates({
    db: client.db(),
    updatePath: `${__dirname}/test/fixtures/`,
  }).run()

  console.log('Done!')
  return client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
