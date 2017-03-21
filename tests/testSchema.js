import { schemaRecordFactory } from '../lib/schema';
import { User } from './classes/User';

const RootSchema = schemaRecordFactory('Root', function(addField) {
  addField(User, 'User');
});

console.log('Root schema: ', RootSchema.schema.User.type.schema);

module.exports = RootSchema;