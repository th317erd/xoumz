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

  var depStr = await JE.sink(dep),
      userStr = await JE.sink(user);

  console.log('Dependent JSON: ', depStr);
  console.log('User JSON: ', userStr);

  dep = await JE.source(depStr, Dependent);
  user = await JE.source(userStr, User);

  console.log('Dependent: ', dep);
  console.log('User: ', user);
})();
