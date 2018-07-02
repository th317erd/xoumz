module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, typeOf, instanceOf } = requireModule('./base/utils');
  const { Context } = requireModule('./base/context');

  // WIP: Finish SQLConnectionWrapper

// Connections for the SQLite syncrounous DB are really just query groups
  const SQLConnectionWrapper = this.defineClass((ParentClass) => {
    return class SQLiteConnection extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = Object.assign({}, _opts || {});
        if (!opts.driverConnection)
          throw new Error('"driverConnection" required to instantiate a SQLConnectionWrapper');

        definePropertyRO(this, '_options', opts);

        definePropertyRO(this, '_driverConnection', undefined, () => this._options.driverConnection, (connection) => {
          this._options.driverConnection = connection;
          return connection;
        });

        definePropertyRW(this, '_queries', []);
      }

      getContext(...args) {
        return new Context({ name: 'sql', group: 'connection' }, ...args);
      }

      async beginTransaction() {
        return await (new Promise((resolve, reject) => {
          this.beginTransaction(async function(err) {
            if (err) {
              reject(err);
              return;
            }

            // Tell other operations not to release the connection with a NOOP onReleaseConnection
            resolve({ connection, onReleaseConnection: () => {} });
          });
        }));
      }

      async endTransaction(err, { connection }) {
        return new Promise((resolve, reject) => {
          function handleError(err) {
            connection.rollback(function() {
              reject(err);

              // Finally release the connection
              connection.release();
            });
          }

          if (err)
            return handleError(err);

          connection.commit(function(err) {
            if (err)
              return handleError(err);

            resolve();
          });

          // Finally release the connection
          connection.release();
        });
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
        this.queries = this.flattenQueries(queries);
      }
    };
  });

  root.export({
    SQLConnectionWrapper
  });
};
