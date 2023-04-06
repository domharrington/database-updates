module.exports = (db) => {
  return db.collection('b').createIndex({ b: 1 })
}
