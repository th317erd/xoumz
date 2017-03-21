import { schemaRecordFactory } from '../../lib/schema';

const User = schemaRecordFactory('User', function(addField) {
  addField(String, 'test', function() {
    this.validator('test');
  });

  addField(String, 'dependent');
}, {
  init: function() {
    
  }
});

module.exports = Object.assign(module.exports, {
  User
});
