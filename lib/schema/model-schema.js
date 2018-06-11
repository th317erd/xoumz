module.exports = function(root, requireModule) {
  function getVersion(_opts, _version) {
    var opts = _opts || {},
        version = opts.version || _version;

    if (!version)
      version = this.currentVersion;

    return version;
  }

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

  const Schema = this.defineClass((ParentClass) => {
    return class Schema extends ParentClass {
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
    };
  });

  const ModelSchema = this.defineClass((ParentClass) => {
    return class ModelSchema extends ParentClass {
      constructor(schemaEngine, model, _opts) {
        if (!schemaEngine)
          throw new Error('"schemaEngine" argument required to create a ModelSchema');

        if (!model)
          throw new Error('"model" argument required to create a ModelSchema');

        var opts = _opts || {};

        definePropertyRW(this, '_options', opts);
        definePropertyRW(this, '_schemaEngine', schemaEngine);
        definePropertyRW(this, '_model', model);
        definePropertyRW(this, '_schemaDefinitions', {});
        definePropertyRW(this, '_currentVersion', 1);
        definePropertyRW(this, 'currentVersion', undefined, () => this._currentVersion, () => {});

        if (!opts.skipInitialize)
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

      primitive() {
        return (typeof this._model.primitive === 'function') ? this._model.primitive() : null;
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

      createDefaultOwnerField(Types, typeName, fieldName = 'owner') {
        return Types['OwnerScope'](Types[typeName]).field(fieldName).nullable(true);
      }

      createDefaultOwnerIDField({ String }, typeName, fieldName = 'owner') {
        return String.field(`${fieldName}ID`).nullable(true);
      }

      createDefaultOwnerTypeField({ String }, typeName, fieldName = 'owner') {
        return String.field(`${fieldName}Type`).nullable(true);
      }

      createDefaultOwnerOrderField({ Integer }, typeName, fieldName = 'owner') {
        return Integer.field(`${fieldName}Order`).nullable(true);
      }

      createDefaultOwnerFieldField({ String }, typeName, fieldName = 'owner') {
        return String.field(`${fieldName}Field`).nullable(true);
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

      iterateRawSchema(typeName, rawSchema, cb) {
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
              throw new Error(`${typeName} model: Field name not defined for a field`);
            }
          }

          cb.call(this, field, thisFieldName);
        }
      }

      runHostSchemaMutators(modelSchema, types, typeName, field, fieldName) {
        var mutators = field.getProp('schemaMutators');
        if (!mutators)
          return;

        var extraSchema = {};
        for (var i = 0, il = mutators.length; i < il; i++) {
          var mutator = mutators[i],
              thisRawSchema = mutator.call(this, types, typeName, field, fieldName, modelSchema);

          if (thisRawSchema) {
            this.iterateRawSchema(typeName, thisRawSchema, (field, thisFieldName) => {
              extraSchema[thisFieldName] = field;
            });
          }
        }

        return (noe(extraSchema)) ? undefined : extraSchema;
      }

      getRawSchema(types, typeName, rawSchema) {
        if (!rawSchema)
          throw new Error(`${typeName} model: Nothing returned from schema factory`);

        var defaultFields = this.getDefaultFields(this.primitive()),
            finalSchema = new Schema(this._schemaEngine, this._model);

        // Check that all field names are set
        this.iterateRawSchema(typeName, rawSchema, (field, fieldName) => {
          finalSchema[fieldName] = field;
        });

        // Ensure default fields are present
        for (var [ fieldName, fieldCreator ] of defaultFields) {
          if (!finalSchema[fieldName])
            finalSchema[fieldName] = fieldCreator.call(this, types, typeName);
        }

        // Run host schema mutators
        this.iterateRawSchema(typeName, rawSchema, (field, fieldName) => {
          var extraSchema = this.runHostSchemaMutators(finalSchema, types, typeName, field, fieldName);
          if (extraSchema)
            Object.assign(finalSchema, extraSchema);
        });

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
        definition.rawSchema = this.getRawSchema.call(this, types, typeName, definition.schema.call(this, types, typeName, (parentDefinition) ? Object.assign({}, parentDefinition.rawSchema) : null, parentDefinition));
        this._currentVersion = version;

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

      cloneWithVersion(_version) {
        var version = getVersion.call(this, null, _version),
            copy = new this.constructor(this._schemaEngine, this._model, Object.assign({}, this._options, { skipInitialize: true }));

        copy._schemaDefinitions = Object.assign({}, this._schemaDefinitions);
        copy._currentVersion = version;

        return copy;
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
    };
  }, undefined, {
    // Static properties
    FLAGS
  });

  root.export({
    ModelSchema
  });
};
