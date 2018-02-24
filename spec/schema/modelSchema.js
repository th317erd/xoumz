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
    var modelSchema = new this.ModelSchema(this.schemaEngine, { getTypeName: () => 'User', schema: this.userSchema });

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

    var idField;
    for (var [ fieldName, field ] of modelSchema) {
      if (fieldName === 'id')
        idField = field;
    }

    expect(idField).toBeTruthy();
  });

  it('should be able to define a model schema that inherits from a parent schema', function() {
    var modelSchema = new this.ModelSchema(this.schemaEngine, {
      getTypeName: () => 'User',
      schema: (defineSchema) => {
        return defineSchema(this.userSchema, {
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

    expect(definition.version).toBe(2);
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
      if (fieldName === 'derp')
        derpField = field;
    }

    expect(derpField).toBeFalsy();

    // Next get version 2
    for (var [ fieldName, field ] of modelSchema) {
      if (fieldName === 'derp')
        derpField = field;
    }

    expect(derpField).toBeTruthy();
  });
});
