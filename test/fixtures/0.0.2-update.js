module.exports = (db, cb) => {
  db.collection('b').ensureIndex({ b: 1 }, cb)
}
