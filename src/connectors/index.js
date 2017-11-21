module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const BaseConnector = requireModule('./connectors/base-connector');
  const MemoryConnector = requireModule('./connectors/memory-connector');

  class ConnectorCollection {
    constructor() {
      definePropertyRW(this, 'connectors', []);
    }

    register(connector) {
      if (!connector || !(connector instanceof BaseConnector.BaseConnector))
        throw new Error('Attempt to register invalid connector');

      this.connectors.push(connector);
    }
  }

  Object.assign(root, BaseConnector, MemoryConnector, {
    ConnectorCollection
  });
};
