const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const semver = require('semver')
const async = require('async')
const path = require('path')

function DatabaseUpdates(options) {
  EventEmitter.apply(this)

  options = options || {} // eslint-disable-line no-param-reassign

  this.db = options.db
  if (!this.db) throw new Error('`options.db` must be provided')

  this.updateCollectionName = options.updateCollectionName || 'databaseUpdates'
  this.updateCollection = this.db.collection(this.updateCollectionName)
  this.updatePath = options.updatePath || `${process.cwd()}/updates`
  this.logger = options.logger || console

  this.updateFiles = []

  process.nextTick(() => {
    this.getFiles()
    this.run()
  })
}

DatabaseUpdates.prototype = Object.create(EventEmitter.prototype)

DatabaseUpdates.prototype.getFiles = function getFiles() {
  try {
    this.updateFiles = fs.readdirSync(this.updatePath)
      // exclude non-javascript files in the updates folder
      .map(i => (path.extname(i) !== '.js' ? false : i))
      // exclude falsy values and filenames that without a valid semver
      .filter(i => i && semver.valid(i.split('-')[0]))
      // exclude anything after a hyphen from the version number
      .sort((a, b) => semver.compare(a.split('-')[0], b.split('-')[0]))
  } catch (e) {
    this.logger.error('Error reading updatePath folder', e)
  }
}

DatabaseUpdates.prototype.updateExists = function updateExists(file, cb) {
  this.updateCollection.count({ file }, (err, count) => {
    if (err) return cb(err)
    return cb(null, count !== 0)
  })
}

DatabaseUpdates.prototype.runFile = function runFile(file, next) {
  this.updateExists(file, (err, exists) => {
    if (err) return next(err)
    if (exists) return next()

    this.emit('file', file)
    this.logger.info('Running update:', file)

    /* eslint-disable global-require, import/no-dynamic-require */
    const update = require(path.join(this.updatePath, file))
    /* eslint-enable global-require, import/no-dynamic-require */

    return update(this.db, (err) => {
      if (err) {
        this.logger.error('Error running update:', file)
        return next(err)
      }

      return this.persistUpdate(file, next)
    })
  })
}

DatabaseUpdates.prototype.persistUpdate = function persistUpdate(file, next) {
  this.logger.info('Persisting update:', file)

  const update = { file, created: new Date() }
  this.updateCollection.insert(update, (err) => {
    if (err) {
      this.logger.error('Error persisting update:', update)
      return next(err)
    }

    return next()
  })
}

DatabaseUpdates.prototype.run = function run() {
  async.eachSeries(this.updateFiles, this.runFile.bind(this), (err) => {
    if (err) return this.logger.error('Error running updates:', err)
    return this.emit('end')
  })
}

module.exports = DatabaseUpdates
