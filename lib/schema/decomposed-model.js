module.exports = function(root, requireModule) {
  const { definePropertyRW, getProp, setProp, noe } = requireModule('./base/utils');

  class DecomposedModel {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      if (!opts.modelType)
        throw new Error('modelType key is required to instantiate a decomposed model');

      definePropertyRW(this, 'options', opts);
    }

    getModelType() {
      return this.options.modelType;
    }

    getTypeName() {
      return this.getModelType().getTypeName();
    }

    getModel() {
      return this.options.model;
    }

    getValue() {
      return this.options.value || {};
    }

    getPrimaryKeyFieldName(context) {
      var modelType = this.getModelType(),
          primaryKeyFieldName = modelType.getFieldProp(modelType.getPrimaryKeyField(), 'field', { context });

      if (!primaryKeyFieldName)
        throw new Error(`Connector (${context}) error: Can not read data: primary key for type ${modelType.getTypeName()} is unknown or invalid`);

      return primaryKeyFieldName;
    }

    getInfo(context) {
      var modelType = this.getModelType(),
          typeName = this.getTypeName(),
          primaryKeyFieldName = this.getPrimaryKeyFieldName(context),
          value = this.getValue(),
          model = this.getModel();

      return {
        modelType,
        typeName,
        primaryKeyFieldName,
        primaryKey: modelType.retrievePrimaryKeyValue(value),
        value,
        model
      };
    }
  }

  class DecomposedModelCollection extends Array {
    buildMap() {
      var models = {};

      // Build a map of decomposed models
      for (var i = 0, il = this.length; i < il; i++) {
        var decomposedModel = this[i];
        if (!decomposedModel)
          continue;

        var { modelType, typeName, value, primaryKey } = decomposedModel.getInfo();
        if (noe(modelType, value, typeName, primaryKey))
          continue;

        var key = `${typeName}:${primaryKey}`;
        models[key] = decomposedModel;
      }

      return models;
    }

    stitch(_opts) {
      if (!this.length)
        return [];

      var opts = _opts || {},
          context = opts.context,
          decomposedModels = this,
          modelMap = {},
          parentModels = {};

      // Generate a map of all models
      for (var i = 0, il = decomposedModels.length; i < il; i++) {
        var decomposedModel = decomposedModels[i],
            { value, primaryKey, typeName } = decomposedModel.getInfo(context),
            thisID = `${typeName}:${primaryKey}`;

        modelMap[thisID] = value;
      }

      // Stitch models together
      for (var i = 0, il = decomposedModels.length; i < il; i++) {
        var decomposedModel = decomposedModels[i],
            { modelType, value, primaryKey, typeName } = decomposedModel.getInfo(context),
            thisID = `${typeName}:${primaryKey}`;

        // if (!modelType.retrieveOwnerIDValue(value)) {
        //   finalModels.push(value);
        //   continue;
        // }

        var parentPrimaryKey = modelType.retrieveOwnerIDValue(value);
        if (parentPrimaryKey) {
          var parentType = modelType.retrieveOwnerTypeValue(value),
              thisParentPrimaryKey = `${parentType}:${parentPrimaryKey}`,
              parentModel = modelMap[thisParentPrimaryKey],
              parentField = modelType.retrieveOwnerFieldValue(value);

          if (!parentModel)
            throw new Error(`Connector (${this.context}) error: Can not stitch model "${primaryKey}" of type ${modelType.getTypeName()}: Parent not found`);

          if (noe(parentField))
            throw new Error(`Connector (${this.context}) error: Can not stitch model "${primaryKey}" of type ${modelType.getTypeName()}: Parent field not found`);

          var list = getProp(parentModel, parentField, []),
              ownerFieldName = modelType.getOwnerFieldName();

          if (!noe(ownerFieldName))
            value[ownerFieldName] = parentModel;

          list.push(value);
          setProp(parentModel, parentField, list);
        } else {
          parentModels[thisID] = value;
        }
      }

      return { models: modelMap, parents: parentModels };
    }
  }

  Object.assign(root, {
    DecomposedModel,
    DecomposedModelCollection
  });
};
