module.exports = function(root, requireModule) {
  const moment = requireModule('moment');
  const { definePropertyRW, noe, uuid } = requireModule('./base/utils');

  const FLAGS = {
          HIDDEN: 0x01,
          PRIMITIVE: 0x02,
          VIRTUAL: 0x04,
          COMPLEX: 0x08,
          OWNABLE: 0x10,
          INTERNAL: 0x20
        },
        FLAG_KEYS = Object.keys(FLAGS);

  function getVersion(_opts, _version) {
    var opts = _opts || {},
        version = opts.version || _version;

    if (!version)
      version = this.currentVersion;

    return version;
  }

  class Schema {
    constructor(schemaEngine, model) {
      if (!schemaEngine)
        throw new Error('"schemaEngine" argument required to create a ModelSchema');

      if (!model)
        throw new Error('"model" argument required to create a ModelSchema');

      definePropertyRW(this, '_schemaEngine', schemaEngine);
      definePropertyRW(this, '_model', model);
    }

    getTypeName() {
      return this._model.getTypeName();
    }

    getBaseModelClass() {
      return this._model.getBaseModelClass();
    }

    getModelClass() {
      return this._model.getModelClass();
    }

    getSchemaEngine() {
      return this._schemaEngine;
    }

    getFieldFlags(field, _opts) {
      // function isComplex(schemaEngine, field) {
      //   var targetTypeName = field.getTargetTypeName();
      //   if (targetTypeName instanceof Array)
      //     return true;

      //   return false;
      // }

      var opts = _opts || {},
          fieldName = (opts.fieldName) ? opts.fieldName : field.getProp('field'),
          modelClass = field.getModelClass(),
          flags = 0;

      if (fieldName.charAt(0) === '_')
        flags |= FLAGS.HIDDEN;

      if (field.getProp('virtual', opts.context))
        flags |= FLAGS.VIRTUAL;

      // if (field.getProp('ownable', opts.context))
      //   flags |= FLAGS.OWNABLE;

      if ((modelClass.primitive instanceof Function) && modelClass.primitive())
        flags |= FLAGS.PRIMITIVE;

      // if (isComplex(schemaEngine, field))
      //   flags |= FLAGS.COMPLEX;

      // if (field.getProp('internal', opts.context))
      //   flags |= FLAGS.INTERNAL;

      return flags;
    }

    *entries(_opts) {
      function flagsPass(flags) {
        for (var i = 0, il = FLAG_KEYS.length; i < il; i++) {
          var key = FLAG_KEYS[i],
              opt = opts[key.toLowerCase()],
              flag = FLAGS[key];

          if ((opt === true && !(flags & flag)) || (opt === false && (flags & flag)))
            return false;
        }

        return true;
      }

      var opts = Object.assign({ hidden: false }, _opts || {}),
          keys = Object.keys(this);

      for (var i = 0, il = keys.length; i < il; i++) {
        var fieldName = keys[i],
            field = this[fieldName],
            flags;

        opts.fieldName = fieldName;
        flags = this.getFieldFlags(field, opts);

        if (!flagsPass(flags))
          continue;

        yield [ fieldName, field ];
      }
    }

    *keys(_opts) {
      for (var [ fieldName, _ ] of this.entries(_opts))
        yield fieldName;
    }

    *values(_opts) {
      for (var [ _, field ] of this.entries(_opts))
        yield field;
    }

    *[Symbol.iterator]() {
      yield* this.entries();
    }
  }

  class ModelSchema {
    constructor(schemaEngine, model) {
      if (!schemaEngine)
        throw new Error('"schemaEngine" argument required to create a ModelSchema');

      if (!model)
        throw new Error('"model" argument required to create a ModelSchema');

      definePropertyRW(this, '_schemaEngine', schemaEngine);
      definePropertyRW(this, '_model', model);
      definePropertyRW(this, '_schemaDefinitions', {});
      definePropertyRW(this, 'currentVersion', 1);

      this.initialize();
    }

    getTypeName() {
      return this._model.getTypeName();
    }

    getBaseModelClass() {
      return this._model.getBaseModelClass();
    }

    getModelClass() {
      return this._model.getModelClass();
    }

    getSchemaEngine() {
      return this._schemaEngine;
    }

    createDefaultPrimaryKeyField({ String }, typeName) {
      return String.field('id').maxLength(typeName.length + 33).nullable(false).required.value(() => {
        return `${typeName}:${uuid()}`;
      });
    }

    createDefaultCreatedAtField({ Date }, typeName) {
      return Date.field('createdAt').nullable(false).required.value(() => {
        return moment().toISOString();
      });
    }

    createDefaultUpdatedAtField({ Date }, typeName) {
      return Date.field('updatedAt').nullable(false).required.value(() => {
        return moment().toISOString();
      });
    }

    createDefaultOwnerIDField({ String }, typeName) {
      return String.field('ownerID').nullable(true);
    }

    createDefaultOwnerTypeField({ String }, typeName) {
      return String.field('ownerType').nullable(true);
    }

    createDefaultOwnerOrderField({ Integer }, typeName) {
      return Integer.field('ownerOrder').nullable(true);
    }

    createDefaultOwnerFieldField({ String }, typeName) {
      return String.field('ownerField').nullable(true);
    }

    getDefaultFields() {
      return {
        id: this.createDefaultPrimaryKeyField,
        createdAt: this.createDefaultCreatedAtField,
        updatedAt: this.createDefaultUpdatedAtField,
        ownerID: this.createDefaultOwnerIDField,
        ownerType: this.createDefaultOwnerTypeField,
        ownerOrder: this.createDefaultOwnerOrderField,
        ownerField: this.createDefaultOwnerFieldField,
      };
    }

    getRawSchema(types, typeName, rawSchema) {
      if (!rawSchema)
        throw new Error(`${typeName} model: Nothing returned from schema factory`);

      var defaultFields = this.getDefaultFields(),
          isArray = (rawSchema instanceof Array),
          finalSchema = new Schema(this._schemaEngine, this._model);

      // Check that all field names are set
      for (var [ fieldName, field ] of rawSchema.entries()) {
        var thisFieldName = field.getProp('field');
        if (noe(thisFieldName)) {
          if (!isArray) {
            thisFieldName = fieldName;
            field = field.field(fieldName);
          } else {
            throw new Error(`${typeName} model: Field name not defined for a field`);
          }
        }

        finalSchema[thisFieldName] = field;
      }

      // Ensure default fields are present
      for (var [ fieldName, fieldCreator ] of defaultFields) {
        if (!finalSchema[fieldName])
          finalSchema[fieldName] = fieldCreator.call(this, types, typeName);
      }

      // Lock schema
      for (var [ fieldName, field ] of finalSchema)
        finalSchema[fieldName] = field.finalize();

      return finalSchema;
    }

    defineSchema(types, _parent, definition) {
      var typeName = this.getTypeName();

      if (!definition)
        throw new Error(`${typeName} model: Expected a schema definition but recieved ${definition} instead`);

      if (!(definition.schema instanceof Function))
        throw new Error(`${typeName} model: Schema definition requires a "schema" function that will return a raw schema`);

      var parent = _parent,
          parentDefinition = null;

      if (parent) {
        if (!(parent instanceof Function))
          throw new Error(`${typeName} model: Schema definition parent must be a schema factory`);

        parent = parent.call(this, this.defineSchema.bind(this, types));
        parentDefinition = parent.getSchemaDefinition();
      }

      if (!definition.version) {
        if (parentDefinition)
          definition.version = parentDefinition.version + 1;
        else
          definition.version = 1;
      }

      if (!(definition.demote instanceof Function))
        throw new Error(`${typeName} model: Demoter transformer "demote" must be defined for schema version`);

      if (!(definition.promote instanceof Function))
        throw new Error(`${typeName} model: Promoter transformer "promote" must be defined for schema version`);

      if (parentDefinition && definition.version < parentDefinition.version)
        throw new Error(`${typeName} model: Newer schema version defines a version number that is less than parent`);

      var version = definition.version;

      this._schemaDefinitions[version] = definition;
      definition.rawSchema = this.getRawSchema.call(this, types, typeName, definition.schema.call(this, types, (parentDefinition) ? Object.assign({}, parentDefinition.rawSchema) : null, parentDefinition));
      this.currentVersion = version;

      return this;
    }

    initialize() {
      var schemaFactory = (this._model.primitive instanceof Function && this._model.primitive()) ? (defineSchema) => {
        return defineSchema(null, {
          version: 1,
          schema: () => {
            return {};
          },
          demote: (model) => model,
          promote: (model) => model
        });
      } : this._model.schema;

      schemaFactory.call(this, this.defineSchema.bind(this, this._schemaEngine.getTypes()));
    }

    getSchemaDefinition(_version) {
      var version = getVersion.call(this, null, _version);
      return this._schemaDefinitions[version];
    }

    getSchema(_version) {
      var version = getVersion.call(this, null, _version);
      return this._schemaDefinitions[version].rawSchema;
    }

    *entries(_opts, _version) {
      var version = getVersion.call(this, _opts, _version),
          rawSchema = this._schemaDefinitions[version].rawSchema;

      yield* rawSchema.entries(_opts);
    }

    *keys(_opts, _version) {
      var version = getVersion.call(this, _opts, _version),
          rawSchema = this._schemaDefinitions[version].rawSchema;

      yield* rawSchema.keys(_opts);
    }

    *values(_opts, _version) {
      var version = getVersion.call(this, _opts, _version),
          rawSchema = this._schemaDefinitions[version].rawSchema;

      yield* rawSchema.values(_opts);
    }

    *[Symbol.iterator]() {
      yield* this.entries();
    }

    getField(fieldName, _version) {
      var version = getVersion.call(this, {}, _version),
          rawSchema = this._schemaDefinitions[version].rawSchema;

      return rawSchema[fieldName];
    }

    getFieldProp(fieldName, propName, _version) {
      var field = this.getField(fieldName, _version);
      return (field) ? field.getProp(propName) : undefined;
    }

    // initialize(schemaEngine, typeInfo, schemaTypes, schemaObj) {
    //   if (!schemaEngine || !typeInfo || !schemaObj || !schemaTypes)
    //     throw new Error('Parent schema, Type info, schema, and schema types definition are required to initialize ModelSchema class');

    //   var finalSchema = {},
    //       isArray = (schemaObj instanceof Array),
    //       typeName = typeInfo.typeName,
    //       schemaCode,
    //       fieldSchema;

    //   if (!schemaObj || !(isArray || schemaObj instanceof Object) || !sizeOf(schemaObj))
    //     throw new Error('Schema must be an array or enumerable object');

    //   var locked = false;
    //   definePropertyRW(this, '_parentSchema', schemaEngine);
    //   definePropertyRW(this, '_typeInfo', typeInfo);
    //   definePropertyRW(this, '_schemaTypes', schemaTypes);
    //   definePropertyRW(this, '_schema', finalSchema);
    //   definePropertyRW(this, '_cachedFieldNames', null);
    //   definePropertyRW(this, '_lock', undefined, () => locked, () => {
    //     if (!locked)
    //       locked = true;
    //     return locked;
    //   });

    //   this.setTypeName(typeName);

    //   var keys = Object.keys(schemaObj),
    //       hasPrimaryKey = false;

    //   for (var i = 0, il = keys.length; i < il; i++) {
    //     var key = keys[i];

    //     fieldSchema = schemaObj[key];

    //     if (!fieldSchema || !(fieldSchema instanceof SchemaType))
    //       throw new Error(`Schema field ${key} must inherit from SchemaType`);

    //     if (!isArray && !fieldSchema.getProp('field'))
    //       fieldSchema.setProp('field', key, '*');

    //     fieldSchema.validateSchema();

    //     if (fieldSchema.getProp('primaryKey')) {
    //       hasPrimaryKey = true;
    //       finalSchema['_primaryKeyField'] = fieldSchema;
    //     }

    //     var currentField = fieldSchema.getProp('field', '*');
    //     if (noe(currentField))
    //       throw new Error(`Schema field ${key} does not specify a "field" on the root context`);

    //     if (currentField === '_schemaCode')
    //       schemaCode = fieldSchema.getProp('value', '*');

    //     // Don't allow any more changes to this field
    //     fieldSchema.lock();
    //     finalSchema[currentField] = fieldSchema;
    //   }

    //   if (noe(schemaCode)) {
    //     schemaCode = this.getDefaultSchemaCode(typeName);
    //     fieldSchema = this.getDefaultSchemaCodeField(schemaCode);
    //     finalSchema['_schemaCode'] = fieldSchema;
    //     fieldSchema.lock();
    //   }

    //   if (!hasPrimaryKey) {
    //     fieldSchema = this.getDefaultPrimaryKeyField(schemaCode);
    //     finalSchema['id'] = fieldSchema;
    //     fieldSchema.lock();

    //     finalSchema['_primaryKeyField'] = fieldSchema;
    //   }

    //   if (!finalSchema.hasOwnProperty('createdAt')) {
    //     fieldSchema = this.getDefaultCreatedAtField();
    //     finalSchema['createdAt'] = fieldSchema;
    //     fieldSchema.lock();
    //   }

    //   if (!finalSchema.hasOwnProperty('updatedAt')) {
    //     fieldSchema = this.getDefaultUpdatedAtField();
    //     finalSchema['updatedAt'] = fieldSchema;
    //     fieldSchema.lock();
    //   }
    // }

    // lock() {
    //   this._lock = true;
    // }

    // getTypeName() {
    //   return typeName;
    // }

    // setTypeName(typeName) {
    //   definePropertyRW(this, '_typeName', typeName);
    // }

    // getTypeInfo() {
    //   return this._typeInfo;
    // }

    // getRawSchema() {
    //   return this._schema;
    // }

    // getSchemaTypes() {
    //   return this._schemaTypes;
    // }

    // getSchemaType() {
    //   return new this._typeInfo.schemaTypeClass(this._parentSchema, this);
    // }

    // getSchemaEngine() {
    //   return this._parentSchema;
    // }

    // getModelType() {
    //   return this._typeInfo.modelType;
    // }

    // decompose(...args) {
    //   return this.getSchemaType().decompose(...args);
    // }

    // decomposeAsModel(...args) {
    //   return this.getSchemaType().decomposeAsModel(...args);
    // }

    // validate(...args) {
    //   return this.getSchemaType().validate(...args);
    // }

    // instantiate(...args) {
    //   return this.getSchemaType().instantiate(...args);
    // }

    // getDefaultSchemaCode(typeName) {
    //   return typeName;
    // }

    // getDefaultSchemaCodeField(schemaCode) {
    //   return this.getSchemaTypes().String.value(schemaCode).field('_schemaCode');
    // }

    // getDefaultPrimaryKeyField(schemaCode) {
    //   var maxLength = (schemaCode + ':' + uuid()).length;
    //   return this.getSchemaTypes().String.primaryKey.setter((val) => {
    //     return (noe(val)) ? (schemaCode + ':' + uuid()) : val;
    //   }).field('id').notNull.required.max(maxLength);
    // }

    // getDefaultCreatedAtField() {
    //   return this.getSchemaTypes().Date.field('createdAt');
    // }

    // getDefaultUpdatedAtField() {
    //   return this.getSchemaTypes().Date.field('updatedAt');
    // }

    // calcFieldPriority(fieldName) {
    //   var field = this.getField(fieldName);
    //   if (!field)
    //     return 1024;

    //   var weight = calcStringWeight(fieldName.toLowerCase());
    //   if (field.getProp('virtual'))
    //     weight += 255;

    //   if (field.getProp('primaryKey'))
    //     weight -= 255;

    //   return weight;
    // }

    // sortFieldNames(fieldNames) {
    //   return fieldNames.sort((a, b) => {
    //     var x = this.calcFieldPriority(a),
    //         y = this.calcFieldPriority(b);

    //     return (x == y) ? 0 : (x < y) ? -1 : 1;
    //   });
    // }

    // getFieldNames() {
    //   if (this._cachedFieldNames)
    //     return this._cachedFieldNames;

    //   var schemaObj = this._schema,
    //       keys = this.sortFieldNames(Object.keys(schemaObj));

    //   this._cachedFieldNames = keys;
    //   return keys;
    // }

    // getFieldFlags(field, _opts) {
    //   function isComplex(schemaEngine, field) {
    //     var targetTypeName = field.getTargetTypeName();
    //     if (targetTypeName instanceof Array)
    //       return true;

    //     return false;
    //   }

    //   function isPrimitiveType(schemaEngine, field) {
    //     var targetTypeName = field.getTargetTypeName();
    //     if (targetTypeName instanceof Array)
    //       return false;

    //     var typeInfo = schemaEngine.getTypeInfo(targetTypeName);
    //     if (typeInfo.primitiveType)
    //       return true;

    //     return false;
    //   }

    //   var opts = _opts || {},
    //       fieldName = (opts.fieldName) ? opts.fieldName : field.getProp('field'),
    //       schemaEngine = (opts.schemaEngine) ? opts.schemaEngine : this.getSchemaEngine(),
    //       flags = 0;

    //   if (fieldName.charAt(0) === '_')
    //     flags |= FLAGS.HIDDEN;

    //   if (field.getProp('virtual', opts.context))
    //     flags |= FLAGS.VIRTUAL;

    //   if (field.getProp('ownable', opts.context))
    //     flags |= FLAGS.OWNABLE;

    //   if (isPrimitiveType(schemaEngine, field))
    //     flags |= FLAGS.PRIMITIVE;

    //   if (isComplex(schemaEngine, field))
    //     flags |= FLAGS.COMPLEX;

    //   if (field.getProp('internal', opts.context))
    //     flags |= FLAGS.INTERNAL;

    //   return flags;
    // }

    // iterateFields(cb, _opts) {
    //   function flagsPass(flags) {
    //     for (var i = 0, il = FLAG_KEYS.length; i < il; i++) {
    //       var key = FLAG_KEYS[i],
    //           opt = opts[key.toLowerCase()],
    //           flag = FLAGS[key];

    //       if ((opt === true && !(flags & flag)) || (opt === false && (flags & flag)))
    //         return false;
    //     }

    //     return true;
    //   }

    //   var opts = Object.assign({ hidden: false }, _opts || {}),
    //       schemaEngine = (opts.schemaEngine) ? schemaEngine : this.getSchemaEngine(),
    //       schemaObj = this._schema,
    //       fieldNames = this.getFieldNames(),
    //       rets = [],
    //       abort = () => abort;

    //   opts.schemaEngine = schemaEngine;

    //   for (var i = 0, il = fieldNames.length; i < il; i++) {
    //     var fieldName = fieldNames[i],
    //         field = schemaObj[fieldName],
    //         flags;

    //     opts.fieldName = fieldName;
    //     flags = this.getFieldFlags(field, opts);

    //     if (!flagsPass(flags))
    //       continue;

    //     var ret = cb.call(this, field, fieldName, i, flags, abort);
    //     if (ret === abort)
    //       break;

    //     rets.push(ret);
    //   }

    //   return rets;
    // }

    // getChildTypeNames(_opts) {
    //   var opts = _opts || {},
    //       modelTypeNames = {};

    //   this.iterateFields((field, fieldName, index, flags) => {
    //     var typeNames = (opts.target) ? field.getTargetTypeName() : field.getTypeName();

    //     if (!(typeNames instanceof Array))
    //         typeNames = [typeNames];

    //     for (var i = 0, il = typeNames.length; i < il; i++) {
    //       var typeName = typeNames[i];
    //       if (typeName)
    //         modelTypeNames[typeName] = true;
    //     }
    //   }, opts);

    //   return Object.keys(modelTypeNames);
    // }

    // addField(field) {
    //   if (!field)
    //     return;

    //   if (this._lock)
    //     throw new Error('Can not modify schema when it is locked');

    //   var fieldName = field.getProp('field');
    //   if (this.getField(fieldName))
    //     throw new Error(`Can not add schema field ${fieldName} because it already exists in ${this.getTypeName()} schema`);

    //   this._schema[fieldName] = field;
    //   this._cachedFieldNames = null;
    //   field.lock();

    //   return field;
    // }

    // getField(fieldName, context) {
    //   if (fieldName instanceof SchemaType)
    //     return fieldName;

    //   var schemaObj = this._schema;
    //   if (context) {
    //     var fieldNames = this.getFieldNames();

    //     for (var i = 0, il = fieldNames.length; i < il; i++) {
    //       var thisFieldName = fieldNames[i],
    //           field = schemaObj[thisFieldName],
    //           contextFieldName = field.getProp('field', { context });

    //       if (contextFieldName === fieldName)
    //         return field;
    //     }
    //   }

    //   return schemaObj[fieldName];
    // }

    // retrieveModelValue(field, instance) {
    //   if (!field || !instance)
    //     return;

    //   var getter = field.getProp('getter'),
    //       fieldName = field.getProp('field');

    //   return getter(field, instance[fieldName]);
    // }

    // getOwnerFieldName() {
    //   return 'owner';
    // }

    // getOwnerIDField(_opts) {
    //   return this.getField('ownerID', _opts);
    // }

    // getOwnerTypeField(_opts) {
    //   return this.getField('ownerType', _opts);
    // }

    // getOwnerFieldField(_opts) {
    //   return this.getField('ownerField', _opts);
    // }

    // getOwnerOrderField(_opts) {
    //   return this.getField('ownerOrder', _opts);
    // }

    // getPrimaryKeyField(_opts) {
    //   return this.getField('_primaryKeyField', _opts);
    // }

    // getMinimalRequiredFields() {
    //   return [
    //     this.getPrimaryKeyField(),
    //     this.getOwnerOrderField(),
    //     this.getOwnerFieldField(),
    //     this.getOwnerTypeField(),
    //     this.getOwnerIDField()
    //   ];
    // }

    // retrieveOwnerIDValue(instance, _opts) {
    //   return this.retrieveModelValue(this.getOwnerIDField(_opts), instance);
    // }

    // retrieveOwnerTypeValue(instance, _opts) {
    //   return this.retrieveModelValue(this.getOwnerTypeField(_opts), instance);
    // }

    // retrieveOwnerFieldValue(instance, _opts) {
    //   return this.retrieveModelValue(this.getOwnerFieldField(_opts), instance);
    // }

    // retrieveOwnerOrderValue(instance, _opts) {
    //   return this.retrieveModelValue(this.getOwnerOrderField(_opts), instance);
    // }

    // retrievePrimaryKeyValue(instance, _opts) {
    //   return this.retrieveModelValue(this.getPrimaryKeyField(_opts), instance);
    // }

    // hasField(fieldName) {
    //   var schemaObj = this._schema;
    //   return schemaObj.hasOwnProperty(fieldName);
    // }

    // getFieldProp(fieldName, propName, opts) {
    //   var field = this.getField(fieldName);
    //   if (!field) {
    //     Logger.warn(`Unknown field "${fieldName}" when attempting to get field property "${propName}". Returning undefined`);
    //     return;
    //   }

    //   return field.getProp(propName, opts);
    // }

    // modelIsType(data) {
    //   if (!data)
    //     return false;

    //   if (data instanceof this.constructor)
    //     return true;

    //   // Check primary key (if pk has a schema code)
    //   var primaryKey = this.retrievePrimaryKeyValue(data);
    //   if (primaryKey) {
    //     var schemaCodeField = this._schema['_schemaCode'],
    //         schemaCode = (schemaCodeField) ? schemaCodeField.getProp('value') : null,
    //         pkSchemaCode = ('' + primaryKey).replace(/^([^:]+):.*/g, '$1');

    //     if (pkSchemaCode === schemaCode)
    //       return true;
    //   }

    //   return false;
    // }

    // compareTo(modelType, cb) {
    //   var nativeFieldNames = this.getFieldNames(),
    //       foreignFieldNames = modelType.getFieldNames(),
    //       fieldNames = this.sortFieldNames(Object.keys(nativeFieldNames.concat(foreignFieldNames).reduce((obj, item) => {
    //         obj[item] = true;
    //         return obj;
    //       }, {}))),
    //       abort = () => abort,
    //       areSame = true;

    //   for (var i = 0, il = fieldNames.length; i < il; i++) {
    //     var fieldName = fieldNames[i],
    //         nativeField = this.getField(fieldName),
    //         foreignField = modelType.getField(fieldName),
    //         ret;

    //     if (nativeField && foreignField) {
    //       ret = nativeField.compareTo(foreignField, cb);
    //       if (!ret) {
    //         ret = cb('different', 'field', fieldName, nativeField, foreignField, this, modelType, abort);
    //         if (ret !== false)
    //           areSame = false;
    //       }
    //     } else if (nativeField) {
    //       ret = cb('missing', 'field', fieldName, nativeField, null, this, modelType, abort);
    //       if (ret !== false)
    //         areSame = false;
    //     } else {
    //       ret = cb('extra', 'field', fieldName, null, foreignField, this, modelType, abort);
    //       if (ret !== false)
    //         areSame = false;
    //     }

    //     if (ret === abort)
    //       break;
    //   }

    //   return areSame;
    // }
  }

  // Static properties
  Object.assign(ModelSchema, {
    FLAGS
  });

  root.export({
    ModelSchema
  });
};
