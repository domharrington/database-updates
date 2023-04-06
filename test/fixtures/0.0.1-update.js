module.exports = (db) => {
  return db.collection('a').createIndex({ a: 1 })
}
