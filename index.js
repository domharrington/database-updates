const { EventEmitter } = require('events')
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
    this.updateFiles = fs
      .readdirSync(this.updatePath)
      // exclude non-javascript files in the updates folder
      .map((i) => (path.extname(i) !== '.js' ? false : i))
      // exclude falsy values and filenames that without a valid semver
      .filter((i) => i && semver.valid(i.split('-')[0]))
      // exclude anything after a hyphen from the version number
      .sort((a, b) => semver.compare(a.split('-')[0], b.split('-')[0]))
  } catch (e) {
    this.logger.error('Error reading updatePath folder', e)
  }
}

DatabaseUpdates.prototype.updateExists = function updateExists(file) {
  return this.updateCollection.count({ file }).then((count) => count !== 0)
}

DatabaseUpdates.prototype.runFile = async function runFile(file) {
  const exists = await this.updateExists(file)
  if (exists) return

  this.emit('file', file)
  this.logger.info('Running update:', file)

  /* eslint-disable global-require, import/no-dynamic-require */
  const update = require(path.join(this.updatePath, file))
  /* eslint-enable global-require, import/no-dynamic-require */

  return update(this.db)
    .then(() => {
      return this.persistUpdate(file)
    })
    .catch((err) => {
      this.logger.error('Error running update:', file)
      throw err
    })
}

DatabaseUpdates.prototype.persistUpdate = function persistUpdate(file) {
  this.logger.info('Persisting update:', file)

  const update = { file, created: new Date() }
  return this.updateCollection.insertOne(update).catch((err) => {
    this.logger.error('Error persisting update:', update)
    throw err
  })
}

DatabaseUpdates.prototype.run = async function run() {
  try {
    for (const file of this.updateFiles) {
      await this.runFile(file)
    }
    return this.emit('end')
  } catch (err) {
    this.logger.error('Error running updates:', err)
    throw err
  }
}

module.exports = DatabaseUpdates
