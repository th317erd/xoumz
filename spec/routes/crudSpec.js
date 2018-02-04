const request = require('request');

describe('Routes', function() {
  describe('Internal functionality', function() {
    // TODO: Add more internal stress testing
  });

  describe('External functionality', function() {
    it('should be able to use REST POST via CRUD routes to create a model', function(done) {
      var httpServer = this.app.getHTTPServer(),
          origin = httpServer.getOriginURL();

      request({
        url: `${origin}/test`,
        method: 'POST',
        json: true,
        body: {

        }
      }, function(err, response, body) {
        expect([null, undefined]).toContain(err);
        expect(response.statusCode).toBe(201);
        expect(body.body).toBeTruthy();
        expect(body.body.id).toMatch(/^Test:[a-f0-9-]+$/);
        done();
      });
    });
  });
});
