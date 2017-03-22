import { schemaRecordFactory } from '../../lib/schema';

const User = schemaRecordFactory('User', function(addField) {
  addField(String, 'test', function() {
    this.validator = 'test';
  });

  addField([String], 'dependents');
  addField(this, 'parent');
}, {
  init: function() {
    
  }
});

module.exports = Object.assign(module.exports, {
  User
});
