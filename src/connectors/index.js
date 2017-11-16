import { definePropertyRW } from '../utils';
import * as BaseConnector from './base-connector';
import * as MemoryConnector from './memory-connector';

(function(root) {
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
})(module.exports);