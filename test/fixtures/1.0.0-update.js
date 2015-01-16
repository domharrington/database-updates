module.exports = function (db, cb) {
  db.collection('c').ensureIndex({ c: 1 }, cb)
}
