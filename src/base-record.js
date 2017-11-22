module.exports = function(root, requireModule) {
  const { definePropertyRW, noe } = requireModule('./utils');
  const Logger = requireModule('./logger');

  function defineModelField(field, fieldName) {
    Object.defineProperty(this, fieldName, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: field.getProp('value')
    });
  }

  class BaseRecord {
    constructor(schema, ...args) {
      schema.iterateFields(defineModelField.bind(this));

      if (this.onCreate instanceof Function)
        this.onCreate.call(this, ...args);
    }

    schema(...args) {
      return this.constructor.schema(...args);
    }

    onCreate(_fieldValues) {
      var fieldValues = _fieldValues;
      if (noe(fieldValues))
        return;

      try {
        if (typeof fieldValues === 'string' || fieldValues instanceof String)
          fieldValues = JSON.parse(fieldValues);

        var app = this.getApplication();

        this.schema().iterateFields((field, fieldName) => {
          var val = fieldValues[fieldName];
          this[fieldName] = field.instantiate(val);
        });
      } catch (e) {
        Logger.warn(`Unable to create new model: ${e.message}`, e);
      }
    }

    save(_opts) {
      var application = this.getApplication();
      return application.saveType(this.schema(), this, _opts);
    }

    where(params, _opts) {
      var application = this.getApplication();
      return application.loadType(this.schema(), params, _opts);
    }
  }

  Object.assign(root, {
    BaseRecord
  });
};
