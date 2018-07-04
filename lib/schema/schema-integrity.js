module.exports = function(root, requireModule) {
  const { definePropertyRO } = requireModule('./base/utils');

  const SchemaIntegrity = this.defineClass((ParentClass) => {
    return class SchemaIntegrity extends ParentClass {
      constructor(schemaEngine, models, _opts) {
        var opts = _opts || {};
        super(opts);

        var integrity = {};
        definePropertyRO(this, '_options', opts);
        definePropertyRO(this, '_integrity', integrity);

        if (!models)
          return;

        var areModelSchemasDifferent = opts.areModelSchemasDifferent;
        if (typeof areModelSchemasDifferent !== 'function')
          areModelSchemasDifferent = this.areModelSchemasDifferent;

        for (var [ modelName, modelClass ] of models) {
          var schemaModelClass = schemaEngine.getModelClass(modelName);
          if (!schemaModelClass) {
            // missing
            integrity[modelName] = undefined;
            continue;
          }

          var modelSchema = schemaModelClass.getSchema(),
              diff = areModelSchemasDifferent.call(this, modelSchema, modelClass.getSchema(), opts);

          integrity[modelName] = diff;
        }
      }

      areModelSchemasDifferent(modelSchema1, modelSchema2, _opts) {
        var opts = Object.assign({
              diffFilter: (type, name, value1, value2) => {
                if (type === 'field')
                  return true;

                if (type === 'prop')
                  return !(name.match(/^(value|getter|setter|validators|schemaMutators)$/));

                if (type !== 'valueProp')
                  return true;

                if (typeof value1 === 'function' && typeof value2 === 'function')
                  return false;

                return (name !== 'value');
              }
            }, _opts || {});

        return modelSchema1.modelSchemaDiff(modelSchema2, opts);
      }

      getModelIntegrity(modelName) {
        return this._integrity[modelName];
      }

      isAddingFields(modelName) {
        var fieldsAdded = [];

        for (var [ thisModelName, integrity ] of this._integrity) {
          if (!integrity)
            continue;

          if (modelName && thisModelName !== modelName)
            continue;

          for (var [ fieldName, diff ] of integrity) {
            if (diff.type !== 'field')
              continue;

            if (diff.diff instanceof Array && diff.diff[1] == null)
              fieldsAdded.push((modelName) ? fieldName : { modelName: thisModelName, fieldName });
          }
        }

        return fieldsAdded;
      }

      isDroppingFields(modelName) {
        var fieldsDropped = [];

        for (var [ thisModelName, integrity ] of this._integrity) {
          if (!integrity)
            continue;

          if (modelName && thisModelName !== modelName)
            continue;

          for (var [ fieldName, diff ] of integrity) {
            if (diff.type !== 'field')
              continue;

            if (diff.diff instanceof Array && diff.diff[0] == null)
              fieldsDropped.push((modelName) ? fieldName : { modelName: thisModelName, fieldName });
          }
        }

        return fieldsDropped;
      }

      isCoercingFields(modelName) {
        var fieldsCoerced = [];

        for (var [ thisModelName, integrity ] of this._integrity) {
          if (!integrity)
            continue;

          if (modelName && thisModelName !== modelName)
            continue;

          for (var [ fieldName, diff ] of integrity) {
            if (diff.type !== 'field')
              continue;

            if (diff.diff instanceof Array)
              continue;

            fieldsCoerced.push((modelName) ? fieldName : { modelName: thisModelName, fieldName });
          }
        }

        return fieldsCoerced;
      }
    };
  });

  root.export({
    SchemaIntegrity
  });
};
