var DatabaseUpdates = require('../index.js')
  , assert = require('assert')
  , logger = require('mc-logger')
  , MongoClient = require('mongodb').MongoClient
  , hat = require('hat')
  , async = require('async')
  , doesIndexExist = require('does-index-exist')
  , files =
    [ '0.0.1-update.js'
    , '0.0.2-update.js'
    , '1.0.0-update.js'
    , '1.0.2-update.js'
    ]

describe('database-updates', function () {

  beforeEach(function (done) {
    MongoClient.connect('mongodb://localhost:27017/' + 'test-' + hat(25), function(err, db) {
      if (err) return done(err)
      this.db = db
      done()
    }.bind(this))
  })

  afterEach(function (done) {
    this.db.dropDatabase(done)
  })

  describe('updatesPath', function () {
    it('should default to ./updates', function () {
      var updates = new DatabaseUpdates({ logger: logger, db: this.db })
      assert.equal(updates.updatePath, process.cwd() + '/updates')
    })

    it('should be configurable', function () {
      var updatePath = './support/database/updates'
        , updates = new DatabaseUpdates({ updatePath: updatePath, logger: logger, db: this.db })

      assert.equal(updates.updatePath, updatePath)
    })
  })

  describe('db', function () {
    it('should throw if no db provided', function () {
      assert.throws(function () {
        var updates = new DatabaseUpdates({ logger: logger })
        updates.run()
      }, /`options.db` must be provided/)
    })
  })

  it('should process files in semver order', function (done) {
    var updates = new DatabaseUpdates({ updatePath: __dirname + '/fixtures', db: this.db, logger: logger })
      , processedFiles = []

    updates.on('file', function (file) {
      processedFiles.push(file)
    })

    updates.on('end', function () {
      assert.deepEqual(processedFiles, files)
      done()
    })
  })

  function testIgnoreFile(fileName, reason) {
    return function (done) {
      var updates = new DatabaseUpdates({ updatePath: __dirname + '/fixtures', db: this.db, logger: logger })

      updates.on('file', function (file) {
        if (file === fileName) return done(new Error(reason))
      })

      updates.on('end', function () {
        done()
      })
    }
  }

  it('should ignore non js files', testIgnoreFile('0.0.1-update.notjs', 'Should only work with .js files'))
  it('should ignore non semver files'
    , testIgnoreFile('invalid-update.js', 'Should only work with semver files'))

  it('should execute the files', function (done) {
    var updates = new DatabaseUpdates({ updatePath: __dirname + '/fixtures', db: this.db, logger: logger })

    function assertUpdate(update, next) {
      var indexExist = doesIndexExist({ connection: this.db, collection: update.collection })

      indexExist(update.index, function (err, exists) {
        if (err) return next(err)
        assert(exists, 'Index should exist for update: ' + JSON.stringify(update))
        next()
      })
    }

    updates.on('end', function () {
      var updates =
        [ { collection: 'a', index: { key: { a: 1 } } }
        , { collection: 'b', index: { key: { b: 1 } } }
        , { collection: 'c', index: { key: { c: 1 } } }
        , { collection: 'd', index: { key: { d: 1 } } }
        ]

      async.each(updates, assertUpdate.bind(this), done)
    }.bind(this))
  })

  it('should persist the updates in the database', function (done) {
    var updates = new DatabaseUpdates({ updatePath: __dirname + '/fixtures', db: this.db, logger: logger })
      , collection = this.db.collection('databaseUpdates')

    function assertUpdateStored(file, next) {
      collection.findOne({ file: file }, function (err, storedUpdate) {
        if (err) return next(err)
        // console.log(storedUpdate);
        assert(storedUpdate.created, 'Should store a created date')
        next()
      })
    }

    updates.on('end', function () {
      collection.count(function (err, count) {
        if (err) return done(err)
        assert.equal(count, 4)
        async.each(files, assertUpdateStored.bind(this), done)
      })
    }.bind(this))
  })

  it('should not run the same file if it has already been run', function (done) {
    var collection = this.db.collection('databaseUpdates')
      , count = 0

    collection.insert({ file: files[ 0 ], created: new Date() }, function (err) {
      if (err) return done(err)
      var updates = new DatabaseUpdates({ updatePath: __dirname + '/fixtures', db: this.db, logger: logger })

      updates.on('file', function () {
        count += 1
      })

      updates.on('end', function () {
        assert.equal(count, files.length - 1)
        done()
      })
    }.bind(this))
  })

})
