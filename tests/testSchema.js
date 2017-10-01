import Schema from './schema';
import { User, Dependent } from './models';

(async function(t) {
  var dep = new Dependent(),
      user = new User();

  user.firstName = 'Derp';
  user.lastName = 'Bro';

  dep.firstName = 'Whoa';
  dep.lastName = 'Dude';
  
  console.log('Dependent schema: ', Dependent.schema());
  console.log('User schema: ', User.schema());

  var depStr = Dependent.schema('json').serialize(dep),
      userStr = User.schema('json').serialize(user);

  console.log('Dependent JSON: ', depStr);
  console.log('User JSON: ', userStr);

  dep = Dependent.schema('json').unserialize(depStr);
  user = User.schema('json').unserialize(userStr);

  console.log('Dependent: ', dep);
  console.log('User: ', user);
})();
