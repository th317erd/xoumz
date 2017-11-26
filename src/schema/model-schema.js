module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf, noe, pluralOf, uuid } = requireModule('./utils');
  const SchemaTypes = requireModule('./schema/schema-types');
  
  class ModelSchema {
    constructor(typeInfo, schemaObj) {
      function validateSchema(_fieldSchema) {
        var fieldSchema = _fieldSchema;

        if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType || fieldSchema instanceof Array))
          throw new Error(`Schema field ${key} must inherit from SchemaType`);

        /*if (fieldSchema instanceof Array) {
          // Get arrayOf type
          fieldSchema = fieldSchema[0];
          
          // Index zero is the type, which can be another array if multiple types
          // So we just always make sure this "type" is an array, so we can easily
          // Verify the types at every index
          if (!(fieldSchema instanceof Array))
            fieldSchema = [fieldSchema];

          for (var i = 0, il = fieldSchema.length; i < il; i++) {
            var thisFieldSchema = fieldSchema[i];
            if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType || fieldSchema instanceof Array))
              throw new Error(`Schema field ${key} must inherit from SchemaType`);
          }
        }*/
      }

      if (!typeInfo || !schemaObj)
        throw new Error('Type info and type schema required to instantiate a ModelSchema class');

      var finalSchema = {},
          isArray = (schemaObj instanceof Array),
          typeName = typeInfo.typeName,
          schemaCode,
          fieldSchema;

      if (!schemaObj || !(isArray || schemaObj instanceof Object) || !sizeOf(schemaObj))
        throw new Error('Schema must be an array or enumerable object');

      var keys = Object.keys(schemaObj),
          hasPrimaryKey = false;

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i];
        
        fieldSchema = schemaObj[key];

        if (!fieldSchema || !(fieldSchema instanceof SchemaTypes.SchemaType))
          throw new Error(`Schema field ${key} must inherit from SchemaType`);

        fieldSchema.validateSchema();
        
        if (!isArray && !fieldSchema.getProp('field'))
          fieldSchema.setProp('field', key, '*');

        if (fieldSchema.getProp('primaryKey'))
          hasPrimaryKey = true;

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
      }

      definePropertyRW(this, '_typeInfo', typeInfo);
      definePropertyRW(this, '_schema', finalSchema);

      this.setTypeName(typeName);
    }

    decompose(...args) {
      return this._typeInfo.type.decompose(...args);
    }

    instantiate(...args) {
      return this._typeInfo.type.instantiate(...args);
    }

    getDefaultSchemaCode(typeName) {
      return typeName;
    }

    getDefaultSchemaCodeField(schemaCode) {
      return SchemaTypes.SchemaTypes.Meta.value(schemaCode).field('_schemaCode');
    }

    getDefaultPrimaryKeyField(schemaCode) {
      return SchemaTypes.SchemaTypes.String.primaryKey.setter((val) => {
        return (val) ? val : (schemaCode + ':' + uuid());
      }).field('id');
    }

    setTypeName(typeName) {
      var finalSchema = this._schema;
      if (!noe(typeName) && !finalSchema.hasOwnProperty('_table'))
        finalSchema['_table'] = SchemaTypes.SchemaTypes.Meta.field('_table').value(pluralOf(typeName));

      definePropertyRW(this, '_typeName', typeName);
    }

    getTypeInfo() {
      return this._typeInfo;
    }

    getSchemaType() {
      return this.getTypeInfo().type;
    }

    getTypeName() {
      return this._typeName;
    }
  
    getRawSchema() {
      return this._schema;
    }

    iterateFields(cb) {
      var schemaObj = this._schema,
          keys = Object.keys(schemaObj);

      for (var i = 0, il = keys.length; i < il; i++) {
        var key = keys[i],
            fieldSchema = schemaObj[key];

        if (key.charAt(0) === '_')
          continue;

        if (cb.call(this, fieldSchema, key, this) === false)
          break;
      }
    }

    getField(fieldName) {
      var schemaObj = this._schema;
      return schemaObj[fieldName];
    }

    hasField(fieldName) {
      var schemaObj = this._schema;
      return schemaObj.hasOwnProperty(fieldName);
    }

    getFieldProp(fieldName, propName, opts) {
      var field = this.getField(fieldName);
      return field.getProp(propName, opts);
    }
  }

  Object.assign(root, {
    ModelSchema
  });
};
