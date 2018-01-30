module.exports = function(root, requireModule) {
  const { definePropertyRW, sizeOf, setProp, prettify } = requireModule('./utils');

  // TODO: Needs to properly fetch a schema engine
  // TODO: Needs to properly shutdown schema engines

  class SchemaValidationReport {
    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'schema', {});
      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, 'connector', undefined, () => opts.connector, () => {});
      definePropertyRW(this, 'schemaEngine', undefined, () => opts.schemaEngine, () => {});
      definePropertyRW(this, 'valid', undefined, () => !sizeOf(this.schema), () => {});
    }

    getReportLog() {
      if (this.valid)
        return;

      var parts = [`Error: ${this.connector.getContext()} connector failed schema validation:\n`];

      var schema = this.schema,
          schemaKeys = Object.keys(schema);

      for (var i = 0, il = schemaKeys.length; i < il; i++) {
        var schemaKey = schemaKeys[i],
            val = schema[schemaKey];

        parts.push(`  Model ${schemaKey} - ${prettify(val.action)}\n`);

        var modelSchema = val.value,
            modelSchemaKeys = Object.keys(modelSchema);

        for (var j = 0, jl = modelSchemaKeys.length; j < jl; j++) {
          var propKey = modelSchemaKeys[j],
              prop = modelSchema[propKey];

          parts.push(`    Field ${propKey} - ${prettify(prop.action)}\n`);
        }
      }

      parts.push('\n');

      return parts.join('');
    }

    generateMigration() {
      return `
      Logger.debug('Migrating ${this.connector.getContext()} connector!');
      await app.getConnector('${this.connector.getContext()}').migrate(this.getSchemaEngine(), {});
      `;
    }

    addToReport(what, type, name, native, foreign, nativeParent, foreignParent) {
      var schema = this.schema;

      if (what === 'extra')
        return false;

      if (type === 'field') {
        var targetTypeNames = native.getTargetTypeName(),
            isSpecial = (targetTypeNames instanceof Array);

        if (isSpecial)
          return false;

        if (native.getProp('virtual'))
          return false;
      }

      if (type === 'model') {
        setProp(schema, `${name}.action`, what);
        if (what === 'missing')
          setProp(schema, `${name}.value`, native);

        return;
      }

      var modelType = (type === 'field') ? nativeParent : nativeParent.getModelType();
      if (!modelType)
        return;

      var modelTypeName = modelType.getTypeName(),
          field = (type === 'field') ? native : nativeParent,
          fieldName = field.getProp('field', this.connector.getContext());

      if (fieldName.charAt(0) === '_')
        return false;

      if (type === 'prop') {
        setProp(schema, `${modelTypeName}.value.${fieldName}.value.${name}`, {
          action: what,
          value: native
        });
      } else {
        setProp(schema, `${modelTypeName}.value.${fieldName}.action`, what);
        if (what === 'missing')
          setProp(schema, `${modelTypeName}.value.${fieldName}.value`, native);
      }
    }

    static fromDatabaseSchema(connector, schemaEngine, rawDatabaseSchema) {
      var report = new SchemaValidationReport({
        connector,
        schemaEngine
      });

      schemaEngine.compareTo(rawDatabaseSchema, report.addToReport.bind(report));

      return report;
    }
  }

  Object.assign(root, {
    SchemaValidationReport
  });
};
