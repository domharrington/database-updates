const DatabaseUpdates = require('../index.js')
const assert = require('assert')
const logger = require('mc-logger')
const MongoClient = require('mongodb').MongoClient
const hat = require('hat')
const async = require('async')
const doesIndexExist = require('does-index-exist')

const files = [
  '0.0.1-update.js',
  '0.0.2-update.js',
  '1.0.0-update.js',
  '1.0.2-update.js',
]

describe('database-updates', () => {
  beforeEach(function beforeEach(done) {
    MongoClient.connect(`mongodb://localhost:27017/test-${hat(25)}`, (err, db) => {
      if (err) return done(err)
      this.db = db
      return done()
    })
  })

  afterEach(function afterEach(done) {
    this.db.dropDatabase(done)
  })

  describe('updatesPath', () => {
    it('should default to ./updates', function test() {
      const updates = new DatabaseUpdates({ logger, db: this.db })
      assert.equal(updates.updatePath, `${process.cwd()}/updates`)
    })

    it('should be configurable', function test() {
      const updatePath = './support/database/updates'
      const updates = new DatabaseUpdates({ updatePath, logger, db: this.db })

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

  it('should process files in semver order', function test(done) {
    const updates = new DatabaseUpdates({ updatePath: `${__dirname}/fixtures`, db: this.db, logger })
    const processedFiles = []

    updates.on('file', (file) => {
      processedFiles.push(file)
    })

    updates.on('end', () => {
      assert.deepEqual(processedFiles, files)
      done()
    })
  })

  function testIgnoreFile(fileName, reason) {
    return function test(done) {
      const updates = new DatabaseUpdates({ updatePath: `${__dirname}/fixtures`, db: this.db, logger })

      updates.on('file', (file) => {
        if (file === fileName) done(new Error(reason))
      })

      updates.on('end', () => done())
    }
  }

  it('should ignore non js files', testIgnoreFile('0.0.1-update.notjs', 'Should only work with .js files'))
  it('should ignore non semver files'
    , testIgnoreFile('invalid-update.js', 'Should only work with semver files'))

  it('should execute the files', function test(done) {
    const updates = new DatabaseUpdates({ updatePath: `${__dirname}/fixtures`, db: this.db, logger })

    function assertUpdate(update, next) {
      const indexExist = doesIndexExist({ connection: this.db, collection: update.collection })

      indexExist(update.index, (err, exists) => {
        if (err) return next(err)
        assert(exists, `Index should exist for update: ${JSON.stringify(update)}`)
        return next()
      })
    }

    updates.on('end', () => {
      const expectedUpdates = [
        { collection: 'a', index: { key: { a: 1 } } },
        { collection: 'b', index: { key: { b: 1 } } },
        { collection: 'c', index: { key: { c: 1 } } },
        { collection: 'd', index: { key: { d: 1 } } },
      ]

      async.each(expectedUpdates, assertUpdate.bind(this), done)
    })
  })

  it('should persist the updates in the database', function test(done) {
    const updates = new DatabaseUpdates({ updatePath: `${__dirname}/fixtures`, db: this.db, logger })
    const collection = this.db.collection('databaseUpdates')

    function assertUpdateStored(file, next) {
      collection.findOne({ file }, (err, storedUpdate) => {
        if (err) return next(err)
        // console.log(storedUpdate);
        assert(storedUpdate.created, 'Should store a created date')
        return next()
      })
    }

    updates.on('end', () => {
      collection.count((err, count) => {
        if (err) return done(err)
        assert.equal(count, 4)
        return async.each(files, assertUpdateStored.bind(this), done)
      })
    })
  })

  it('should not run the same file if it has already been run', function test(done) {
    const collection = this.db.collection('databaseUpdates')
    let count = 0

    collection.insert({ file: files[0], created: new Date() }, (err) => {
      if (err) return done(err)
      const updates = new DatabaseUpdates({ updatePath: `${__dirname}/fixtures`, db: this.db, logger })

      updates.on('file', () => (count += 1))

      return updates.on('end', () => {
        assert.equal(count, files.length - 1)
        done()
      })
    })
  })
})
