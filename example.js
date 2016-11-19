const DatabaseUpdates = require('./')
const MongoClient = require('mongodb').MongoClient

MongoClient.connect('mongodb://localhost:27017/database-updates', (err, db) => {
  const updates = new DatabaseUpdates({ db, updatePath: `${__dirname}/test/fixtures/` })

  updates.on('end', () => db.close())
})
