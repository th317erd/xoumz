describe('SchemaEngine', function() {
  beforeEach(function() {
    const { SchemaEngine } = this.app.Schema;
    const { User, Session } = this.app.Models;

    this.SchemaEngine = SchemaEngine;
    this.Session = Session;
    this.User = User;
  });

  it('should be able to get a model schema', async function(done) {
    var schemaEngine = this.app.getEngine('schema'),
        modelSchema = schemaEngine.getModelClass('User').getSchema();

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getRawSchema();

    expect(modelSchema.getModelName()).toBe('User');
    expect(modelSchema.getVersion()).toBe('DEV');
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();

    done();
  });

  it('should be able to get a versioned model schema', async function(done) {
    var schemaEngine = this.app.getEngine('schema', { version: 'v0.0.0'}),
        modelSchema = schemaEngine.getModelClass('User').getSchema();

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getRawSchema();

    expect(modelSchema.getModelName()).toBe('User');
    expect(modelSchema.getVersion()).toBe('v0.0.0');
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();

    done();
  });

  it('should be able to inherit from a model', async function(done) {
    const UserModel = this.User;

    const MyCustomUser = this.app.defineClass((UserModel) => {
      return class MyCustomUser extends UserModel {
        static schema(defineSchema) {
          return defineSchema(UserModel.schema, {
            schema: ({ String }, modelName, parentSchema) => {
              return Object.assign(parentSchema, {
                derp: String.nullable(false).size(24)
              });
            },
            demote: (model) => model,
            promote: (model) => model
          });
        }
      };
    }, UserModel);

    var schemaEngine = await this.app.createEngine(this.SchemaEngine, [
          this.Session,
          MyCustomUser
        ]),
        modelSchema = schemaEngine.getModelClass('MyCustomUser').getSchema();

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getRawSchema();

    expect(modelSchema.getModelName()).toBe('MyCustomUser');
    expect(definition.schema).toBeType(Function);
    expect(definition.demote).toBeType(Function);
    expect(definition.promote).toBeType(Function);
    expect(definition.rawSchema).toBeTruthy();
    expect(definition.rawSchema).not.toBeType(Array);

    expect(rawSchema.id).toBeTruthy();
    expect(rawSchema.createdAt).toBeTruthy();
    expect(rawSchema.updatedAt).toBeTruthy();

    done();
  });
});
