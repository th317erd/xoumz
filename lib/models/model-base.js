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

    getRolesAsHash() {
      if (_rolesCache)
        return _rolesCache;

      this._rolesCache = this.getRoles().reduce((obj, role) => {
        obj[role.name] = role;
      }, {});

      return this._rolesCache;
    }

    getRoles() {
      return (this.roles || []);
    }

    getRole(name) {
      return this.getRoles().filter((role) => (role.name === name))[0];
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

    onCreate(_fieldValues) {
      var fieldValues = _fieldValues || {},
          typeInfo = this.schema().getTypeInfo(),
          isPrimitive = (!!typeInfo.primitiveType);

      try {
        if (!isPrimitive && (typeof fieldValues === 'string' || fieldValues instanceof String))
          fieldValues = JSON.parse(fieldValues);

        this.schema().iterateFields((field, fieldName) => {
          var setter = field.getProp('setter'),
              fieldValue = fieldValues[fieldName],
              val = setter.call(field, fieldValue, { owner: this });

          this[fieldName] = field.instantiate(val);
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
  }

  Object.assign(root, {
    ModelBase
  });
};
