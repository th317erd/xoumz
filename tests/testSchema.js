import { constructType, schemaRecordFactory } from '../lib/schema';
import { User } from './schema';

var user = new User(),
    childUser = new User();

user.owner = user;
childUser.owner = user;

console.log('User type: ', user.toString());
console.log('Child type: ', childUser.toString());