import { SelectorEngine } from './selector-engine';
import { definePropertyRW } from './utils';

class ServiceEngine extends SelectorEngine {
  constructor(schema) {
    super();

    definePropertyRW(this, '_schema', schema);
  }

  create(...args) {
    return super.create.apply(this, args);
  }

  // getSchema(model) {
  //   return model.getSchema(this.getServiceName());
  // }

  // getServiceName() {}

  // initializeModel(model, data) {
  //   var schema = this.getSchema(model),
  //       fields = schema.fields();

  //   for (var i = 0, il = fields.length; i < il ; i++) {
  //     var field = fields[i];
  //     schema.fieldValue(model, field.key, data[field.field]);
  //   };

  //   return model;
  // }

  // async serialize(model) {
  //   function getModelForSerializing(model) {
  //     var obj = {},
  //         schema = self.getSchema(model),
  //         fields = schema.fields();
      
  //     for (var i = 0, il = fields.length; i < il ; i++) {
  //       var field = fields[i];
  //       obj[field.field] = schema.fieldValue(model, field.key);
  //     }
        
  //     return obj;
  //   }

  //   var serializeFunc = model.serialize,
  //       self = this,
  //       serializable = getModelForSerializing(model);

  //   if (serializeFunc instanceof Function)
  //     return serializeFunc.call(this, serializable);
    
  //   return JSON.stringify(serializable);
  // }

  // async unserialize(rawData, modelClass) {
  //   var obj = JSON.parse(rawData),
  //       unserializeFunc = modelClass.unserialize,
  //       self = this;

  //   if (unserializeFunc instanceof Function)
  //     return unserializeFunc.call(this, rawData);
    
  //   var model = new modelClass();
  //   return this.initializeModel(model, obj);
  // }


}

module.exports = Object.assign(module.exports, {
  ServiceEngine
});
