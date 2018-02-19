


(async function main() {
  // var a = { derp: 'test' };
  // for (var [ key, value ] of a)
  //   console.log(key, value);

  // var a = new NumberType('545.3453'),
  //     b = a.valueOf();

  // debugger;
  // console.log(typeof b);

  var T = new Chainable({ derp: 'stuff', things: 'n stuff', bool: true, int: 6456 }),
      a = { derp: 'stuff', bool: true, hello: 'world' },
      b = [ 'stuff', true, 'world' ],
      c = T.test.derp.required('derp').stuff.yes.context('test').c_stuff.c_me.c_please;

})();
