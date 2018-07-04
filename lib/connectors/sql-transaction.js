module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW } = requireModule('./base/utils');
  const { Context } = requireModule('./base/context');

  // WIP: Finish SQLConnectionWrapper

  const SQLTransaction = this.defineClass((ParentClass) => {
    return class SQLTransaction extends ParentClass {
      constructor(_opts) {
        super(_opts);

        var opts = Object.assign({}, _opts || {});
        if (!opts.connection)
          throw new Error('"connection" required to instantiate a SQLTransaction');

        definePropertyRO(this, '_options', opts);

        definePropertyRO(this, '_connection', undefined, () => this._options.connection, (connection) => {
          this._options.connection = connection;
          return connection;
        });

        definePropertyRW(this, '_statements', []);
      }

      getContext(...args) {
        return new Context({ name: 'sql', group: 'transaction', isTransaction: true }, ...args);
      }

      async rollback() {
        return await this._connection.exec({ query: 'ROLLBACK', que: false, required: true });
      }

      async commit() {
        return await this._connection.exec({ query: 'COMMIT', que: false, required: true });
      }

      async finalize() {

      }

      async flush(_opts) {
        var opts = this.getContext(_opts);
        return await this._connection.exec(this._statements, opts);
      }

      exec(_statements) {
        var statements = (_statements instanceof Array) ? _statements : [_statements];
        this._statements = this._statements.concat(statements);
      }
    };
  });

  root.export({
    SQLTransaction
  });
};
