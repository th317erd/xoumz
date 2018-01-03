const http = require('http'),
      https = require('https');

module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const Logger = requireModule('./logger');

  class HTTPServer {
    constructor(_opts) {
      var opts = Object.assign({
        port: 8080
      }, _opts || {});

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_server', null);
    }

    async onInit() {
    }

    onRequest(req, res) {
      res.write('Hello World!');
      res.end();
    }

    async onClose() {
      Logger.debug('HTTP server shutting down...');
    }

    async start() {
      var server = this._server = (this.options.https)
        ? https.createServer(this.options.https, this.onRequest.bind(this))
        : http.createServer(this.onRequest.bind(this));

      server.on('clientError', (error, socket) => {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      });

      server.listen(this.options.port);
    }

    async stop() {
      await new Promise((resolve, reject) => {
        this._server.close(async (...args) => {
          try {
            this.onClose.call(this, ...args);
            resolve();
          } catch (e) {
            Logger.error(e);
            reject(e);
          }
        });
      });
    }
  }

  Object.assign(root, {
    HTTPServer
  });
};

//table / bucket
