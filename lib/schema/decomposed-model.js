module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./base/utils');

  const DecomposedModel = this.defineClass((ParentClass) => {
    return class DecomposedModel extends ParentClass {
      constructor(data, _opts) {
        super();

        var opts = Object.assign({}, _opts || {});

        if (!opts.schema)
          throw new Error('"schema" key is required to instantiate a decomposed model');

        definePropertyRW(this, '_options', opts);

        Object.assign(this, data);
      }

      getModelName() {
        return this._options.schema;
      }

      getModelName() {
        return this.getModelName().getModelName();
      }

      // getInfo(context) {
      //   var modelClass = this.getModelName(),
      //       modelName = this.getModelName(),
      //       primaryKeyFieldName = this.getPrimaryKeyFieldName(context),
      //       value = this.getValue(),
      //       model = this.getModel();

      //   return {
      //     modelClass,
      //     modelName,
      //     primaryKeyFieldName,
      //     primaryKey: modelClass.retrievePrimaryKeyValue(value),
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

  //       var { modelClass, modelName, value, primaryKey } = decomposedModel.getInfo();
  //       if (noe(modelClass, value, modelName, primaryKey))
  //         continue;

  //       var key = `${modelName}:${primaryKey}`;
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
  //           { primaryKey, modelName } = decomposedModel.getInfo(context),
  //           thisID = `${modelName}:${primaryKey}`;

  //       modelMap[thisID] = decomposedModel;
  //     }

  //     // Stitch models together
  //     for (var i = 0, il = decomposedModels.length; i < il; i++) {
  //       var decomposedModel = decomposedModels[i],
  //           { modelClass, value, primaryKey, modelName } = decomposedModel.getInfo(context),
  //           thisID = `${modelName}:${primaryKey}`;

  //       // if (!modelClass.retrieveOwnerIDValue(value)) {
  //       //   finalModels.push(value);
  //       //   continue;
  //       // }

  //       var parentPrimaryKey = modelClass.retrieveOwnerIDValue(value);
  //       if (parentPrimaryKey) {
  //         var parentType = modelClass.retrieveOwnerTypeValue(value),
  //             thisParentPrimaryKey = `${parentType}:${parentPrimaryKey}`,
  //             decomposedModelValue = modelMap[thisParentPrimaryKey],
  //             parentModel = (decomposedModelValue && decomposedModelValue.getValue()),
  //             parentField = modelClass.retrieveOwnerFieldValue(value);

  //         if (!parentModel)
  //           throw new Error(`Connector (${this.context}) error: Can not stitch model "${primaryKey}" of type ${modelClass.getModelName()}: Parent not found`);

  //         if (noe(parentField))
  //           throw new Error(`Connector (${this.context}) error: Can not stitch model "${primaryKey}" of type ${modelClass.getModelName()}: Parent field not found`);

  //         var list = getProp(parentModel, parentField, []),
  //             ownerFieldName = modelClass.getOwnerFieldName();

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
