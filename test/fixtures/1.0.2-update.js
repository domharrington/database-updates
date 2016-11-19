module.exports = (db, cb) => {
  db.collection('d').ensureIndex({ d: 1 }, cb)
}
