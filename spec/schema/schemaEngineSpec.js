describe('SchemaEngine', function() {
  beforeEach(function() {
    const { SchemaEngine } = this.app.Schema;
    const { User, Session } = this.app.Models;

    this.SchemaEngine = SchemaEngine;
    this.Session = Session;
    this.User = User;
  });

  it('should be able to get a model schema', async function(done) {
    var schemaEngine = await this.app.createEngine(this.SchemaEngine, {
          Session: this.Session,
          User: this.User
        }),
        modelSchema = schemaEngine.getModelClass('User').getSchema();

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getSchema();

    expect(modelSchema.getTypeName()).toBe('User');
    expect(definition.version).toBe(1);
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

    class MyCustomUser extends UserModel {
      static schema(defineSchema) {
        return defineSchema(UserModel.schema, {
          schema: ({ String }, parentSchema) => {
            return Object.assign(parentSchema, {
              derp: String.nullable(false).maxLength(24)
            });
          },
          demote: (model) => model,
          promote: (model) => model
        });
      }
    }

    var schemaEngine = await this.app.createEngine(this.SchemaEngine, {
          Session: this.Session,
          User: MyCustomUser
        }),
        modelSchema = schemaEngine.getModelClass('User').getSchema();

    var definition = modelSchema.getSchemaDefinition(),
        rawSchema = modelSchema.getSchema();

    expect(modelSchema.getTypeName()).toBe('User');
    expect(definition.version).toBe(2);
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
