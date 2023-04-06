module.exports = (db, cb) => {
  return db.collection('d').createIndex({ d: 1 })
}
