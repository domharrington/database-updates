module.exports = function (db, cb) {
  db.collection('d').ensureIndex({ d: 1 }, cb)
}
