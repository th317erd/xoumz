import { schemaRecordFactory, TypeWrapper } from '../../lib/schema';

const User = schemaRecordFactory('User', function(addField) {
  addField(String, 'test', function() {
    this.validator = 'test';
  });

  addField([this], 'dependents');
  addField(this, 'parent');
}, {
  init: function() {
    
  }
});

module.exports = Object.assign(module.exports, {
  User
});
