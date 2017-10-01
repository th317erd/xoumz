import Schema from './schema';
import { User, Dependent } from './models';
import { JSONEngine } from './engines';

(async function(t) {
  var dep = new Dependent(),
      user = new User(),
      JE = new JSONEngine();

  user.firstName = 'Derp';
  user.lastName = 'Bro';

  dep.firstName = 'Whoa';
  dep.lastName = 'Dude';
  
  console.log('Dependent schema: ', Dependent.schema());
  console.log('User schema: ', User.schema());

  var depStr = Dependent.schema(JE).serialize(dep),
      userStr = User.schema(JE).serialize(user);

  console.log('Dependent JSON: ', depStr);
  console.log('User JSON: ', userStr);

  dep = Dependent.schema(JE).unserialize(depStr);
  user = User.schema(JE).unserialize(userStr);

  console.log('Dependent: ', dep);
  console.log('User: ', user);
})();
