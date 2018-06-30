const Database = require('better-sqlite3'),
      moment = require('moment');

module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, typeOf } = requireModule('./base/utils');
  const { BaseSQLConnector } = requireModule('./connectors/base-sql-connector');
  const Logger = requireModule('./base/logger');
  const { Context } = requireModule('./base/context');

  const SCHEMA_COLUMNS = {
          'table.name': 'table_name',
          'column.field': 'name',
          'column.value': 'dflt_value',
          'column.nullable': (row) => !row.notnull,
          'column.key': (row) => ((row.pk) ? 'pri' : ''),
          'column.type': (row) => (row.type.replace(/^(\w+).*$/g, '$1')),
          'column.size': (row) => {
            var size;

            row.type.replace(/^\w+\s*\(\s*([\d.-]+)\s*\)/g, function(m, p) {
              size = parseFloat(p);
            });

            return size;
          }
        },
        SCHEMA_COLUMNS_KEYS = Object.keys(SCHEMA_COLUMNS);

  // Connections for the SQLite syncrounous DB are really just query groups
  const SQLiteConnection = this.defineClass((ParentClass) => {
    return class SQLiteConnection extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = _opts || {};

        if (!opts.connector)
          throw new Error('Parent connector required for connection');

        definePropertyRO(this, 'options', opts);
        definePropertyRO(this, 'connector', opts.connector);
        definePropertyRW(this, 'queries', []);
      }

      getContext(...args) {
        return new Context({ name: 'sqlite', group: 'connection' }, ...args);
      }

      async beginTransaction() {
        this.queries.push({ query: 'BEGIN', required: true });
        return { connection: this, onReleaseConnection: () => {} };
      }

      async rollback() {
        return await this.connector.exec('ROLLBACK', undefined, { que: false });
      }

      async commit() {
        return await this.connector.exec('COMMIT', undefined, { que: false });
      }

      async release() {

      }

      async flush() {
        return await this.connector.execAll(this.queries);
      }

      exec(queryStr, values, _opts) {
        var opts = _opts || {};
        this.queries.push({ query: queryStr, values, required: (opts.required !== false) });
      }

      execAll(queries) {
        this.queries = this.queries.concat(queries);
      }
    };
  });


  // SQLite DB wrapper
  const SQLiteConnector = this.defineClass((BaseSQLConnector) => {
    return class SQLiteConnector extends BaseSQLConnector {
      constructor(_opts) {
        var opts = Object.assign({
          timeout: 15000,
          databasePath: null,
          readonly: false,
          fileMustExist: false
        }, _opts || {});

        if (!opts.context)
          opts.context = 'sqlite';

        if (!opts.databasePath)
          opts.memory = true;

        super({ ...opts, read: true, write: true });

        definePropertyRW(this, 'database', new Database(opts.databasePath || '/tmp/xoumz.sqlite', opts));
        definePropertyRW(this, 'connections', []);
      }

      getContext(...args) {
        return new Context({ name: 'sqlite', group: 'connector' }, ...args);
      }

      // Connections are really just query groups
      async getConnection() {
        var connection = new SQLiteConnection({
          connector: this
        });

        this.connections.push(connection);

        return connection;
      }

      async transaction(cb) {
        if (typeof cb !== 'function')
          throw new Error('Transaction method called without a callback');

        try {
          var connectionOptions = await this.beginTransaction();
          await cb.call(this, connectionOptions.connection);
          await this.endTransaction(null, connectionOptions);
        } catch (e) {
          await this.endTransaction(e, connectionOptions);
          throw new Error(`Transaction failed with error: ${e}`);
        }
      }

      // Start a "connection" (query group)
      async beginTransaction() {
        var connection = await this.getConnection();
        return await connection.beginTransaction();
      }

      // Flush query group and commit if successful... or rollback if not
      async endTransaction(err, { connection }) {
        if (err || !connection)
          return;

        try {
          // "BEGIN" is the first query... so if we aren't larger than 1 then we have nothing to do
          if (connection.queries.length > 1) {
            // This does BEGIN + all other queries
            await connection.flush();

            // Commit to DB
            await connection.commit();
          }
        } catch (e) {
          // Rollback
          await connection.rollback();
          throw e;
        } finally {
          // Remove connection
          var index = this.connections.indexOf(connection);
          if (index >= 0)
            this.connections.splice(index, 1);
        }
      }

      exec(queryStr, values, _opts) {
        function queryReturnsData() {
          if (opts.retrieveData)
            return true;

          if (queryStr.match(/^\s*(?:select|PRAGMA\s+(table_info|database_info))\b/i))
            return true;

          return false;
        }

        var opts = _opts || {},
            connection = opts.connection,
            onReleaseConnection = opts.onReleaseConnection || ((connection) => connection.release());

        // If we have a connection, que the query in the connection
        if (connection && !(queryStr && queryStr.match(/^\s*select/i))) {
          connection.exec(queryStr, values);
          onReleaseConnection(connection);
          return;
        }

        // Otherwise execute the query immediately
        return new Promise((resolve, reject) => {
          try {
            var statement = this.database.prepare(queryStr),
                ret = (queryReturnsData()) ? statement.all.apply(statement, values || []) : statement.run.apply(statement, values || []);

            resolve({
              results: ret
            });
          } catch (e) {
            var error = `Error while executing SQL: [${queryStr}]: ${e}`;
            Logger.error(error);
            reject(error);
          }
        });
      }

      async execAll(queries, _opts) {
        var opts = _opts || {},
            results = [];

        for (var i = 0, il = queries.length; i < il; i++) {
          var query = queries[i];

          if (!query)
            continue;

          if (typeof query.valueOf() === 'string')
            query = { query };

          try {
            var result = await this.exec(query.query, query.values, opts);
            results.push(result);
          } catch (e) {
            if (query.required === false) {
              results.push(e);
              continue;
            }

            throw e;
          }
        }

        return results;
      }

      getDefaultDBStorageEngine() {
        return null;
      }

      getDefaultCollate() {
        return null;
      }

      getCharsetFlags() {
        return null;
      }

      getSQLSchemaColumns() {
        return SCHEMA_COLUMNS;
      }

      getSQLSchemaColumnKeys() {
        return SCHEMA_COLUMNS_KEYS;
      }

      modelClassToSQLTypeFlags(field) {
        var context = this.getContext(),
            primitiveTypeName = field.getProp('primitive', context),
            parts = [];

        if (primitiveTypeName === 'String') {
          var charsetFlags = this.getCharsetFlags();
          if (!noe(charsetFlags))
            parts.push(charsetFlags);
        }

        if (!field.getProp('nullable', context))
          parts.push('NOT NULL');

        if (field.getProp('primaryKey', context))
          parts.push('PRIMARY KEY');

        if (field.getProp('autoIncrement', context))
          parts.push('AUTOINCREMENT');

        return parts.join(' ');
      }

      generateTableCreateQuery(modelClass, _opts) {
        var primitiveType = modelClass.getModelClass().primitive();
        if (typeOf(primitiveType, 'Array'))
          return;

        var opts = _opts || {},
            query = [],
            context = this.getContext(),
            tableName = this.getTableNameFromModelName(modelClass),
            modelSchema = modelClass.getSchema(opts);

        query.push(`CREATE TABLE ${tableName} (`);
        var index = 0;

        for (var [ fieldName, field ] of modelSchema.entries({ hidden: false, virtual: false, primitive: true })) {
          if (index > 0)
            query.push(', ');

          index++;

          query.push(this.generateFieldDefinitionQuery(field));
        }
        // modelClass.iterateFields((field) => {
        //   if (opts.sqliteCreateTableField instanceof Function) {
        //     if (opts.sqliteCreateTableField.call(this, schemaEngine, tableName, modelClass, opts, query, field) === false)
        //       return;
        //   }


        // }, { context, virtual: false, primitive: true });

        query.push(')');

        return query.join('');
      }

      generateTableUpdateQueries(schemaEngine, modelClass, table, _opts) {
        var opts = _opts || {},
            { create } = opts,
            context = this.getContext(),
            queries = [],
            columns = [],
            tableName = table.name;

        //queries.push({ query: `DROP TABLE ${tableName}`, required: false });

        if (!create) {
          modelClass.iterateFields((field) => {
            var contextFieldName = field.getProp('field', context);
            columns.push(contextFieldName);
          }, { context, virtual: false, primitive: true });

          if (!columns.length)
            throw new Error('Trying to create a table but no columns are found');

          queries.push({ query: 'PRAGMA foreign_keys=off' });
          queries.push({ query: 'BEGIN TRANSACTION' });
          queries.push({ query: `ALTER TABLE ${tableName} RENAME TO _${tableName}` });
        }

        var createQuery = this.generateTableCreateQuery(schemaEngine, modelClass, table, opts);
        queries.push({ query: createQuery });

        if (!create) {
          queries.push({ query: `INSERT INTO ${tableName} (${columns.join(',')}) SELECT ${columns.join(',')} FROM _${tableName}` });
          queries.push({ query: `DROP TABLE _${tableName}` });
          queries.push({ query: 'COMMIT' });
          queries.push({ query: 'PRAGMA foreign_keys=on' });
        }

        return queries;
      }

      generateDropColumnQueries(schemaEngine, modelClass, tableName, columnName) {
        return this.generateTableUpdateQueries(schemaEngine, modelClass, tableName, {
          create: false,
          sqliteCreateTableField: (schemaEngine, tableName, modelClass, opts, query, field) => {
            var context = this.getContext();
            if (field.getProp('field') === columnName || field.getProp('field', context) === columnName)
              return false;
          }
        });
      }

      generateAddColumnQueries(schemaEngine, modelClass, tableName, field) {
        return this.generateTableUpdateQueries(schemaEngine, modelClass, tableName, {
          create: false,
          sqliteCreateTableField: (schemaEngine, tableName, modelClass, opts, query) => {
            query.splice(-1, 0, `, ${this.generateFieldDefinitionQuery(field)}`);
            return query.splice;
          }
        });
      }

      async getRawDatabaseSchema(schemaEngine, _opts) {
        try {
          var opts = _opts || {},
              rawSchema = {},
              // Get a list of all tables
              result = await this.exec("SELECT name FROM sqlite_master WHERE type='table'", undefined, opts),
              tableNames = (this.getRowsFromQueryResult(schemaEngine, result) || []).map(({ name }) => name),
              // Get columns for each table
              queries = tableNames.map((name) => {
                return { query: `PRAGMA table_info(${name})` };
              }),
              tableInfo = await this.execAll(queries, undefined, opts);

          // Iterate tables
          for (var i = 0, il = tableInfo.length; i < il; i++) {
            var infoResult = tableInfo[i],
                tableName = tableNames[i],
                // Get columns for this table
                rows = this.getRowsFromQueryResult(schemaEngine, infoResult);

            for (var j = 0, jl = rows.length; j < jl; j++) {
              var sqlLiteColumn = rows[j],
                  // Inject the "table_name" in this column, and pass it through our normal "getSchemaTypeFromRow" getter
                  row = this.getSchemaTypeFromRow({ ...(sqlLiteColumn || {}), table_name: tableName }),
                  table = rawSchema[tableName];

              if (!table)
                table = rawSchema[tableName] = {};

              table[row.column.field] = row.column;
            }
          }

          return rawSchema;
        } catch (e) {
          Logger.error(e);
        }
      }

      onShutdown() {
        return new Promise((resolve, reject) => {
          this.database.close();
          resolve();
        });
      }

      getRowsFromQueryResult(schemaEngine, result) {
        return result.results;
      }

      async writeRaw(decomposedModel, _opts) {
        var opts = _opts || {},
            { modelClass, value, primaryKey, primaryKeyFieldName } = decomposedModel.getInfo(),
            schemaEngine = modelClass.getSchemaEngine(),
            tableName = this.getTableNameFromModelName(schemaEngine, modelClass),
            columnNames = [],
            values = [],
            context = this.getContext(),
            updateOperation = false;

        if (noe(primaryKey))
          throw new Error('Model has no primary key. Aborting save!');

        //console.log('Writing to database: ', model);

        try {
          var querySQL = `SELECT ${primaryKeyFieldName} FROM ${tableName} WHERE ${primaryKeyFieldName}=${this.escape(primaryKey)}`,
              result = await this.exec(querySQL, undefined, opts),
              rows = this.getRowsFromQueryResult(schemaEngine, result);

          updateOperation = !noe(rows);
        } catch (e) {}

        modelClass.iterateFields((field, fieldName) => {
          var modelName = field.getModelName(),
              contextFieldName = field.getProp('field', context),
              val = value[fieldName];

          if (modelName === 'Date')
            val = moment(val).utc().format('YYYY-MM-DD HH:mm:ss.SSSSSS');
          else if (modelName === 'Boolean')
            val = (val) ? 1 : 0;

          if (val)
            val = `${this.escape(val)}`;
          else if (val === undefined || val === null)
            val = 'NULL';

          columnNames.push(contextFieldName);
          values.push(val);
        }, { context, virtual: false, primitive: true });

        if (updateOperation)
          var query = `UPDATE ${tableName} SET ${values.map((v, i) => `\`${columnNames[i]}\`=${v}`).join(',')} WHERE ${primaryKeyFieldName}=${this.escape(primaryKey)}`;
        else
          var query = `INSERT INTO ${tableName} (${columnNames.join(',')}) VALUES (${values.join(',')})`;

        try {
          await this.exec(query, undefined, _opts);
        } catch (e) {
          Logger.error(e);
          return e;
        }
      }
    };
  }, BaseSQLConnector);

  root.export({
    SQLiteConnector
  });
};
