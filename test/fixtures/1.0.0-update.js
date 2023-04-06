module.exports = (db) => {
  return db.collection('c').createIndex({ c: 1 })
}
