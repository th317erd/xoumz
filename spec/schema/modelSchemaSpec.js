describe('ModelSchema', function() {
  beforeEach(async function() {
    const { SchemaEngine, ModelSchema } = this.app.Schema;
    const { User, Session } = this.app.Models;

    class CustomUser extends User {
      static schema(defineSchema) {
        return defineSchema(User.schema, {
          schema: function({ User, Role, String, Date, Integer, Collection }, parent) {
            // Rename the "dob" field to "dateOfBirth"
            return Object.assign(parent, {
              dob: null,
              dateOfBirth: parent.dob.clone().field('dateOfBirth')
            });
          },
          demote: function(values, _opts) {
            // Properly demote
            return Object.assign(values, {
              dob: values.dateOfBirth
            });
          },
          promote: function(values, _opts) {
            // Properly promote
            return Object.assign(values, {
              dateOfBirth: values.dob
            });
          }
        });
      }
    }

    this.User = CustomUser;
    this.ModelSchema = ModelSchema;

    this.schemaEngine = await this.app.registerEngine(new SchemaEngine({
      Session,
      User: CustomUser
    }));
  });

  it('should be able to define a model schema', function() {
    var modelSchema = new this.ModelSchema(this.schemaEngine, { getTypeName: () => 'User', schema: this.User.schema });

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getSchema();

    expect(definition.version).toBe(2);
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();
    expect(rawSchema.dateOfBirth).toBeTruthy();
    expect(rawSchema.dob).toBeFalsy();

    var idField;
    for (var [ fieldName, field ] of modelSchema) {
      if (fieldName === 'id') {
        idField = field;
        break;
      }
    }

    expect(idField).toBeTruthy();
  });

  it('should be able to define a model schema and get different versions', function() {
    var modelSchema = new this.ModelSchema(this.schemaEngine, { getTypeName: () => 'User', schema: this.User.schema });

    // Clone specific schema model version
    modelSchema = modelSchema.cloneWithVersion(1);

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getSchema();

    expect(definition.version).toBe(1);
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();
    expect(rawSchema.dateOfBirth).toBeFalsy();
    expect(rawSchema.dob).toBeTruthy();

    var idField;
    for (var [ fieldName, field ] of modelSchema) {
      if (fieldName === 'id') {
        idField = field;
        break;
      }
    }

    expect(idField).toBeTruthy();
  });

  it('should be able to define a model schema that inherits from a parent schema', function() {
    var modelSchema = new this.ModelSchema(this.schemaEngine, {
      getTypeName: () => 'User',
      schema: (defineSchema) => {
        return defineSchema(this.User.schema, {
          schema: function({ String }, parentSchema) {
            return Object.assign(parentSchema, {
              'derp': String.maxLength(128).nullable(false)
            });
          },
          demote: (model) => model,
          promote: (model) => model
        });
      }
    });

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getSchema();

    expect(definition.version).toBe(3);
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();

    var derpField;

    // First get version 1
    for (var [ fieldName, field ] of modelSchema.entries({ version: 1 })) {
      if (fieldName === 'derp') {
        derpField = field;
        break;
      }
    }

    expect(derpField).toBeFalsy();

    // Next get current version (3)
    for (var [ fieldName, field ] of modelSchema) {
      if (fieldName === 'derp') {
        derpField = field;
        break;
      }
    }

    expect(derpField).toBeTruthy();
  });
});
