const http = require('http'),
      https = require('https'),
      { URL } = require('url'),
      Buffer = require('safe-buffer').Buffer,
      Busboy = require('busboy'),
      fs = require('fs'),
      path = require('path');

const ACCEPTABLE_ENCODINGS = ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'latin1', 'binary', 'hex'];

module.exports = function(root, requireModule) {
  const { definePropertyRW, StreamableToStream, instanceOf, getProp, setProp } = requireModule('./utils');
  const Logger = requireModule('./logger');
  const { HTTPResponse } = requireModule('./http/response');
  const { ContentTypeText, ContentTypeFile, ContentTypeJSON } = requireModule('./content-type');

  function statusCodeToMessage(status, fallbackMessage) {
    var codes = {
          200: 'OK',
          400: 'Bad Request',
          404: 'Not Found',
          413: 'Request Entity Too Large',
          500: 'Internal Server Error'
        },
        code = codes[status];

    return (!code) ? fallbackMessage : code;
  }

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
        port: 8080,
        maxBodySize: (1024 * 1024) * 10,
        maxFileSize: (1024 * 1024) * 25,
        maxFieldSize: (1024 * 1024) * 1,
        uploadPath: '/tmp'
      }, _opts || {});

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_server', null);
    }

    async onStart() {
    }

    statusCodeToMessage(...args) {
      return statusCodeToMessage(...args);
    }

    throwError(status, fallbackMessage) {
      var message = this.statusCodeToMessage(status, fallbackMessage),
          error = new Error(message);

      error.statusCode = status;

      throw error;
    }

    formatErrorToBody(error, fallbackStatusCode) {
      var status = error.statusCode || fallbackStatusCode;

      return `${status} - ${error.message}`;
    }

    errorResponse(_message, _statusCode) {
      var message = _message,
          statusCode = _statusCode;

      if (message instanceof Error) {
        if (message.statusCode)
          statusCode = message.statusCode;

        message = this.formatErrorToBody(message, statusCode);
      }

      return new HTTPResponse(new ContentTypeText(message), {
        statusCode
      });
    }

    getRouteEngine() {
      return this.getApplication().getRouteEngine();
    }

    getURLFromRequest(req) {
      var { https, host, port } = this.options,
          inputURL = `${(https) ? 'https' : 'http'}://${host}:${port}/${('' + req.url).replace(/^\//g, '')}`;

      return new URL(inputURL);
    }

    writeResponse(serverResponse, routeResponse) {
      return new Promise((resolve, reject) => {
        serverResponse.writeHead(
          routeResponse.statusCode,
          this.statusCodeToMessage(routeResponse.statusCode, 200),
          routeResponse.headers
        );

        if (routeResponse.statusCode !== 204 && routeResponse.statusCode !== 304) {
          var data = routeResponse.body.data,
              stream = (instanceOf(data, 'stream')) ? data : new StreamableToStream(data);

          stream.on('end', () => {
            serverResponse.end();
            resolve();
          }).on('error', (err) => {
            reject(err);
          }).pipe(serverResponse);
        } else {
          serverResponse.end();
        }
      });
    }

    parseFormDataRequest(request) {
      var uploadPath = this.options.uploadPath;

      return new Promise((resolve, reject) => {
        var data = {},
            busboy = new Busboy({
              headers: request.headers,
              limits: {
                fieldSize: this.options.maxFieldSize,
                fileSize: this.options.maxFileSize
              }
            });

        busboy.on('file', (fieldName, file, fileName, contentEncoding, mimeType) => {
          if (!uploadPath) {
            Logger.info('Aborting file upload because no "uploadPath" is specified on the HTTP Server options');
            return;
          }

          var safeFileName = fileName.replace(/\.\.[\/\\]/g, 'x'),
              encoding = ((('' + contentEncoding).match(/^(8bit|7bit|binary)$/i)) ? 'binary' : ('' + contentEncoding)).toLowerCase(),
              fullPath = path.join(uploadPath, safeFileName);

          if (ACCEPTABLE_ENCODINGS.indexOf(encoding) < 0) {
            Logger.error(`Error while receiving file ${fileName} from client: Unknown content encoding: ${contentEncoding}`);
            this.throwError(400);
          }

          try {
            var stream = fs.createWriteStream(fullPath, { encoding });
            file.on('end', () => {
              setProp(data, fieldName, new ContentTypeFile(undefined, {
                encoding,
                mimeType,
                filePath: fullPath,
                fileName: path.basename(fullPath)
              }));
            }).on('error', (err) => {
              Logger.error(`Error while trying to receive file ${fileName} from client: ${err}`);
            }).pipe(stream);
          } catch (e) {
            Logger.error(`Error while receiving file ${fileName} from client: ${e.message} - ${e}`);
            this.throwError(500);
          }
        });

        busboy.on('field', (fieldName, val, fieldNameTruncated, valTruncated, encoding, mimeType) => {
          setProp(data, fieldName, val);
        });

        busboy.on('error', (err) => {
          reject(err);
        });

        busboy.on('finish', () => {
          resolve(new ContentTypeJSON(data));
        });

        request.pipe(busboy);
      });
    }

    parseOtherRequest(request) {
      return new Promise((resolve, reject) => {
        var body = [];

        request.on('data', (chunk) => {
          body.push(chunk);
        }).on('error', (err) => {
          reject(err);
        }).on('end', () => {
          var contentType = getProp(request, 'headers.content-type', ''),
              finalBody = Buffer.concat(body);

          if (contentType.match(/^application\/json$/i))
            finalBody = new ContentTypeJSON(finalBody);
          else
            finalBody = new ContentTypeText(('' + finalBody));

          resolve(finalBody);
        });
      });
    }

    getRequestBody(request) {
      var { maxBodySize, maxFileSize } = this.options,
          bodySize = parseInt(getProp(request, 'headers.content-length', '0'), 0);

      var contentType = getProp(request, 'headers.content-type', '');
      if (contentType.match(/^multipart\/form-data/i)) {
        if (bodySize >= (maxFileSize + 512))
          this.throwError(413);

        return this.parseFormDataRequest(request);
      } else if (contentType.match(/^application\/x-www-form-urlencoded/i)) {
        if (bodySize >= maxBodySize)
          this.throwError(413);

        return this.parseFormDataRequest(request);
      } else {
        if (bodySize >= maxBodySize)
          this.throwError(413);

        return this.parseOtherRequest(request);
      }
    }

    async onRequest(request, response) {
      var url = this.getURLFromRequest(request),
          routeEngine = this.getRouteEngine(),
          routeClass = routeEngine.selectRouteFromURL(url, request);

      if (routeClass) {
        var body;

        try {
          body = await this.getRequestBody(request);
          debugger;
        } catch (e) {
          await this.writeResponse(response, this.errorResponse(e, 400));
          return;
        }

        try {
          var route = new routeClass({
                url,
                request,
                body,
                server: this
              }),
              routeResponse = await route.execute(route.request);

          if (!(routeResponse instanceof HTTPResponse))
            this.throwError(500);

          await this.writeResponse(response, routeResponse);
        } catch (e) {
          await this.writeResponse(response, this.errorResponse(e, 500));
        }
      } else {
        await this.writeResponse(response, this.errorResponse(this.statusCodeToMessage(404, 'Not Found'), 404));
      }
    }

    async onClose() {
      Logger.debug('HTTP server shutting down...');
    }

    async onStart() {
      var server = (this.options.https)
        ? https.createServer(this.options.https, this.onRequest.bind(this))
        : http.createServer(this.onRequest.bind(this));

      this._server = server;

      server.on('clientError', (error, socket) => {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      });

      server.listen(this.options.port);
    }

    async onShutdown() {
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

  Object.assign(root, HTTPResponse, {
    statusCodeToMessage,
    HTTPServer
  });
};

//table / bucket
