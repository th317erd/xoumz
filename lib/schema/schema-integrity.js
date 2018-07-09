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

        for (var [ resouceName, modelClass ] of models) {
          var schemaModelClass = schemaEngine.getModelClass(resouceName);
          if (!schemaModelClass) {
            // missing
            integrity[resouceName] = undefined;
            continue;
          }

          var modelSchema = schemaModelClass.getSchema(),
              diff = areModelSchemasDifferent.call(this, modelSchema, modelClass.getSchema(), opts);

          integrity[resouceName] = diff;
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

      getModelIntegrity(resouceName) {
        return this._integrity[resouceName];
      }

      isAddingFields(resouceName) {
        var fieldsAdded = [];

        for (var [ thisResourceName, integrity ] of this._integrity) {
          if (!integrity)
            continue;

          if (resouceName && thisResourceName !== resouceName)
            continue;

          for (var [ fieldName, diff ] of integrity) {
            if (diff.type !== 'field')
              continue;

            if (diff.diff instanceof Array && diff.diff[1] == null)
              fieldsAdded.push((resouceName) ? fieldName : { resouceName: thisResourceName, fieldName });
          }
        }

        return fieldsAdded;
      }

      isDroppingFields(resouceName) {
        var fieldsDropped = [];

        for (var [ thisResourceName, integrity ] of this._integrity) {
          if (!integrity)
            continue;

          if (resouceName && thisResourceName !== resouceName)
            continue;

          for (var [ fieldName, diff ] of integrity) {
            if (diff.type !== 'field')
              continue;

            if (diff.diff instanceof Array && diff.diff[0] == null)
              fieldsDropped.push((resouceName) ? fieldName : { resouceName: thisResourceName, fieldName });
          }
        }

        return fieldsDropped;
      }

      isCoercingFields(resouceName) {
        var fieldsCoerced = [];

        for (var [ thisResourceName, integrity ] of this._integrity) {
          if (!integrity)
            continue;

          if (resouceName && thisResourceName !== resouceName)
            continue;

          for (var [ fieldName, diff ] of integrity) {
            if (diff.type !== 'field')
              continue;

            if (diff.diff instanceof Array)
              continue;

            fieldsCoerced.push((resouceName) ? fieldName : { resouceName: thisResourceName, fieldName });
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
