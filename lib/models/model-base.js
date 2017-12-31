module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe } = requireModule('./utils');
  const Logger = requireModule('./logger');

  function defineModelField(field, fieldName) {
    Object.defineProperty(this, fieldName, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: field.getProp('value')
    });
  }

  class ModelBase {
    constructor(...args) {
      definePropertyRW(this, '_rolesCache', null);

      //console.trace();
      this.schema().iterateFields(defineModelField.bind(this));

      if (this.onCreate instanceof Function)
        this.onCreate.call(this, ...args);
    }

    schema(...args) {
      return this.constructor.schema(...args);
    }

    getRoles() {
      return (this.roles || []);
    }

    getRole(roleName) {
      return this.getRoles().filter((name) => (name === roleName))[0];
    }

    hasRole(roleName) {
      return !!this.getRole(roleName);
    }

    // Calculate how far target is from owner
    // 0 = has no relation to owner
    // 1 = is owner
    // >1 = decedent of owner (2 = immediate child, 3 = grandchild, etc...)

    calculateOwnerGeneration(target) {
      function ownerLevel(model, level = 1) {
        if (model.schema().getTypeName() === typeName && model.id === myID)
          return level;

        if (!model.owner)
          return 0;

        return ownerLevel(model.owner, level + 1);
      }

      if (noe(target) || !(target instanceof ModelBase))
        return 0;

      var myID = this.id,
          typeName = this.schema().getTypeName();

      return ownerLevel(target);
    }

    onCreate(_fieldValues, _opts) {
      var opts = _opts || {},
          fieldValues = _fieldValues || {},
          modelType = this.schema(),
          typeInfo = modelType.getTypeInfo(),
          isPrimitive = (!!typeInfo.primitiveType),
          ownerFieldName = modelType.getOwnerFieldName();

      try {
        if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
          fieldValues = JSON.parse(fieldValues);

        if (!noe(ownerFieldName) && opts.owner)
          definePropertyRW(this, ownerFieldName, opts.owner);

        modelType.iterateFields((field, fieldName) => {
          var setter = field.getProp('setter'),
              fieldValue = fieldValues[fieldName],
              val = setter.call(field, fieldValue, { owner: this });

          this[fieldName] = field.instantiate(val, { owner: this });
        });
      } catch (e) {
        Logger.warn(`Unable to create new model: ${e.message}`, e, fieldValues);
      }
    }

    decompose(opts) {
      return this.schema().decompose(this, { owner: this, ...opts });
    }

    validate(opts) {
      return this.schema().validate(this, { owner: this, ...opts });
    }

    save(_opts) {
      var application = this.getApplication();
      return application.save(this, _opts);
    }

    where(...args) {
      return this.query(...args);
    }

    query(_opts) {
      var application = this.getApplication();
      return application.query(this.schema(), _opts);
    }

    getPermissionLevel(target) {
      return this.getApplication().getPermissionEngine().getPermissionLevel(this, target);
    }
  }

  Object.assign(root, {
    ModelBase
  });
};
