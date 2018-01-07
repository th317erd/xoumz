const http = require('http'),
      https = require('https'),
      { URL } = require('url');

module.exports = function(root, requireModule) {
  const { definePropertyRW, StreamableToStream, noe } = requireModule('./utils');
  const Logger = requireModule('./logger');

  class HTTPServer {
    static createInstance(Klass, _opts) {
      var opts = _opts || {};

      if (opts.enabled === false) {
        Logger.info('Not creating HTTP server because config disables it');
        return false;
      }

      return new Klass(opts);
    }

    constructor(_opts) {
      var opts = Object.assign({
        host: 'localhost',
        port: 8080
      }, _opts || {});

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_server', null);
    }

    async onInit() {
    }

    getRouteEngine() {
      return this.getApplication().getRouteEngine();
    }

    getURLFromRequest(req) {
      var { https, host, port } = this.options,
          inputURL = `${(https) ? 'https' : 'http'}://${host}:${port}/${('' + req.url).replace(/^\//g, '')}`;

      return new URL(inputURL);
    }

    writeResponse(response, body, status, statusMessage, headers) {
      return new Promise((resolve, reject) => {
        response.writeHead(status, statusMessage, headers);

        if (body && (status !== 204 && status !== 304)) {
          var stream = (body.pipe instanceof Function && body.on instanceof Function) ? body : new StreamableToStream(body);

          stream.on('end', () => {
            response.end();
            resolve();
          }).on('error', (err) => {
            reject(err);
          }).pipe(response);
        } else {
          response.end();
        }
      });
    }

    async onRequest(request, response) {
      var url = this.getURLFromRequest(request),
          routeEngine = this.getRouteEngine(),
          route = routeEngine.selectRouteFromURL(url, request);

      if (route) {
        var ret = await route.execute(url, request);
        if (noe(ret))
          await this.writeResponse(response, '500 Internal Server Error', 500, 'Internal Server Error');
        else
          await this.writeResponse(response, ret, 200, 'OK');
      } else {
        await this.writeResponse(response, '404 Not Found', 404, 'Not Found');
      }
    }

    async onClose() {
      Logger.debug('HTTP server shutting down...');
    }

    async start() {
      var server = (this.options.https)
        ? https.createServer(this.options.https, this.onRequest.bind(this))
        : http.createServer(this.onRequest.bind(this));

      this._server = server;

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
