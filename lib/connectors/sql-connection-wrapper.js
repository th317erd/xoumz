module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./base/utils');
  const { SQLTransaction } = requireModule('./connectors/sql-transaction');
  const { Context } = requireModule('./base/context');

  const SQLConnectionWrapper = this.defineClass((ParentClass) => {
    return class SQLConnectionWrapper extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = Object.assign({}, _opts || {});
        if (!opts.driverConnection)
          throw new Error('"driverConnection" required to instantiate a SQLConnectionWrapper');

        if (!opts.connector)
          throw new Error('"connector" required to instantiate a SQLConnectionWrapper');

        definePropertyRO(this, '_options', opts);

        definePropertyRO(this, '_driverConnection', undefined, () => this._options.driverConnection, (connection) => {
          this._options.driverConnection = connection;
          return connection;
        });

        definePropertyRO(this, '_connector', undefined, () => this._options.connector, (connector) => {
          this._options.connector = connector;
          return connector;
        });
      }

      getContext(...args) {
        return new Context({ name: 'sql', group: 'connection' }, ...args);
      }

      async release() {
        var release = this._driverConnection.release;
        if (typeof release === 'function')
          release.call(this._driverConnection);
      }

      async transaction(cb, _opts) {
        if (typeof cb !== 'function')
          throw new Error('Transaction method called without a callback');

        var opts = this.getContext({ connection: this }, _opts),
            onCreateTransaction = opts.onCreateTransaction;

        if (typeof onCreateTransaction !== 'function')
          onCreateTransaction = (opts) => new SQLTransaction(opts);

        try {
          var transaction = await onCreateTransaction.call(this, opts);
          await cb.call(transaction, this, opts);
          var results = await transaction.flush();
          await transaction.commit();
          return results;
        } catch (e) {
          if (transaction)
            await transaction.rollback(e);

          throw new Error(`"transaction" failed with error: ${e}`);
        } finally {
          if (transaction)
            await transaction.finalize();
        }
      }

      exec(statements, _opts) {
        var opts = this.getContext(_opts);
        return this._connector.exec(this, statements, opts);
      }
    };
  });

  root.export({
    SQLConnectionWrapper
  });
};
