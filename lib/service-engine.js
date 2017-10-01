
class ServiceEngine {
  constructor() {

  }

  getServiceName() {}

  serialize(model) {
    function getModelForSerializing(model) {
      var obj = {},
          fields = model.schema(this.getServiceName()).fields();
      
      for (var i = 0, il = fields.length; i < il ; i++) {
        var field = fields[i];
        obj[field.field] = self.fieldValue(model, field.key);
      }
        
      return obj;
    }

    var serializeFunc = model.serialize,
        self = this,
        serializable = getModelForSerializing(model);

    if (serializeFunc instanceof Function)
      return serializeFunc.call(this, serializable);
    
    return JSON.stringify(serializable);
  }

  initializeModel(model, data) {
    var fields = model.getSchema().fields();
    for (var i = 0, il = fields.length; i < il ; i++) {
      var field = fields[i];
      self.fieldValue(model, field.key, data[field.field]);
    };

    return model;
  }

  unserialize(rawData, modelClass) {
    var obj = JSON.parse(rawData),
        unserializeFunc = modelClass.unserialize,
        self = this;

    if (unserializeFunc instanceof Function)
      return unserializeFunc.call(this, rawData);
    
    var model = new modelClass();
    return this.initializeModel(model, obj);
  }
}

module.exports = Object.assign(module.exports, {
  ServiceEngine
});
