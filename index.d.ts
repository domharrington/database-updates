interface DatabaseUpdatesOptions {
  // This type could be better, but it's a start
  db: { collection: (arg0: string) => any }
  updateCollectionName?: string
  updatePath?: string
  logger?: Console
}

declare function DatabaseUpdates(
  options: DatabaseUpdatesOptions
): DatabaseUpdates

declare class DatabaseUpdates {
  constructor(options: DatabaseUpdatesOptions)
  run(): Promise<string[]>
}

export = DatabaseUpdates
