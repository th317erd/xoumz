module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf, setProp } = requireModule('./utils');
  const BaseConnector = requireModule('./connectors/base-connector');
  const MemoryConnector = requireModule('./connectors/memory-connector');
  const QueryUtils = requireModule('./connectors/query-utils');
  const Logger = requireModule('./logger');
  const { SchemaEngine } = requireModule('./schema');

  class ConnectorEngine {
    constructor() {
      definePropertyRW(this, 'connectors', []);
    }

    async onShutdown() {
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

    async onInit() {
    }

    validateDatabaseSchema(connector, schemeEngine, databaseSchemaEngine) {
      var report = {};

      schemeEngine.compareTo(databaseSchemaEngine, (what, type, name, native, foreign, nativeParent, foreignParent) => {
        if (type === 'field') {
          var targetTypeNames = native.getTargetTypeName(),
              isSpecial = (targetTypeNames instanceof Array);
          
          if (isSpecial)
            return false;

          if (native.getProp('virtual'))
            return false;
        }

        if (type === 'model')
          return;

        if (what === 'extra')
          return false;

        var modelType = (type === 'field') ? nativeParent : nativeParent.getModelType();
        if (!modelType)
          return;

        var modelTypeName = modelType.getTypeName(),
            field = (type === 'field') ? native : nativeParent,
            fieldName = field.getProp('field', connector.getContext());

        if (fieldName.charAt(0) === '_')
          return false;

        if (type === 'prop') {
          setProp(report, `${modelTypeName}.${fieldName}.value.${name}`, {
            action: what,
            value: native
          });
        } else {
          setProp(report, `${modelTypeName}.${fieldName}.action`, what);
          if (what === 'missing')
            setProp(report, `${modelTypeName}.${fieldName}.value`, native);
        }
      });

      Logger.debug('Report: ', report);
      return report;
      // var keys = Object.keys(rawDatabaseSchema);
      // for (var i = 0, il = keys.length; i < il; i++) {
      //   var key = keys[i];
      // }
    }

    validateSchema(schemeEngine) {
      if (!schemeEngine)
        return;

      var connectors = this.connectors,
          promises = [];

      for (var i = 0, il = connectors.length; i < il; i++) {
        promises.push((async (connector) => {
          try {
            var rawDatabaseSchema = await connector.getSchema();
            if (!rawDatabaseSchema)
              return;

            if (!(rawDatabaseSchema instanceof SchemaEngine))
              rawDatabaseSchema = await schemeEngine.schemaEngineFromRawSchema(rawDatabaseSchema);

            return this.validateDatabaseSchema(connector, schemeEngine, rawDatabaseSchema);
          } catch (e) {
            Logger.error(e);
          }
        })(connectors[i]));
      }

      return Promise.all(promises);
    }

    register(connector) {
      if (!connector || !(connector instanceof BaseConnector.BaseConnector))
        throw new Error(`Attempt to register invalid connector: ${connector}`);

      if (this.connectors.length === 0)
        connector.primary = true;
        
      this.connectors.push(this.getApplication().injectApplicationHelpers(connector));
    }

    getConnectors(filter) {
      var connectors = this.connectors;
      if (!sizeOf(filter))
        return connectors;
      
      return this.filterConnectors(connectors, filter);
    }

    getConnector(filter) {
      return this.getConnectors(filter)[0];
    }

    filterConnectors(connectors, filter) {
      function filterItem(connector) {
        for (var i = 0; i < filterKeysSize; i++) {
          var key = filterKeys[i];
          if (connector[key] !== filter[key])
            return false;
        }

        return true;
      }

      var filterKeys = Object.keys(filter),
          filterKeysSize = filterKeys.length;

      return connectors.filter((connector) => filterItem(connector));
    }

    iterateConnectors(cb) {
      var connectors = this.connectors,
          rets = [],
          abort = () => abort;

      for (var i = 0, il = connectors.length; i < il; i++) {
        var connector = connectors[i],
            ret = cb.call(this, connector, abort);

        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }
  }

  Object.assign(root, BaseConnector, MemoryConnector, {
    QueryUtils,
    ConnectorEngine
  });
};
