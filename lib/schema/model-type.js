module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf, noe, uuid, calcStringWeight } = requireModule('./utils');
  const { SchemaType } = requireModule('./schema/schema-type');
  const Logger = requireModule('./logger');

  const FLAGS = {
    HIDDEN: 0x01,
    PRIMITIVE: 0x02,
    VIRTUAL: 0x04,
    COMPLEX: 0x08
  };

  class ModelType {
    constructor(_opts) {
      var opts = _opts || {};
      definePropertyRW(this, 'options', opts);
    }

    initialize(schemaEngine, typeInfo, schemaTypes, schemaObj) {
      if (!schemaEngine || !typeInfo || !schemaObj || !schemaTypes)
        throw new Error('Parent schema, Type info, schema, and schema types definition are required to initialize ModelType class');

      var finalSchema = {},
          isArray = (schemaObj instanceof Array),
          typeName = typeInfo.typeName,
          schemaCode,
          fieldSchema;

      if (!schemaObj || !(isArray || schemaObj instanceof Object) || !sizeOf(schemaObj))
        throw new Error('Schema must be an array or enumerable object');

      var locked = false;
      definePropertyRW(this, '_parentSchema', schemaEngine);
      definePropertyRW(this, '_typeInfo', typeInfo);
      definePropertyRW(this, '_schemaTypes', schemaTypes);
      definePropertyRW(this, '_schema', finalSchema);
      definePropertyRW(this, '_cachedFieldNames', null);
      definePropertyRW(this, '_lock', undefined, () => locked, () => {
        if (!locked)
          locked = true;
        return locked;
      });

      this.setTypeName(typeName);

      var keys = Object.keys(schemaObj),
          hasPrimaryKey = false;

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];

        fieldSchema = schemaObj[key];

        if (!fieldSchema || !(fieldSchema instanceof SchemaType))
          throw new Error(`Schema field ${key} must inherit from SchemaType`);

        if (!isArray && !fieldSchema.getProp('field'))
          fieldSchema.setProp('field', key, '*');

        fieldSchema.validateSchema();

        if (fieldSchema.getProp('primaryKey')) {
          hasPrimaryKey = true;
          finalSchema['_primaryKeyField'] = fieldSchema;
        }

        var currentField = fieldSchema.getProp('field', '*');
        if (noe(currentField))
          throw new Error(`Schema field ${key} does not specify a "field" on the root context`);

        if (currentField === '_schemaCode')
          schemaCode = fieldSchema.getProp('value', '*');

        // Don't allow any more changes to this field
        fieldSchema.lock();
        finalSchema[currentField] = fieldSchema;
      }

      if (noe(schemaCode)) {
        schemaCode = this.getDefaultSchemaCode(typeName);
        fieldSchema = this.getDefaultSchemaCodeField(schemaCode);
        finalSchema['_schemaCode'] = fieldSchema;
        fieldSchema.lock();
      }

      if (!hasPrimaryKey) {
        fieldSchema = this.getDefaultPrimaryKeyField(schemaCode);
        finalSchema['id'] = fieldSchema;
        fieldSchema.lock();

        finalSchema['_primaryKeyField'] = fieldSchema;
      }

      if (!finalSchema.hasOwnProperty('createdAt')) {
        fieldSchema = this.getDefaultCreatedAtField();
        finalSchema['createdAt'] = fieldSchema;
        fieldSchema.lock();
      }

      if (!finalSchema.hasOwnProperty('updatedAt')) {
        fieldSchema = this.getDefaultUpdatedAtField();
        finalSchema['updatedAt'] = fieldSchema;
        fieldSchema.lock();
      }
    }

    lock() {
      this._lock = true;
    }

    getTypeName() {
      return this._typeName;
    }

    setTypeName(typeName) {
      definePropertyRW(this, '_typeName', typeName);
    }

    getTypeInfo() {
      return this._typeInfo;
    }

    getRawSchema() {
      return this._schema;
    }

    getSchemaTypes() {
      return this._schemaTypes;
    }

    getSchemaType() {
      return new this._typeInfo.schemaTypeClass(this._parentSchema, this);
    }

    getSchemaEngine() {
      return this._parentSchema;
    }

    getModelType() {
      return this._typeInfo.modelType;
    }

    decompose(...args) {
      return this.getSchemaType().decompose(...args);
    }

    decomposeAsModel(...args) {
      return this.getSchemaType().decomposeAsModel(...args);
    }

    validate(...args) {
      return this.getSchemaType().validate(...args);
    }

    instantiate(...args) {
      return this.getSchemaType().instantiate(...args);
    }

    getDefaultSchemaCode(typeName) {
      return typeName;
    }

    getDefaultSchemaCodeField(schemaCode) {
      return this.getSchemaTypes().String.value(schemaCode).field('_schemaCode');
    }

    getDefaultPrimaryKeyField(schemaCode) {
      var maxLength = (schemaCode + ':' + uuid()).length;
      return this.getSchemaTypes().String.primaryKey.setter((val) => {
        return (noe(val)) ? (schemaCode + ':' + uuid()) : val;
      }).field('id').notNull.required.max(maxLength);
    }

    getDefaultCreatedAtField() {
      return this.getSchemaTypes().Date.field('createdAt');
    }

    getDefaultUpdatedAtField() {
      return this.getSchemaTypes().Date.field('updatedAt');
    }

    calcFieldPriority(fieldName) {
      var field = this.getField(fieldName);
      if (!field)
        return 1024;

      var weight = calcStringWeight(fieldName.toLowerCase());
      if (field.getProp('virtual'))
        weight += 255;

      if (field.getProp('primaryKey'))
        weight -= 255;

      return weight;
    }

    sortFieldNames(fieldNames) {
      return fieldNames.sort((a, b) => {
        var x = this.calcFieldPriority(a),
            y = this.calcFieldPriority(b);

        return (x == y) ? 0 : (x < y) ? -1 : 1;
      });
    }

    getFieldNames() {
      if (this._cachedFieldNames)
        return this._cachedFieldNames;

      var schemaObj = this._schema,
          keys = this.sortFieldNames(Object.keys(schemaObj));

      this._cachedFieldNames = keys;
      return keys;
    }

    iterateFields(cb, _opts) {
      function isComplex(schemaEngine, field) {
        var targetTypeName = field.getTargetTypeName();
        if (targetTypeName instanceof Array)
          return true;

        return false;
      }

      function isPrimitiveType(schemaEngine, field) {
        var targetTypeName = field.getTargetTypeName();
        if (targetTypeName instanceof Array)
          return false;

        var typeInfo = schemaEngine.getTypeInfo(targetTypeName);
        if (typeInfo.primitiveType)
          return true;

        return false;
      }

      var opts = _opts || {},
          schemaEngine = this.getSchemaEngine(),
          schemaObj = this._schema,
          fieldNames = this.getFieldNames(),
          rets = [],
          abort = () => abort;

      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            fieldSchema = schemaObj[fieldName],
            flags = 0;

        if (fieldName.charAt(0) === '_') {
          flags |= FLAGS.HIDDEN;
          if (opts.hidden !== true)
            continue;
        }

        if (fieldSchema.getProp('virtual', opts.context)) {
          flags |= FLAGS.VIRTUAL;
          if (opts.virtual === false)
            continue;
        }

        if (isPrimitiveType(schemaEngine, fieldSchema)) {
          flags |= FLAGS.PRIMITIVE;
          if (opts.primitive === false)
            continue;
        } else if (opts.model === false) {
          continue;
        }

        if (isComplex(schemaEngine, fieldSchema)) {
          flags |= FLAGS.COMPLEX;
          if (opts.complex === false)
            continue;
        }

        var ret = cb.call(this, fieldSchema, fieldName, i, flags, abort);
        if (ret === abort)
          break;

        rets.push(ret);
      }

      return rets;
    }

    getChildTypeNames(_opts) {
      var opts = _opts || {},
          modelTypeNames = {};

      this.iterateFields((field, fieldName, index, flags) => {
        var typeNames,
            thisTypeName = field.getTypeName();

        if (opts.target) {
          typeNames = field.getTargetTypeName();
          if (typeNames === thisTypeName)
            return;

          if (!(typeNames instanceof String))
            typeNames = [typeNames];
        } else {
          typeNames = [thisTypeName];
        }

        for (var i = 0, il = typeNames.length; i < il; i++) {
          var typeName = typeNames[i];
          if (typeName)
            modelTypeNames[typeName] = true;
        }
      }, opts);

      return Object.keys(modelTypeNames);
    }

    addField(field) {
      if (!field)
        return;

      if (this._lock)
        throw new Error('Can not modify schema when it is locked');

      var fieldName = field.getProp('field');
      if (this.getField(fieldName))
        throw new Error(`Can not add schema field ${fieldName} because it already exists in ${this.getTypeName()} schema`);

      this._schema[fieldName] = field;
      this._cachedFieldNames = null;
      field.lock();

      return field;
    }

    getField(fieldName, context) {
      if (fieldName instanceof SchemaType)
        return fieldName;

      var schemaObj = this._schema;
      if (context) {
        var fieldNames = this.getFieldNames();

        for (var i = 0, il = fieldNames.length; i < il; i++) {
          var thisFieldName = fieldNames[i],
              field = schemaObj[thisFieldName],
              contextFieldName = field.getProp('field', { context });

          if (contextFieldName === fieldName)
            return field;
        }
      }

      return schemaObj[fieldName];
    }

    retrieveModelValue(field, instance) {
      if (!field || !instance)
        return;

      var getter = field.getProp('getter'),
          fieldName = field.getProp('field');

      return getter(instance[fieldName]);
    }

    getOwnerIDField() {
      return this.getField('ownerID');
    }

    getOwnerTypeField() {
      return this.getField('ownerType');
    }

    getOwnerFieldField() {
      return this.getField('ownerField');
    }

    getOwnerOrderField() {
      return this.getField('ownerOrder');
    }

    getPrimaryKeyField() {
      return this.getField('_primaryKeyField');
    }

    retrieveOwnerIDValue(instance) {
      return this.retrieveModelValue(this.getOwnerIDField(), instance);
    }

    retrieveOwnerTypeValue(instance) {
      return this.retrieveModelValue(this.getOwnerTypeField(), instance);
    }

    retrieveOwnerFieldValue(instance) {
      return this.retrieveModelValue(this.getOwnerFieldField(), instance);
    }

    retrieveOwnerOrderValue(instance) {
      return this.retrieveModelValue(this.getOwnerOrderField(), instance);
    }

    retrievePrimaryKeyValue(instance) {
      return this.retrieveModelValue(this.getPrimaryKeyField(), instance);
    }

    hasField(fieldName) {
      var schemaObj = this._schema;
      return schemaObj.hasOwnProperty(fieldName);
    }

    getFieldProp(fieldName, propName, opts) {
      var field = this.getField(fieldName);
      if (!field) {
        Logger.warn(`Unknown field "${fieldName}" when attempting to get field property "${propName}". Returning undefined`);
        return;
      }

      return field.getProp(propName, opts);
    }

    compareTo(modelType, cb) {
      var nativeFieldNames = this.getFieldNames(),
          foreignFieldNames = modelType.getFieldNames(),
          fieldNames = this.sortFieldNames(Object.keys(nativeFieldNames.concat(foreignFieldNames).reduce((obj, item) => {
            obj[item] = true;
            return obj;
          }, {}))),
          abort = () => abort,
          areSame = true;

      for (var i = 0, il = fieldNames.length; i < il; i++) {
        var fieldName = fieldNames[i],
            nativeField = this.getField(fieldName),
            foreignField = modelType.getField(fieldName),
            ret;

        if (nativeField && foreignField) {
          ret = nativeField.compareTo(foreignField, cb);
          if (!ret) {
            ret = cb('different', 'field', fieldName, nativeField, foreignField, this, modelType, abort);
            if (ret !== false)
              areSame = false;
          }
        } else if (nativeField) {
          ret = cb('missing', 'field', fieldName, nativeField, null, this, modelType, abort);
          if (ret !== false)
            areSame = false;
        } else {
          ret = cb('extra', 'field', fieldName, null, foreignField, this, modelType, abort);
          if (ret !== false)
            areSame = false;
        }

        if (ret === abort)
          break;
      }

      return areSame;
    }
  }

  // Static properties
  Object.assign(ModelType, {
    FLAGS
  });

  Object.assign(root, {
    ModelType
  });
};
