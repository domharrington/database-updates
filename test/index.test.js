const assert = require('assert')
const logger = require('mc-logger')
const { MongoClient } = require('mongodb')
const hat = require('hat')
const DatabaseUpdates = require('../index')

const files = [
  '0.0.1-update.js',
  '0.0.2-update.js',
  '1.0.0-update.js',
  '1.0.2-update.js',
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
      const updates = new DatabaseUpdates({ logger, db: client.db() })
      assert.equal(updates.updatePath, `${process.cwd()}/updates`)
    })

    it('should be configurable', () => {
      const updatePath = './support/database/updates'
      const updates = new DatabaseUpdates({
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
        const updates = new DatabaseUpdates({ logger })
        updates.run()
      }, /`options.db` must be provided/)
    })
  })

  it('should process files in semver order', (done) => {
    const updates = new DatabaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    })
    const processedFiles = []

    updates.on('file', (file) => {
      processedFiles.push(file)
    })

    updates.on('end', () => {
      try {
        assert.deepEqual(processedFiles, files)
        return done()
      } catch (e) {
        return done(e)
      }
    })
  })

  function testIgnoreFile(fileName, reason) {
    return function test(done) {
      const updates = new DatabaseUpdates({
        updatePath: `${__dirname}/fixtures`,
        db: client.db(),
        logger,
      })

      updates.on('file', (file) => {
        if (file === fileName) done(new Error(reason))
      })

      updates.on('end', () => done())
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

  it('should execute the files', (done) => {
    const updates = new DatabaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    })

    async function assertUpdate(update) {
      const exists = await client
        .db()
        .collection(update.collection)
        .indexExists(update.index)

      assert(exists, `Index should exist for update: ${JSON.stringify(update)}`)
    }

    updates.on('end', async () => {
      const expectedUpdates = [
        { collection: 'a', index: 'a_1' },
        { collection: 'b', index: 'b_1' },
        { collection: 'c', index: 'c_1' },
        { collection: 'd', index: 'd_1' },
      ]

      await Promise.all(expectedUpdates.map((update) => assertUpdate(update)))
        .then(() => done())
        .catch((err) => done(err))
    })
  })

  it('should persist the updates in the database', (done) => {
    const updates = new DatabaseUpdates({
      updatePath: `${__dirname}/fixtures`,
      db: client.db(),
      logger,
    })
    const collection = client.db().collection('databaseUpdates')

    async function assertUpdateStored(file) {
      const storedUpdate = await collection.findOne({ file })
      assert(storedUpdate.created, 'Should store a created date')
    }

    updates.on('end', async () => {
      try {
        assert.equal(await collection.countDocuments(), 4)
        return await Promise.all(
          files.map((update) => assertUpdateStored(update))
        )
          .then(() => done())
          .catch((err) => done(err))
      } catch (e) {
        return done(e)
      }
    })
  })

  it('should not run the same file if it has already been run', (done) => {
    const collection = client.db().collection('databaseUpdates')
    let count = 0

    collection.insertOne({ file: files[0], created: new Date() }).then(() => {
      const updates = new DatabaseUpdates({
        updatePath: `${__dirname}/fixtures`,
        db: client.db(),
        logger,
      })

      updates.on('file', () => {
        count += 1
      })

      return updates.on('end', () => {
        assert.equal(count, files.length - 1)
        done()
      })
    })
  })

  it('should bubble up errors', (done) => {
    const updates = new DatabaseUpdates({
      updatePath: `${__dirname}/error-fixtures`,
      db: client.db(),
      logger,
    })

    updates.on('error', (err) => {
      try {
        assert.equal(err.message, 'This is an error')
        return done()
      } catch (e) {
        return done(e)
      }
    })
  })
})
