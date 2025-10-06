declare module 'expo-sqlite' {
  export type SQLResultSet = any;
  export type SQLResultSetRowList = { _array: any[] };
  export type SQLTransaction = any;
  export type WebSQLDatabase = any;

  export function openDatabase(name?: string): WebSQLDatabase;
}
