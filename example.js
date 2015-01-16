var DatabaseUpdates = require('./')
  , MongoClient = require('mongodb').MongoClient

MongoClient.connect('mongodb://localhost:27017/database-updates', function (err, db) {
  var updates = new DatabaseUpdates({ db: db, updatePath: __dirname + '/test/fixtures/' })

  updates.on('end', function () {
    db.close()
  })
})
