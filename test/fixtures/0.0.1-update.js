module.exports = (db, cb) => {
  db.collection('a').ensureIndex({ a: 1 }, cb)
}
