const Database = require('better-sqlite3'),
      moment = require('moment');

module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, typeOf, instanceOf } = requireModule('./base/utils');
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
        definePropertyRW(this, '_rawSchemaCache', null);
      }

      getContext(...args) {
        return new Context({ name: 'sqlite', group: 'connector' }, ...args);
      }

      async getDriverConnection() {
        return this;
      }

      query(connection, statement, _opts) {
        function queryReturnsData(queryStr) {
          if (queryStr.match(/^\s*(?:select|PRAGMA\s+(table_info|database_info))\b/i))
            return true;

          return false;
        }

        return new Promise((resolve, reject) => {
          try {
            var queryStr = statement.query,
                dbQuery = this.database.prepare(queryStr),
                ret = (queryReturnsData(queryStr)) ? dbQuery.all.apply(dbQuery, statement.values || []) : dbQuery.run.apply(dbQuery, statement.values || []);

            resolve(ret);
          } catch (e) {
            var error = `Error while executing SQL: [${queryStr}]: ${e}`;
            Logger.debug(error);
            reject(e);
          }
        });
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

      async generateTableCreateQueries(modelClass, _opts) {
        var primitiveType = modelClass.getModelClass().primitive();
        if (typeOf(primitiveType, 'Array'))
          return;

        var opts = this.getContext(_opts),
            query = [],
            tableName = this.getTableNameFromModelName(modelClass),
            modelSchema = modelClass.getSchema(opts),
            fieldFilter = opts.fieldFilter,
            modifyQuery = opts.modifyQuery;

        if (typeof fieldFilter !== 'function')
          fieldFilter = () => true;

        if (typeof modifyQuery !== 'function')
          modifyQuery = (query) => query;

        query.push(`CREATE TABLE ${tableName} (`);
        var index = 0;

        for (var field of modelSchema.values({ real: true })) {
          if (!fieldFilter.call(this, field, opts, query, modelClass, tableName, modelSchema))
            continue;

          if (index > 0)
            query.push(', ');

          index++;

          query.push(this.generateFieldDefinitionQuery(field));
        }

        query.push(')');

        // Possibly modify the query
        query = modifyQuery.call(this, query, opts, modelClass, tableName, modelSchema);

        return [{ query: query.join('') }];
      }

      async generateTableUpdateQueries(modelClass, _opts) {
        var opts = this.getContext(_opts),
            queries = [],
            columns = [],
            tableName = this.getTableNameFromModelName(modelClass),
            modelSchema = modelClass.getSchema(opts),
            create;

        if (!opts.hasOwnProperty('create')) {
          var schemaEngine = this.getEngine('schema', opts),
              rawTableSchema = await this.getRawDatabaseSchema(schemaEngine, opts);

          create = !rawTableSchema.hasOwnProperty(tableName);
        } else {
          create = opts.create;
        }

        //queries.push({ query: `DROP TABLE ${tableName}`, required: false });

        if (!create) {
          for (var field of modelSchema.values({ real: true }))
            columns.push(field.getProp('field', opts));

          if (!columns.length)
            throw new Error('Trying to create a table but no columns are found');

          queries.push({ query: 'PRAGMA foreign_keys=off', discardResponse: true });
          queries.push({ query: 'BEGIN TRANSACTION', discardResponse: true });
          queries.push({ query: `ALTER TABLE ${tableName} RENAME TO _${tableName}`, discardResponse: true });
        }

        var createQueries = await this.generateTableCreateQueries(modelClass, opts);
        queries = queries.concat(createQueries);

        if (!create) {
          queries.push({ query: `INSERT INTO ${tableName} (${columns.join(',')}) SELECT ${columns.join(',')} FROM _${tableName}`, discardResponse: true });
          queries.push({ query: `DROP TABLE _${tableName}`, discardResponse: true });
          queries.push({ query: 'COMMIT', discardResponse: true });
          queries.push({ query: 'PRAGMA foreign_keys=on', discardResponse: true });
        }

        return queries;
      }

      async generateDropColumnQueries(modelClass, field, tableName, columnName, opts) {
        return await this.generateTableUpdateQueries(modelClass, this.getContext(opts, {
          create: false,
          fieldFilter: (field, opts) => {
            if (field.getProp('field') === columnName || field.getProp('field', opts) === columnName)
              return false;

            return true;
          }
        }));
      }

      async generateAddColumnQueries(modelClass, field, tableName, columnName, opts) {
        return await this.generateTableUpdateQueries(modelClass, this.getContext(opts, {
          create: false,
          modifyQuery: (query, opts) => {
            query.pop();

            if (query.length > 1)
              query.push(', ');

            query.push(this.generateFieldDefinitionQuery(field, opts));
            query.push(')');

            return query;
          }
        }));
      }

      async getRawDatabaseSchema(schemaEngine, _opts) {
        try {
          var opts = this.getContext(_opts);
          if (this._rawSchemaCache && opts.force !== true)
            return this._rawSchemaCache;

          var rawSchema = {},
              { tableInfo, tableNames } = await this.getConnection(async function(connector) {
                    // Get a list of all tables
                var result = await this.exec("SELECT name FROM sqlite_master WHERE type='table'", opts),
                    // Get columns for each table
                    tableNames = (connector.getRowsFromQueryResult(result) || []).map(({ name }) => name),
                    queries = tableNames.map((name) => {
                      return { query: `PRAGMA table_info(${name})` };
                    }),
                    tableInfo = await this.exec(queries, opts);

                return { tableInfo, tableNames };
              });

          // Iterate tables
          for (var i = 0, il = tableInfo.length; i < il; i++) {
            var infoResult = tableInfo[i],
                tableName = tableNames[i],
                // Get columns for this table
                rows = this.getRowsFromQueryResult(infoResult);

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

          this._rawSchemaCache = rawSchema;
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

      getRowsFromQueryResult(result) {
        return result;
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
              rows = this.getRowsFromQueryResult(result);

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
