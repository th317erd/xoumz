module.exports = function(root, requireModule) {
  function generateModelMethods(klass, _typeName) {
    var modelName = _typeName || klass.name,
        modelSchema;

    if (!klass.hasOwnProperty('primitive')) {
      klass.primitive = function primitive() {
        return null;
      };
    }

    if (!klass.hasOwnProperty('isVirtual')) {
      klass.isVirtual = function isVirtual() {
        return false;
      };
    }

    if (!klass.hasOwnProperty('isAbstract')) {
      klass.isAbstract = function isAbstract() {
        return false;
      };
    }

    if (!klass.hasOwnProperty('isComplex')) {
      klass.isComplex = function isComplex() {
        return false;
      };
    }

    if (!klass.hasOwnProperty('getModelName')) {
      klass['getModelName'] = function getModelName() {
        return modelName;
      };
    }

    if (!klass.hasOwnProperty('getSchemaType')) {
      klass['getSchemaType'] = function getSchemaType(opts) {
        const SchemaTypeClass = (typeof klass.getSchemaTypeClass === 'function') ? klass.getSchemaTypeClass() : SchemaType;
        return new SchemaTypeClass(klass, new Context({ name: 'type', group: 'schema' }, opts || {}));
      };
    }

    if (!klass.hasOwnProperty('getSchema')) {
      klass['getSchema'] = function getSchema() {
        if (!modelSchema) {
          modelSchema = new ModelSchema(klass);
          modelSchema.initialize();
        }

        return modelSchema;
      };
    }

    if (!klass.hasOwnProperty('getModelClass')) {
      klass['getModelClass'] = function getModelClass() {
        return klass;
      };
    }

    if (!klass.hasOwnProperty('getUniqueResourceID')) {
      klass['getUniqueResourceID'] = function getUniqueResourceID() {
        return `org_xoumz_model_${modelName}`;
      };
    }

    if (!klass.hasOwnProperty('rebindStaticMethod')) {
      klass['rebindStaticMethod'] = function rebindStaticMethod(methodName, method, klass) {
        if (methodName === 'getModelName') {
          return function getModelName() {
            return klass.name;
          };
        } else if (methodName === 'getSchemaType') {
          return function getSchemaType(opts) {
            const SchemaTypeClass = (typeof klass.getSchemaTypeClass === 'function') ? klass.getSchemaTypeClass() : SchemaType;
            return new SchemaTypeClass(klass, new Context({ name: 'type', group: 'schema' }, opts || {}));
          };
        } else if (methodName === 'getModelClass') {
          return function getModelClass() {
            return klass;
          };
        } else if (methodName === 'getUniqueResourceID') {
          return function getUniqueResourceID() {
            return `org_xoumz_model_${klass.getModelName()}`;
          };
        } else if (methodName === 'getSchema') {
          var modelSchema;
          return function getSchema() {
            if (!modelSchema) {
              modelSchema = new ModelSchema(klass);
              modelSchema.initialize();
            }

            return modelSchema;
          };
        }

        return method;
      };
    }

    if (!klass.prototype.hasOwnProperty('primitive')) {
      klass.prototype['primitive'] = function primitive(...args) {
        return this.constructor.primitive(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('isVirtual')) {
      klass.prototype['isVirtual'] = function isVirtual(...args) {
        return this.constructor.isVirtual(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('isAbstract')) {
      klass.prototype['isAbstract'] = function isAbstract(...args) {
        return this.constructor.isAbstract(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('isComplex')) {
      klass.prototype['isComplex'] = function isComplex(...args) {
        return this.constructor.isComplex(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('getModelName')) {
      klass.prototype['getModelName'] = function getModelName(...args) {
        return this.constructor.getModelName(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('getSchemaType')) {
      klass.prototype['getSchemaType'] = function getSchemaType(...args) {
        return this.constructor.getSchemaType(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('getSchema')) {
      klass.prototype['getSchema'] = function getSchema(...args) {
        return this.constructor.getSchema(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('getModelClass')) {
      klass.prototype['getModelClass'] = function getModelClass(...args) {
        return this.constructor.getModelClass(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('getUniqueResourceID')) {
      klass.prototype['getUniqueResourceID'] = function getUniqueResourceID(...args) {
        return this.constructor.getUniqueResourceID(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('validate')) {
      klass.prototype['validate'] = function validate() {
      };
    }

    if (!klass.prototype.hasOwnProperty('getFieldDefinition')) {
      klass.prototype['getFieldDefinition'] = function getFieldDefinition(...args) {
        return this._fieldDefinition;
      };
    }

    if (!klass.prototype.hasOwnProperty('getField')) {
      klass.prototype['getField'] = function getField(...args) {
        return this.getSchema().getField(...args);
      };
    }

    if (!klass.prototype.hasOwnProperty('getFieldProp')) {
      klass.prototype['getFieldProp'] = function getFieldProp(...args) {
        return this.getSchema().getFieldProp(...args);
      };
    }

    return klass;
  }

  const moment = requireModule('moment');
  const { definePropertyRW, noe, uuid, instanceOf } = requireModule('./base/utils');
  const { SchemaType, FieldDefinition } = requireModule('./schema/schema-type');
  const { Context } = requireModule('./base/context');

  const FLAGS = {
          HIDDEN: 0x01,
          PRIMITIVE: 0x02,
          VIRTUAL: 0x04,
          COMPLEX: 0x08,
          ABSTRACT: 0x10,
          OWNABLE: 0x20,
          INTERNAL: 0x40
        },
        FLAG_KEYS = Object.keys(FLAGS);

  const ModelSchema = this.defineClass((ParentClass) => {
    return class ModelSchema extends ParentClass {
      static flagsPass(flags, opts) {
        for (var i = 0, il = FLAG_KEYS.length; i < il; i++) {
          var key = FLAG_KEYS[i],
              opt = opts[key.toLowerCase()],
              flag = FLAGS[key];

          if ((opt === true && !(flags & flag)) || (opt === false && (flags & flag)))
            return false;
        }

        return true;
      }

      constructor(model, _opts) {
        super();

        if (!model)
          throw new Error('"model" argument required to create a ModelSchema');

        var opts = _opts || {};

        definePropertyRW(this, '_options', opts);
        definePropertyRW(this, '_model', model);
        definePropertyRW(this, '_schemaDefinition', {});
        definePropertyRW(this, '_fields', undefined, () => this._schemaDefinition.rawSchema, () => {});

        if (!opts.skipInitialize)
          this.initialize();
      }

      getContext(...args) {
        return new Context({ name: 'model', group: 'schema' }, ...args, { modelClass: this.getModelClass() });
      }

      getModelClass() {
        return this._model.getModelClass();
      }

      getModelName() {
        return this.getModelClass().getModelName();
      }

      getUniqueResourceID() {
        return this.getModelClass().getUniqueResourceID();
      }

      primitive() {
        var modelClass = this.getModelClass();
        return (typeof modelClass.primitive === 'function') ? modelClass.primitive() : null;
      }

      createDefaultPrimaryKeyField({ String }, modelName) {
        return String.field('id').primaryKey.size(modelName.length + 33).nullable(false).required.value(() => {
          return `${modelName}:${uuid()}`;
        });
      }

      createDefaultCreatedAtField({ Date }, modelName) {
        return Date.field('createdAt').nullable(false).required.value(() => {
          return moment().toISOString();
        });
      }

      createDefaultUpdatedAtField({ Date }, modelName) {
        return Date.field('updatedAt').nullable(false).required.value(() => {
          return moment().toISOString();
        });
      }

      createDefaultOwnerField(Types, modelName, fieldName = 'owner') {
        return Types['OwnerScope'](Types[modelName]).field(fieldName).nullable(true).virtual;
      }

      createDefaultOwnerIDField({ String }, modelName, fieldName = 'owner') {
        return String.field(`${fieldName}ID`).nullable(true).size(255);
      }

      createDefaultOwnerTypeField({ String }, modelName, fieldName = 'owner') {
        return String.field(`${fieldName}Type`).nullable(true).size(255);
      }

      createDefaultOwnerOrderField({ Integer }, modelName, fieldName = 'owner') {
        return Integer.field(`${fieldName}Order`).nullable(true);
      }

      createDefaultOwnerFieldField({ String }, modelName, fieldName = 'owner') {
        return String.field(`${fieldName}Field`).nullable(true).size(255);
      }

      getDefaultFields(isPrimitive) {
        var baseFields = {
          id: this.createDefaultPrimaryKeyField,
          createdAt: this.createDefaultCreatedAtField,
          updatedAt: this.createDefaultUpdatedAtField,
        };

        return (isPrimitive) ? Object.assign(baseFields, {
          owner: this.createDefaultOwnerField,
          ownerID: this.createDefaultOwnerIDField,
          ownerType: this.createDefaultOwnerTypeField,
          ownerOrder: this.createDefaultOwnerOrderField,
          ownerField: this.createDefaultOwnerFieldField
        }) : baseFields;
      }

      // Iterate an array or object raw schema
      iterateRawSchema(modelName, rawSchema, cb) {
        var isArray = (rawSchema instanceof Array);

        for (var [ fieldName, field ] of rawSchema.entries()) {
          if (!field)
            continue;

          var thisFieldName = field.getProp('field');
          if (noe(thisFieldName)) {
            if (!isArray) {
              thisFieldName = fieldName;
              field = field.field(fieldName);
            } else {
              throw new Error(`${modelName} model: Field name not defined for a field`);
            }
          }

          cb.call(this, field, thisFieldName);
        }
      }

      runHostSchemaMutators(modelSchema, types, modelName, field, fieldName) {
        var mutators = field.getProp('schemaMutators');
        if (!mutators)
          return;

        var extraSchema = {};
        for (var i = 0, il = mutators.length; i < il; i++) {
          var mutator = mutators[i],
              thisRawSchema = mutator.call(this, types, modelName, field, fieldName, modelSchema);

          if (thisRawSchema) {
            this.iterateRawSchema(modelName, thisRawSchema, (field, thisFieldName) => {
              extraSchema[thisFieldName] = field;
            });
          }
        }

        return (noe(extraSchema)) ? undefined : extraSchema;
      }

      getRawSchemaDefinition(types, modelName, rawSchema) {
        if (!rawSchema)
          throw new Error(`${modelName} model: Nothing returned from schema factory`);

        var defaultFields = this.getDefaultFields(this.primitive()),
            finalSchema = {};

        // Check that all field names are set
        this.iterateRawSchema(modelName, rawSchema, (_field, fieldName) => {
          var field = _field;
          if (fieldName.charAt(0) === '_')
            field = field.context().hidden(true);

          finalSchema[fieldName] = field;
        });

        // Ensure default fields are present
        for (var [ fieldName, fieldCreator ] of defaultFields) {
          if (!finalSchema[fieldName])
            finalSchema[fieldName] = fieldCreator.call(this, types, modelName);
        }

        // Run host schema mutators
        this.iterateRawSchema(modelName, rawSchema, (field, fieldName) => {
          var extraSchema = this.runHostSchemaMutators(finalSchema, types, modelName, field, fieldName);
          if (extraSchema)
            Object.assign(finalSchema, extraSchema);
        });

        // Lock schema
        for (var [ fieldName, field ] of finalSchema)
          finalSchema[fieldName] = field.finalize();

        return finalSchema;
      }

      defineSchema(types, _parent, definition) {
        var modelName = this.getModelName();

        if (!definition)
          throw new Error(`${modelName} model: Expected a schema definition but recieved ${definition} instead`);

        if (!(definition.schema instanceof Function))
          throw new Error(`${modelName} model: Schema definition requires a "schema" function that will return a raw schema`);

        var parent = _parent,
            parentDefinition = null;

        if (parent) {
          if (!(parent instanceof Function))
            throw new Error(`${modelName} model: Schema definition parent must be a schema factory`);

          parent = parent.call(this, this.defineSchema.bind(this, types));
          parentDefinition = parent.getSchemaDefinition();
        }

        if (!(definition.demote instanceof Function))
          throw new Error(`${modelName} model: Demoter transformer "demote" must be defined for schema version`);

        if (!(definition.promote instanceof Function))
          throw new Error(`${modelName} model: Promoter transformer "promote" must be defined for schema version`);

        definition.rawSchema = this.getRawSchemaDefinition.call(this, types, modelName, definition.schema.call(this, types, modelName, (parentDefinition) ? parentDefinition.rawSchema : null, parentDefinition));
        this._schemaDefinition = definition;

        return this;
      }

      initialize() {
        var modelClass = this.getModelClass(),
            schemaFactory = (modelClass.primitive instanceof Function && modelClass.primitive()) ? (defineSchema) => {
              return defineSchema(null, {
                schema: () => {
                  return {};
                },
                demote: (model) => model,
                promote: (model) => model
              });
            } : modelClass.schema;

        var schemaEngine = this.getEngine('schema');
        schemaFactory.call(this, this.defineSchema.bind(this, schemaEngine.getSchemaTypes()));
      }

      getVersion() {
        return this.getApplication().getVersion();
      }

      getVersioned(_opts) {
        return this.getApplication().getModelSchema(this.getModelName(), _opts);
      }

      getSchemaDefinition() {
        return this._schemaDefinition;
      }

      getRawSchema() {
        return this._fields;
      }

      getFieldFlags(field, _opts) {
        var opts = _opts || {},
            fieldName = (opts.fieldName) ? opts.fieldName : field.getProp('field', opts),
            modelClass = field.getModelClass(),
            flags = 0;

        if (fieldName.charAt(0) === '_' || field.getProp('hidden', opts))
          flags |= FLAGS.HIDDEN;

        if (field.getProp('virtual', opts))
          flags |= FLAGS.VIRTUAL;

        if (field.getProp('abstract', opts))
          flags |= FLAGS.ABSTRACT;

        if ((typeof modelClass.primitive === 'function') && modelClass.primitive())
          flags |= FLAGS.PRIMITIVE;

        if (field.getProp('complex', opts))
          flags |= FLAGS.COMPLEX;

        // if (field.getProp('internal', opts))
        //   flags |= FLAGS.INTERNAL;

        return flags;
      }

      merge(schema, _opts) {
        var opts = _opts || {},
            fields = this._fields,
            keys = Object.keys(Object.assign({}, fields, schema)),
            newSchema = {};

        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i],
              thisField = fields[key],
              otherField = schema[key];

          if (opts.onlyMatching) {
            if (thisField && !thisField.getProp('virtual') && !thisField.getProp('abstract') && !schema.hasOwnProperty(key))
              continue;
          }

          if (thisField && !otherField)
            newSchema[key] = thisField;
          else if (!thisField && otherField)
            newSchema[key] = otherField;
          else
            newSchema[key] = thisField.clone(otherField.getScopes());
        }

        return newSchema;
      }

      *entries(_opts) {
        var opts = Object.assign({ hidden: false }, _opts || {}),
            fields = this._fields,
            keys = Object.keys(fields);

        if (opts.hasOwnProperty('real')) {
          var real = !!opts.real;
          opts.hidden = !real;
          opts.virtual = !real;
          opts.abstract = !real;
          opts.complex = !real;
        }

        for (var i = 0, il = keys.length; i < il; i++) {
          var fieldName = keys[i],
              field = fields[fieldName],
              flags;

          opts.fieldName = fieldName;
          flags = this.getFieldFlags(field, opts);

          if (!ModelSchema.flagsPass(flags, opts))
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

      getField(fieldName) {
        if (instanceOf(fieldName, FieldDefinition))
          return fieldName;

        var rawSchema = this.getRawSchema();
        return rawSchema[fieldName];
      }

      getFieldProp(fieldName, propName, opts) {
        var field = this.getField(fieldName);
        return (field) ? field.getFieldProp(fieldName, propName, opts) : undefined;
      }

      modelSchemaDiff(modelSchema, _opts) {
        var opts = _opts || {},
            filterFunc = opts.diffFilter,
            keys = Object.keys(Object.assign({}, this.getRawSchema(), modelSchema.getRawSchema())),
            diffContext = {},
            isDifferent = false;

        for (var i = 0, il = keys.length; i < il; i++) {
          var fieldName = keys[i],
              thisField = this.getField(fieldName, opts),
              otherField = modelSchema.getField(fieldName, opts);

          if (typeof filterFunc === 'function' && !filterFunc.call(this, 'field', fieldName, thisField, otherField))
            continue;

          if ((thisField && !otherField) || (!thisField && otherField)) {
            isDifferent = true;
            diffContext[fieldName] = {
              type: 'field',
              diff: [thisField, otherField]
            };

            continue;
          } else {
            var diff = thisField.fieldPropDiff(otherField, opts);
            if (diff) {
              isDifferent = true;
              diffContext[fieldName] = {
                type: 'field',
                diff
              };
            }
          }
        }

        return (isDifferent) ? diffContext : undefined;
      }
    };
  }, undefined, {
    // Static properties
    FLAGS
  });

  root.export({
    generateModelMethods,
    ModelSchema
  });
};
