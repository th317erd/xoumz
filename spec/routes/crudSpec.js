const request = require('request');

describe('Routes', function() {
  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  describe('External functionality', function() {
    it('should be able to use REST POST via CRUD routes to create a model', function(done) {
      var httpServer = this.app.getHTTPServer(),
          origin = httpServer.getOriginURL();

      // Request via REST the creation of a Test model
      request({
        url: `${origin}/test`,
        method: 'POST',
        json: true,
        body: {
          'string': 'test:string',
          'integer': 65756755,
          'boolean': true,
          'stringArray': ['hello', 'world', 'this', 'is', 'a', 'test'],
          'integerArray': [1, 2, 3, 4, 5]
        }
      }, async (err, response, body) => {
        expect([null, undefined]).toContain(err);
        expect(response.statusCode).toBe(201);
        expect(body.body).toBeTruthy();

        // See if create response is what we expect
        var body = body.body;
        expect(body.id).toBeValidID('Test');
        expect(body.string).toBe('test:string');
        expect(body.createdAt).toBeValidISODate();
        expect(body.updatedAt).toBeValidISODate();
        expect(body.date).toBeValidISODate();
        expect(body.integer).toBe(65756755);
        expect(body.boolean).toBe(true);

        expect(body.stringArray[0]).toBe('hello');
        expect(body.stringArray[1]).toBe('world');
        expect(body.stringArray[2]).toBe('this');
        expect(body.stringArray[3]).toBe('is');
        expect(body.stringArray[4]).toBe('a');
        expect(body.stringArray[5]).toBe('test');

        expect(body.integerArray[0]).toBe(1);
        expect(body.integerArray[1]).toBe(2);
        expect(body.integerArray[2]).toBe(3);
        expect(body.integerArray[3]).toBe(4);
        expect(body.integerArray[4]).toBe(5);

        // Now attempt to load model that was just created
        var model = await this.app.where('Test').field('id').equals(body.id).first;
        expect(model).toBeTruthy();
        expect(model.id).toBe(body.id);
        model = null;

        done();
      });
    });
  });
});
