describe('Default Schema Types', function() {
  beforeEach(function() {
    const { SchemaEngine } = this.app.requireModule('./schema/schema-engine');
    const { ModelSchema } = this.app.requireModule('./schema/model-schema');

    this.SchemaEngine = SchemaEngine;
    this.ModelSchema = ModelSchema;

    this.schemaEngine = new SchemaEngine();
    this.userSchema = this.app.requireModule('./models/schemas/user');
  });

  it('should be able to define a model schema', function() {
    var modelSchema = new this.ModelSchema(this.schemaEngine, 'User', this.userSchema);

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
  });

  it('should be able to define a model schema that inherits from a parent schema', function() {
    var modelSchema = new this.ModelSchema(this.schemaEngine, 'User', (defineSchema) => {
      return defineSchema(this.userSchema, {
        schema: function({ String }, parentSchema) {
          return Object.assign(parentSchema, {
            'derp': String.maxLength(128).nullable(false)
          });
        },
        demote: (model) => model,
        promote: (model) => model
      });
    });

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
  });
});
