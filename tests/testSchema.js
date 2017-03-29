import { constructType, schemaRecordFactory } from '../lib/schema';
import { User } from './classes/User';

const RootSchema = schemaRecordFactory('Root', function(addField) {
  addField(User, 'User');
});

console.log('Final type: ', constructType(User, {test: 'Hello world!', dependents: []}));

module.exports = RootSchema;