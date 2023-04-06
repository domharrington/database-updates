# database-updates

Apply database updates to your application based on [semver](http://semver.org/) file names

The purpose of this module is to ensure that all developers of an application have an up-to-date database. Arbitrary database update scripts or index creation scripts for new properties get created a lot, but all too often these scripts forget to be run which can result in an inconsistent state across developers and even environments.

Adding this module to your application will ensure that any scripts that need to be run will by executed across all machines during setup.

## Installation

```sh
npm install database-updates --save
```

## Usage

```js
const DatabaseUpdates = require('database-updates')
const MongoClient = require('mongodb').MongoClient

MongoClient.connect('mongodb://localhost:27017/database-updates', (err, db) => {
  const updates = new DatabaseUpdates({
    db,
    updatePath: `${__dirname}/test/fixtures/`,
  })

  updates.on('end', () => db.close())
})
```

### `var updates = new DatabaseUpdates(options)`

Options must include:

- `db` - a database connection returned from `MongoClient.connect` or similar

Optional options:

- `updateCollectionName` - the collection to store app updates. Defaults to `databaseUpdates`
- `updatePath` - the location to look for update scripts. Defaults to `process.cwd() + '/updates'`
- `logger` - the logger to use. Defaults to `console`

## An update script

An update script is a JavaScript file with the following signature:

```js
module.exports = function (db, done) {}
```

The `db` parameter is your application's database object. This enables you to modify the database.

The `done` parameter is a callback to call when complete.

An example update script to add an index to a collection would be:

```js
module.exports = function (db, done) {
  db.collection('collection').ensureIndex({ a: 1 }, done)
}
```

When an update script is run once, it will never be run again on the same machine.
The files that have been applied are stored in the (configurable) `databaseUpdates` collection.

## Naming

The naming of update scripts is significant for the order in which they are run. The first part of the filename must be a valid semver version e.g. `0.0.1-adding-first-admin-user.js`. The second part (after the '-') is a description of the update.

A folder with the following update scripts:

```
1.0.0-update.js
1.0.2-update.js
0.0.1-update.js
0.0.2-update.js
```

Would get run in this order:

`0.0.1-update.js`

`0.0.2-update.js`

`1.0.0-update.js`

`1.0.2-update.js`

## Credits

[Dom Harrington](https://github.com/domharrington/)

[KeystoneJS](http://keystonejs.com/docs/getting-started/#runningyourapp-writingupdates) - for the concept
