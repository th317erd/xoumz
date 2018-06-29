module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./base/utils');

  class Migration {
    constructor(_opts) {
      var opts = _opts || {};
      definePropertyRW(this, 'application', opts.application);
      definePropertyRW(this, '_queue', []);
    }

    async run() {
      throw new Error("Migration doesn't implement a run method");
    }

    queue(...args) {
      this._queue = this._queue.concat(args);
    }

    async finalize() {
      var queue = this._queue;
      if (!queue || queue.length === 0)
        return;

      return await Promise.all(queue);
    }

    getApplication() {
      return this.application;
    }

    getSchemaEngine(...args) {
      return this.getApplication().getSchemaEngine(...args);
    }

    getConnectorEngine(...args) {
      return this.getApplication().getConnectorEngine(...args);
    }

    getMigrationEngine(...args) {
      return this.getApplication().getMigrationEngine(...args);
    }

    getSchemaType(modelName) {
      var schemaEngine = this.getSchemaEngine();
      return schemaEngine.getSchemaType(modelName);
    }

    getModelName(...args) {
      return this.getApplication().getModelName(...args);
    }

    getConnectors(filter) {
      var connectorEngine = this.getConnectorEngine();
      return connectorEngine.getConnectors(filter);
    }

    getConnector(filter) {
      var connectorEngine = this.getConnectorEngine();
      return connectorEngine.getConnectors(filter)[0];
    }
  }

  root.export({
    Migration
  });
};

//table / bucket
