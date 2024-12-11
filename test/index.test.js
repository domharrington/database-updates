const assert = require('assert')
const logger = require('mc-logger')
const { MongoClient } = require('mongodb')
// @todo remove this?
const hat = require('hat')
const databaseUpdates = require('../index')

const files = [
  '0.0.1-update.js',
  '0.0.2-update.js',
  '1.0.0-update.js',
  '1.0.2-update.js',
  '1.0.3-update.mjs',
]

describe('database-updates', () => {
  let client
  beforeEach(async () => {
    client = await MongoClient.connect(
      `mongodb://localhost:27017/test-${hat(25)}`
    )
  })

  // Drop the database
  afterEach(() => client.db().dropDatabase())
  // Close the mongo connection so mocha can exit
  afterEach(() => client.close())

  describe('updatesPath', () => {
    it('should default to ./updates', () => {
      const updates = databaseUpdates({ logger, db: client.db() })
      assert.equal(updates.updatePath, `${process.cwd()}/updates`)
    })

    it('should be configurable', () => {
      const updatePath = './support/database/updates'
      const updates = databaseUpdates({
        updatePath,
        logger,
        db: client.db(),
      })

      assert.equal(updates.updatePath, updatePath)
    })
  })

  describe('db', () => {
    it('should throw if no db provided', () => {
      assert.throws(() => {
        databaseUpdates({ logger })
      }, /`options.db` must be provided/)
    })
  })

  it('should process files in semver order', async () => {
    const processedFiles = await databaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    }).run()
    assert.deepEqual(processedFiles, files)
  })

  function testIgnoreFile(fileName, reason) {
    return async function test() {
      const updates = await databaseUpdates({
        updatePath: `${__dirname}/fixtures`,
        db: client.db(),
        logger,
      }).run()

      assert.equal(updates.includes(fileName), false, reason)
    }
  }

  it(
    'should ignore non js files',
    testIgnoreFile('0.0.1-update.notjs', 'Should only work with .js files')
  )

  it(
    'should ignore non semver files',
    testIgnoreFile('invalid-update.js', 'Should only work with semver files')
  )

  it('should execute the files', async () => {
    async function assertUpdate(update) {
      const exists = await client
        .db()
        .collection(update.collection)
        .indexExists(update.index)

      assert(exists, `Index should exist for update: ${JSON.stringify(update)}`)
    }
    const updates = await databaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    }).run()

    assert.deepEqual(updates, files)

    const expectedUpdates = [
      { collection: 'a', index: 'a_1' },
      { collection: 'b', index: 'b_1' },
      { collection: 'c', index: 'c_1' },
      { collection: 'd', index: 'd_1' },
      { collection: 'e', index: 'e_1' },
    ]
    return Promise.all(expectedUpdates.map((update) => assertUpdate(update)))
  })

  it('should persist the updates in the database', async () => {
    await databaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    }).run()
    const collection = client.db().collection('databaseUpdates')

    async function assertUpdateStored(file) {
      const storedUpdate = await collection.findOne({ file })
      assert(storedUpdate.created, 'Should store a created date')
    }

    assert.equal(await collection.countDocuments(), 5)
    return Promise.all(files.map((update) => assertUpdateStored(update)))
  })

  it('should not run the same file if it has already been run', async () => {
    const collection = client.db().collection('databaseUpdates')

    await collection.insertOne({ file: files[0], created: new Date() })
    const updates = await databaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    }).run()

    assert.equal(updates.length, files.length - 1)
  })

  it('should bubble up errors', async () => {
    await assert.rejects(
      async () => {
        await databaseUpdates({
          updatePath: `${__dirname}/error-fixtures`,
          db: client.db(),
          logger,
        }).run()
      },
      {
        name: 'Error',
        message: 'This is an error',
      }
    )
  })

  /*
   * This test is a bit of a hack. Without this module being rewritten in TS
   * It's impossible for me to actually test that it works e2e with TS files
   * So basically what I'm doing here is pointing the module at a folder
   * that contains a TS file, and then asserting that it throws an error
   * because it cannot load the file. This proves that we're attempting
   * to open it, but it's dependent on where the module is running whether
   * it will actually work or not.
   */
  it('should look for ts files', async () => {
    await assert.rejects(
      async () => {
        await databaseUpdates({
          updatePath: `${__dirname}/ts-fixtures`,
          db: client.db(),
          logger,
        }).run()
      },
      {
        name: 'TypeError',
        message: 'Unknown file extension ".ts" for /Users/domh/Sites/personal/database-updates/test/ts-fixtures/0.0.1-update.ts',
      }
    )
  })
})
