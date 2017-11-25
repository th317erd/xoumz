module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');

  class BaseConnector {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, 'context', undefined, () => this.options.context, (val) => this.options.context = val);
      definePropertyRW(this, 'readable', undefined, () => this.options.read, (val) => this.options.read = val);
      definePropertyRW(this, 'writable', undefined, () => this.options.write, (val) => this.options.write = val);
      definePropertyRW(this, 'primary', undefined, () => this.options.primary, (val) => this.options.primary = val);
    }

    introspectModelType(schema, params, opts) {
      throw new Error(`Connector [${this.context}] doesn't support introspection`);
    }

    async query(schema, params, opts) {
      throw new Error(`Connector [${this.context}] doesn't support queries`);
    }

    async write(schema, params, opts) {
      throw new Error(`Connector [${this.context}] doesn't support writing`);
    }
  }

  Object.assign(root, {
    BaseConnector
  });
};
