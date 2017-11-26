module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf } = requireModule('./utils');
  const BaseConnector = requireModule('./connectors/base-connector');
  const MemoryConnector = requireModule('./connectors/memory-connector');

  class ConnectorCollection {
    constructor() {
      definePropertyRW(this, 'connectors', []);
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
    ConnectorCollection
  });
};
