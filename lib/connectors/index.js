import { error } from "util";

module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf } = requireModule('./utils');
  const BaseConnector = requireModule('./connectors/base-connector');
  const MemoryConnector = requireModule('./connectors/memory-connector');
  const QueryUtils = requireModule('./connectors/query-utils');
  const Logger = requireModule('./logger');

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

    validateSchema(schema) {
      if (!schema)
        return;

      var connectors = this.connectors,
          promises = [];

      for (var i = 0, il = connectors.length; i < il; i++) {
        promises.push((async (connector) => {
          var errors = [],
              warnings = [],
              stale = false;

          try {
            await connector.validateSchema(schema, {
              stale: (set = true) => { stale = set; },
              error: (...args) => { errors = errors.concat(args); },
              warn: (...args) => { warnings = warnings.concat(args); }
            });
          } catch (e) {
            errors.push(e.message);
          }

          return {
            connector,
            valid: (!errors.length && !stale),
            stale,
            errors,
            warnings
          };
        })(connectors[i]));
      }

      return Promise.all(promises);
    }

    register(connector) {
      if (!connector || !(connector instanceof BaseConnector.BaseConnector)) {
        debugger;
        throw new Error(`Attempt to register invalid connector: ${connector}`);
      }

      if (this.connectors.length === 0)
        connector.primary = true;
        
      this.connectors.push(connector);
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
          if (connector[key] != filter[key])
            return false;
        }

        return true;
      }

      var filterKeys = Object.keys(filter),
          filterKeysSize = filterKeys.length;

      return connectors.filter((connector) => filterItem(connector));
    }
  }

  Object.assign(root, BaseConnector, MemoryConnector, {
    QueryUtils,
    ConnectorEngine
  });
};
