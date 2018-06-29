describe('ModelSchema', function() {
  beforeEach(async function() {
    const { SchemaEngine, ModelSchema } = this.app.Schema;
    const { User, Session } = this.app.Models;

    const CustomUser = this.app.defineClass((User) => {
      return class CustomUser extends User {
        static schema(defineSchema) {
          return defineSchema(User.schema, {
            schema: function({ User, Role, String, Date, Integer, Collection }, modelName, parentSchema) {
              // Rename the "dob" field to "dateOfBirth"
              return Object.assign(parentSchema, {
                dob: null,
                dateOfBirth: parentSchema.dob.clone().field('dateOfBirth')
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

        static getModelName() {
          return 'User';
        }
      };
    }, User);

    this.User = CustomUser;
    this.ModelSchema = ModelSchema;

    this.schemaEngine = await this.app.registerEngine(new SchemaEngine([
      Session,
      CustomUser
    ]));
  });

  it('should be able to define a model schema', function() {
    var modelSchema = new this.ModelSchema(this.User);

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getRawSchema();

    expect(modelSchema.getVersion()).toBe('DEV');
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
    var modelSchema = new this.ModelSchema(this.User);

    // Clone specific schema model version
    modelSchema = modelSchema.getVersioned('v0.0.0');

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getRawSchema(),
        version = modelSchema.getVersion();

    expect(version).toBe('v0.0.0');
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
    var parentUserSchema = this.User.schema,
        modelSchema = new this.ModelSchema(this.app.defineClass((ModelBase) => {
          return class User extends ModelBase {
            static schema(defineSchema) {
              return defineSchema(parentUserSchema, {
                schema: function({ String }, modelName, parentSchema) {
                  return Object.assign(parentSchema, {
                    'derp': String.maxLength(128).nullable(false)
                  });
                },
                demote: (model) => model,
                promote: (model) => model
              });
            }
          };
        }, this.app.Models.ModelBase));

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getRawSchema();

    expect(modelSchema.getVersion()).toBe('DEV');
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();

    var derpField;

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
