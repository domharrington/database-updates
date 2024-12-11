const fs = require('fs')
const semver = require('semver')
const path = require('path')

function DatabaseUpdates(options) {
  options = options || {} // eslint-disable-line no-param-reassign
  if (!(this instanceof DatabaseUpdates)) return new DatabaseUpdates(options)

  this.db = options.db
  if (!this.db) throw new Error('`options.db` must be provided')

  this.updateCollectionName = options.updateCollectionName || 'databaseUpdates'
  this.updateCollection = this.db.collection(this.updateCollectionName)
  this.updatePath = options.updatePath || `${process.cwd()}/updates`
  this.logger = options.logger || console

  this.updateFiles = []

  this.getFiles()
}

DatabaseUpdates.prototype = Object.create({})

DatabaseUpdates.prototype.getFiles = function getFiles() {
  try {
    this.updateFiles = fs
      .readdirSync(this.updatePath)
      // exclude non-javascript files in the updates folder
      .map((i) => (path.extname(i).match(/\.js|\.mjs/) ? i : false))
      // exclude falsy values and filenames without a valid semver
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
  if (exists) return Promise.resolve(false)

  this.logger.info('Running update:', file)

  const update = await import(path.join(this.updatePath, file))

  try {
    await update.default(this.db)
    return this.persistUpdate(file)
  } catch (err) {
    this.logger.error('Error running update:', file)
    throw err
  }
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
  const updates = []
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const file of this.updateFiles) {
      // eslint-disable-next-line no-await-in-loop
      if ((await this.runFile(file)) !== false) {
        updates.push(file)
      }
    }
    return updates
  } catch (err) {
    this.logger.error('Error running updates:', err)
    throw err
  }
}

module.exports = DatabaseUpdates
