module.exports = DatabaseUpdates

var EventEmitter = require('events').EventEmitter
  , fs = require('fs')
  , semver = require('semver')
  , async = require('async')
  , path = require('path')

function DatabaseUpdates(options) {
  EventEmitter.apply(this)

  options = options || {}

  this.db = options.db
  if (!this.db) throw new Error('`options.db` must be provided')

  this.updateCollectionName = options.updateCollectionName || 'databaseUpdates'
  this.updateCollection = this.db.collection(this.updateCollectionName)
  this.updatePath = options.updatePath || process.cwd() + '/updates'
  this.logger = options.logger || console

  this.updateFiles = []

  process.nextTick(function () {
    this.getFiles()
    this.run()
  }.bind(this))
}

DatabaseUpdates.prototype = Object.create(EventEmitter.prototype)

DatabaseUpdates.prototype.getFiles = function () {
  try {
    this.updateFiles = fs.readdirSync(this.updatePath)
      .map(function(i) {
        // exclude non-javascript files in the updates folder
        return path.extname(i) !== '.js' ? false : i
      }).filter(function(i) {
        // exclude falsy values and filenames that without a valid semver
        return i && semver.valid(i.split('-')[ 0 ])
      }).sort(function(a, b) {
        // exclude anything after a hyphen from the version number
        return semver.compare(a.split('-')[ 0 ], b.split('-')[ 0 ])
      })
  } catch (e) {
    this.logger.error('Error reading updatePath folder', e)
  }
}

DatabaseUpdates.prototype.updateExists = function (file, cb) {
  this.updateCollection.count({ file: file }, function (err, count) {
    if (err) return cb(err)
    return cb(null, count !== 0)
  })
}

DatabaseUpdates.prototype.runFile = function (file, next) {
  this.updateExists(file, function (err, exists) {
    if (err) return next(err)
    if (exists) return next()

    this.emit('file', file)
    this.logger.info('Running update:', file)

    var update = require(path.join(this.updatePath, file))
    update(this.db, function (err) {
      if (err) {
        this.logger.error('Error running update:', file)
        return next(err)
      }

      this.persistUpdate(file, next)
    }.bind(this))

  }.bind(this))
}

DatabaseUpdates.prototype.persistUpdate = function (file, next) {
  this.logger.info('Persisting update:', file)

  var update = { file: file, created: new Date() }
  this.updateCollection.insert(update, function (err) {
    if (err) {
      this.logger.error('Error persisting update:', update)
      return next(err)
    }

    next()
  }.bind(this))
}

DatabaseUpdates.prototype.run = function () {
  async.eachSeries(this.updateFiles, this.runFile.bind(this), function (err) {
    if (err) return this.logger.error('Error running updates:', err)
    this.emit('end')
  }.bind(this))
}
