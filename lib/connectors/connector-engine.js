module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf, instanceOf } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const BaseConnector = requireModule('./connectors/base-connector');
  const SQLiteConnector = requireModule('./connectors/sqlite-connector');
  const Logger = requireModule('./base/logger');
  const { Context } = requireModule('./base/context');

  // const { SchemaEngine } = requireModule('./schema');
  // const { SchemaValidationReport } = requireModule('./schema/schema-validation-report');

  const ConnectorEngine = this.defineClass((EngineBase) => {
    return class ConnectorEngine extends EngineBase {
      static name() {
        return 'connector';
      }

      static configKeyName() {
        return 'connectors';
      }

      constructor(_opts) {
        super(_opts);

        var opts = _opts || {},
            connectors = (opts.connectors) ? opts.connectors.slice() : [];

        definePropertyRW(this, 'connectors', connectors);
      }

      getContext(...args) {
        return new Context({ name: 'connector', group: 'engine' }, ...args);
      }

      async stop() {
        Logger.debug('Shutting down all connectors!');

        var connectors = this.connectors,
            promises = [];

        for (var i = 0, il = connectors.length; i < il; i++) {
          promises.push((async (connector) => {
            try {
              await connector.onShutdown();
            } catch (e) {
              Logger.error(e);
            }
          })(connectors[i]));
        }
      }

      async start() {
      }

      // async validateConnectorSchema(schemaEngine, connector) {
      //   try {
      //     var rawDatabaseSchema = await connector.getSchema();
      //     if (!rawDatabaseSchema)
      //       return;

      //     if (!(rawDatabaseSchema instanceof SchemaEngine))
      //       rawDatabaseSchema = await schemaEngine.buildSchemaEngineFromRawSchema(rawDatabaseSchema);

      //     return SchemaValidationReport.fromDatabaseSchema(connector, schemaEngine, rawDatabaseSchema);
      //   } catch (e) {
      //     Logger.error(e);
      //   }
      // }

      // validateSchema(schemaEngine) {
      //   if (!schemaEngine)
      //     return;

      //   var connectors = this.connectors,
      //       promises = [];

      //   for (var i = 0, il = connectors.length; i < il; i++)
      //     promises.push(this.validateConnectorSchema(schemaEngine, connectors[i]));

      //   return Promise.all(promises);
      // }

      register(connector) {
        if (!connector || !(connector instanceof BaseConnector.BaseConnector))
          throw new Error(`Attempt to register invalid connector: ${connector}`);

        if (this.connectors.length === 0)
          connector.primary = true;

        this.connectors.push(connector);
      }

      getConnectors(filter) {
        var connectors = this.connectors;

        if (!sizeOf(filter))
          return connectors;

        return this.sortConnectorsByMatchPercent(connectors, filter);
      }

      getConnector(filter = { readable: true, writable: true, primary: true }) {
        return this.getConnectors(filter)[0];
      }

      sortConnectorsByMatchPercent(connectors, _filter) {
        function weightMatch(connector) {
          var weight = 0;

          for (var i = 0; i < filterKeysSize; i++) {
            var key = filterKeys[i];
            if (connector[key] == filter[key])
              weight++;
          }

          return { weight, connector };
        }

        var filter = (instanceOf(_filter, 'string')) ? { context: _filter } : _filter,
            filterKeys = Object.keys(filter),
            filterKeysSize = filterKeys.length;

        return connectors.map(weightMatch).sort((a, b) => {
          var x = a.weight,
              y = b.weight;

          return (x == y) ? 0 : (x < y) ? 1 : -1;
        }).map((elem) => elem.connector);
      }
    };
  }, EngineBase);

  root.export(BaseConnector, SQLiteConnector, {
    ConnectorEngine
  });
};
