module.exports = function(root, requireModule) {
  const { definePropertyRW, getProp, setProp, noe } = requireModule('./base/utils');

  const DecomposedModel = this.defineClass((ParentClass) => {
    return class DecomposedModel extends ParentClass {
      constructor(data, _opts) {
        var opts = Object.assign({}, _opts || {});

        if (!opts.schema)
          throw new Error('"schema" key is required to instantiate a decomposed model');

        definePropertyRW(this, '_options', opts);

        Object.assign(this, data);
      }

      getModelType() {
        return this._options.schema;
      }

      getTypeName() {
        return this.getModelType().getTypeName();
      }

      // getInfo(context) {
      //   var modelType = this.getModelType(),
      //       typeName = this.getTypeName(),
      //       primaryKeyFieldName = this.getPrimaryKeyFieldName(context),
      //       value = this.getValue(),
      //       model = this.getModel();

      //   return {
      //     modelType,
      //     typeName,
      //     primaryKeyFieldName,
      //     primaryKey: modelType.retrievePrimaryKeyValue(value),
      //     value,
      //     model
      //   };
      // }
    };
  });

  // class DecomposedModelCollection extends Array {
  //   static from(arr) {
  //     if (!arr || !arr.length)
  //       return new DecomposedModelCollection();

  //     var collection = new DecomposedModelCollection(arr.length);
  //     for (var i = 0, il = arr.length; i < il; i++)
  //       collection[i] = arr[i];

  //     return collection;
  //   }

  //   buildMap() {
  //     var models = {};

  //     // Build a map of decomposed models
  //     for (var i = 0, il = this.length; i < il; i++) {
  //       var decomposedModel = this[i];
  //       if (!decomposedModel)
  //         continue;

  //       var { modelType, typeName, value, primaryKey } = decomposedModel.getInfo();
  //       if (noe(modelType, value, typeName, primaryKey))
  //         continue;

  //       var key = `${typeName}:${primaryKey}`;
  //       models[key] = decomposedModel;
  //     }

  //     return models;
  //   }

  //   stitch(_opts) {
  //     if (!this.length)
  //       return [];

  //     var opts = _opts || {},
  //         context = opts.context,
  //         decomposedModels = this,
  //         modelMap = {},
  //         parentModels = {};

  //     // Generate a map of all models
  //     for (var i = 0, il = decomposedModels.length; i < il; i++) {
  //       var decomposedModel = decomposedModels[i],
  //           { primaryKey, typeName } = decomposedModel.getInfo(context),
  //           thisID = `${typeName}:${primaryKey}`;

  //       modelMap[thisID] = decomposedModel;
  //     }

  //     // Stitch models together
  //     for (var i = 0, il = decomposedModels.length; i < il; i++) {
  //       var decomposedModel = decomposedModels[i],
  //           { modelType, value, primaryKey, typeName } = decomposedModel.getInfo(context),
  //           thisID = `${typeName}:${primaryKey}`;

  //       // if (!modelType.retrieveOwnerIDValue(value)) {
  //       //   finalModels.push(value);
  //       //   continue;
  //       // }

  //       var parentPrimaryKey = modelType.retrieveOwnerIDValue(value);
  //       if (parentPrimaryKey) {
  //         var parentType = modelType.retrieveOwnerTypeValue(value),
  //             thisParentPrimaryKey = `${parentType}:${parentPrimaryKey}`,
  //             decomposedModelValue = modelMap[thisParentPrimaryKey],
  //             parentModel = (decomposedModelValue && decomposedModelValue.getValue()),
  //             parentField = modelType.retrieveOwnerFieldValue(value);

  //         if (!parentModel)
  //           throw new Error(`Connector (${this.context}) error: Can not stitch model "${primaryKey}" of type ${modelType.getTypeName()}: Parent not found`);

  //         if (noe(parentField))
  //           throw new Error(`Connector (${this.context}) error: Can not stitch model "${primaryKey}" of type ${modelType.getTypeName()}: Parent field not found`);

  //         var list = getProp(parentModel, parentField, []),
  //             ownerFieldName = modelType.getOwnerFieldName();

  //         if (!noe(ownerFieldName))
  //           value[ownerFieldName] = parentModel;

  //         list.push(value);
  //         setProp(parentModel, parentField, list);
  //       } else {
  //         parentModels[thisID] = decomposedModel;
  //       }
  //     }

  //     return { models: modelMap, parents: parentModels };
  //   }
  // }

  root.export({
    DecomposedModel
  });
};
