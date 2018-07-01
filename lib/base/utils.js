const RO = 0,
      RW = 1;

function copyStaticMethods(klass, parentKlass) {
  if (!parentKlass)
    return klass;

  var keys = Object.keys(parentKlass);
  for (var i = 0, il = keys.length; i < il; i++) {
    var key = keys[i];
    if (klass.hasOwnProperty(key))
      continue;

    var value = parentKlass[key];
    if (typeof value === 'function' && key !== 'rebindStaticMethod' && typeof parentKlass.rebindStaticMethod === 'function')
      value = parentKlass.rebindStaticMethod(key, value, klass);

    klass[key] = value;
  }

  return klass;
}

function defineProperty(type, obj, name, value, _getter, _setter) {
  let getter = _getter,
      setter = _setter;

  if (getter instanceof Function || setter instanceof Function) {
    Object.defineProperty(obj, name, {
      enumerable: false,
      configurable: true,
      get: getter,
      set: setter
    });
  } else {
    Object.defineProperty(obj, name, {
      writable: (type === RW),
      enumerable: false,
      configurable: (type === RW),
      value: value
    });
  }
}

const definePropertyRO = defineProperty.bind(this, RO),
      definePropertyRW = defineProperty.bind(this, RW);

function checkPrototypeChain(_proto, type) {
  var proto = _proto;
  while (proto) {
    if (proto.name === type)
      return true;

    proto = Object.getPrototypeOf(proto);
  }

  return false;
}

function typeOf(obj, ...args) {
  if (!obj || typeof obj !== 'function')
    return false;

  for (var i = 0, il = args.length, objType = typeof obj; i < il; i++) {
    var type = args[i];
    if (checkPrototypeChain(obj, type))
      return true;
  }

  return false;
}

function instanceOf(obj, ...args) {
  if (obj === undefined || obj === null)
    return false;

  if (args.length === 1 && args[0] === 'object')
    return !instanceOf(obj, 'string', 'number', 'boolean', 'array', 'function');

  for (var i = 0, il = args.length, objType = typeof obj; i < il; i++) {
    var type = args[i];
    if (type === undefined)
      continue;

    if (type === objType) {
      return true;
    } else if (type === 'string' && (obj instanceof String)) {
      return true;
    } else if (type === 'number' && (obj instanceof Number)) {
      return true;
    } else if (type === 'boolean' && (obj instanceof Boolean)) {
      return true;
    } else if (type === 'array' && (obj instanceof Array)) {
      return true;
    } else if (type === 'function' && (obj instanceof Function)) {
      return true;
    } else if (type === 'stream') {
      return (obj.pipe instanceof Function && obj.on instanceof Function);
    } else {
      if (type instanceof Function) {
        if (obj instanceof type)
          return true;

        type = type.name;
      }

      var constructor = obj.constructor;
      if (constructor && checkPrototypeChain(constructor, type))
        return true;
    }
  }

  return false;
}

function sizeOf(obj) {
  if (obj === undefined || obj === null)
    return 0;

  if (obj.size instanceof Function)
    return obj.size();

  if ((obj instanceof Array) || (typeof obj === 'string') || (obj instanceof String))
    return obj.length;

  if (obj.length !== undefined && obj.length !== null)
    return obj.length;

  if (obj instanceof Object)
    return Object.keys(obj).length;

  return 0;
}

function noe() {
  for (var i = 0, len = arguments.length; i < len; i++) {
    var val = arguments[i];
    if (val === undefined || val === null)
      return true;

    if ((typeof val === 'string' || val instanceof String) && !val.match(/\S/))
      return true;

    if ((typeof val === 'number' || val instanceof Number) && (isNaN(val) || !isFinite(val)))
      return true;

    if (typeof val === 'object') {
      if (sizeOf(val) == 0)
        return true;
    }
  }

  return false;
}

function uid() {
  return 'U' + (uidCounter++);
}

function initMeta(node, name) {
  var metaContext;

  if (!node.hasOwnProperty('_meta')) {
    var thisUID = uid();
    metaContext = {'_UID': thisUID, '_aliases': {}};
    definePropertyRW(node, '_meta', metaContext);
  } else {
    metaContext = node._meta;
  }

  if (arguments.length > 1 && name) {
    if (!node._meta.hasOwnProperty(name)) {
      metaContext = {};
      definePropertyRW(node._meta, name, metaContext);
    } else {
      metaContext = metaContext[name];
    }
  }

  return metaContext;
}

function initAudit(node) {
  if (node && (!Object.isExtensible(node) || Object.isFrozen(node)))
    return;

  var timeCreated = getTimeNow();
  definePropertyRW(node, '_audit', {
    'base': {created: timeCreated, modified: timeCreated, updateCount: 0},
    '_meta': {created: timeCreated, modified: timeCreated, updateCount: 0}
  });
}

//This function is deliberately large and confusing in order to squeeze
//every ounce of speed out of it
function prop(cmd, _node, name) {
  var node = _node,
      GET = 0x01,
      SET = 0x02,
      REMOVE = 0x04,
      c,
      isMeta = false,
      argStartIndex,
      argStartIndexOne,
      context,
      op = ((c = cmd.charAt(0)) === 'g') ? GET : (c === 's') ? SET : REMOVE,
      finalPath = [];

  switch (cmd) {
    case 'getMetaNS':
    case 'setMetaNS':
    case 'removeMetaNS':
      argStartIndex = 3;
      argStartIndexOne = 4;

      if (!node.hasOwnProperty('_meta') || !node._meta.hasOwnProperty(name))
        context = initMeta(node, name);
      else
        context = node._meta[name];

      finalPath = ['_meta', name];

      break;
    case 'getMeta':
    case 'setMeta':
    case 'removeMeta':
      isMeta = true;
      argStartIndex = 2;
      argStartIndexOne = 3;

      if (!node.hasOwnProperty('_meta'))
        context = initMeta(node);
      else
        context = node._meta;

      finalPath = ['_meta'];

      break;
    default:
      argStartIndex = 2;
      argStartIndexOne = 3;
      context = node;
      break;
  }

  if (op & GET) {
    //Do we need to return the default value?
    if (!context || !(context instanceof Object) ||
        typeof context === 'string' || typeof context === 'number' || typeof context === 'boolean' ||
        context instanceof String || context instanceof Number || context instanceof Boolean)
      return arguments[argStartIndexOne];
  }

  var prop,
      fullPath = '' + arguments[argStartIndex],
      nextIsArray,
      parts = [];

  //No path
  if (!fullPath) {
    if (op & SET)
      return '';

    if (op & REMOVE)
      return;

    return arguments[argStartIndexOne];
  }

  //Are there any parts to handle?
  if (fullPath.indexOf('.') > -1 || fullPath.indexOf('[') > -1) {
    if (fullPath.indexOf('\\') > -1)
      //If we have character escapes, take the long and slow route
      parts = fullPath.replace(/([^\\])\[/g, '$1.[').replace(/([^\\])\./g, '$1..').replace(/\\([.\[])/g, '$1').split('..');
    else
      //Fast route
      parts = fullPath.replace(/\[/g, '.[').split('.');

    for (var i = 0, i2 = 1, il = parts.length; i < il; i++, i2++) {
      var part = parts[i],
          isLast = (i2 >= il),
          isArrayIndex = (part.charAt(0) === '[');

      //Is this an array index
      if (isArrayIndex)
        part = part.substring(1, part.length - 1);

      //Get prop
      prop = context[part];

      if (op & REMOVE && isLast) {
        //If this is the final part, and we are to remove the item...
        if (context && (!Object.isExtensible(context) || Object.isFrozen(context)))
          return prop;

        if (arguments[argStartIndexOne] === true)
          //ACTUALLY delete it if the user forces a delete
          delete context[part];
        else
          //Otherwise do it the performant way by setting the value to undefined
          context[part] = undefined;

        //Return whatever the value was
        return prop;
      } else if (op & SET) {
        //Are we setting the value?

        //If this is the last part, or the value isn't set,
        //or it is set but the path continues and it
        //needs to be overwritten
        if (isLast || (prop === undefined || prop === null || (!isLast && (!(prop instanceof Object) || prop instanceof Number || prop instanceof String || prop instanceof Boolean)))) {
          //If the next part is an array, make sure to create an array
          nextIsArray = (!isLast && parts[i2].charAt(0) === '[');

          //What is our new value?
          prop = (isLast) ? arguments[argStartIndexOne] : (nextIsArray) ? [] : {};

          //Update context accordingly
          if (context instanceof Array && !part) {
            isArrayIndex = true;
            if (context && Object.isExtensible(context) && !Object.isFrozen(context)) {
              part = '' + (context.push(prop) - 1);
              context = prop;
            }
          } else if (part) {
            if (context && Object.isExtensible(context) && !Object.isFrozen(context))
              context[part] = prop;
            context = prop;
          }
        } else {
          context = prop;
        }

        if (part)
          finalPath.push((isArrayIndex) ? ('[' + part + ']') : part);
      } else {
        if (prop === undefined || prop === null || ((typeof prop === 'number' || prop instanceof Number) && (isNaN(prop) || !isFinite(prop))))
          return arguments[argStartIndexOne];
        context = prop;
      }
    }
  } else {
    if (op & REMOVE) {
      prop = context[fullPath];

      if (context && (!Object.isExtensible(context) || Object.isFrozen(context)))
        return prop;

      if (arguments[argStartIndexOne] === true)
        //ACTUALLY delete it if the user forces a delete
        delete context[part];
      else
        //Otherwise do it the performant way by setting the value to undefined
        context[part] = undefined;

      //Return whatever the value was
      return prop;
    } else if (op & SET) {
      if (context && Object.isExtensible(context) && !Object.isFrozen(context))
        context[fullPath] = arguments[argStartIndexOne];

      return fullPath;
    }

    prop = context[fullPath];
  }

  if (op & GET) {
    //Do we need to return the default value?
    if (prop === undefined || prop === null || ((typeof prop === 'number' || prop instanceof Number) && (isNaN(prop) || !isFinite(prop))))
      return arguments[argStartIndexOne];
    return prop;
  }

  if (!node.hasOwnProperty('_audit'))
    initAudit(node);

  var lastUpdated = getTimeNow();
  if (isMeta && node._audit) {
    var m = node._audit.meta;
    m.modified = lastUpdated;
    m.updateCount++;
  } else if (node._audit) {
    var b = node._audit.base;
    b.modified = lastUpdated;
    b.updateCount++;
  }

  return (op & SET) ? finalPath.join('.').replace(/\.\[/g, '[') : prop;
}

/**
* @function {id} Get/set object id. By default every object will have a unique id. This id is stored in the objects meta properties
* @param {Object} {obj} Object to get / set id from
* @param {String} {[set]} If specified set object id to this
* @return {String} Objects id
* @see getMeta
* @see setMeta
* @see get
* @see set
**/
function id(node, set) {
  if (arguments.length === 0)
    return;

  if (!node.hasOwnProperty('_meta'))
    initMeta(node);

  if (arguments.length === 1)
    return node._meta._UID;

  if (!node.hasOwnProperty('_audit'))
    initAudit(node);

  node._meta._UID = set;

  var m = node._audit.meta;
  m.modified = getTimeNow();
  m.updateCount++;

  return set;
}

/**
* @function aliases Get/set object aliases (from meta properties)
* @param {Object} {obj} Object to get / set aliases from
* @param {Array|String} {[set]} If specified as an Array, set the entire aliases array to this. If specified as a string, add this alias to the list of aliases
* @return {Array} List of aliases
* @see getMeta
* @see setMeta
**/
function aliases(node, set) {
  if (arguments.length === 0)
    return;

  if (!node.hasOwnProperty('_meta'))
    initMeta(node);

  if (arguments.length === 1)
    return node._meta._aliases;

  if (!set)
    return;

  if (!node.hasOwnProperty('_audit'))
    initAudit(node);

  if (set instanceof Array)
    node._meta._aliases = set;
   else if (node._meta._aliases.indexOf(set) < 0)
    node._meta._aliases.push(set);


  var m = node._audit.meta;
  m.modified = getTimeNow();
  m.updateCount++;

  return node._meta._aliases;
}

/**
* @function audit Get audit information on object
* @param {Object} {obj} Object to get audit information on
* @param {String} {[which]} 'meta' or 'base'. If 'meta', get audit information on meta property updates. If 'base', get audit information on base property updates. If neither is specified, get the most recently updated (meta or base, whichever is most recent)
* @return {Object} Meta information object, i.e {created: (timestamp), modified: (timestamp), updateCount: (count)}
**/
function audit(node, _which) {
  if (arguments.length === 0)
    return;

  var which = _which || '*';

  if (!node.hasOwnProperty('_audit'))
    initAudit(node);

  switch (which) {
    case '*':
      var m = node._audit.meta,
          b = node._audit.base;
      return (m.modified > b.modified) ? m : b;
    case 'meta':
      return node._audit.meta;
    case 'base':
      return node._audit.base;
  }
}

/**
* @function empty Delete ALL deletable properties from an object. This is useful when
* you want to "empty" an object while retaining all references to this object.
* @param {Object} {obj} Object to "clear"
* @return {Object} Same object but with all properties removed
* @note This could possibly have huge performance implications
**/
function empty(obj) {
  var keys = Object.keys(obj);
  for (var i = 0, len = keys.length; i < len; i++) {
    var k = keys[i];
    if (k === '_meta' || k === '_audit')
      continue;

    delete obj[k];
  }

  if (obj._meta || obj._audit) {
    if (!obj.hasOwnProperty('_audit'))
      initAudit(obj);

    var b = obj._audit.base;
    b.modified = getTimeNow();
    b.updateCount++;
  }
}

/**
* @function {prettify} Capitalize the first letter of the first word, or optionally capitalize
* the first letter of every word if *allWords* argument is **true**
* @param {String} {str} String to modify
* @param {Boolean} {[allWords=false]} If **true**, capitalize the first letter of EVERY word (instead of just the first)
* @return {String} A prettified string
*/
function prettify(tempStr, allWords) {
  if (noe(tempStr))
    return '';

  if (allWords) {
    return ('' + tempStr).toLowerCase().replace(/\b(\w)/gi, function(a, x) {
      return '' + x.toUpperCase();
    });
  } else {
    return ('' + tempStr).replace(/^([^\w]*)(\w)(\w+)?/gi, function(a, x, y, z) {
      var initial = x + y.toUpperCase(); return (z) ? (initial + z.toLowerCase()) : (initial);
    });
  }
}

function capitalize(tempStr) {
  if (noe(tempStr))
    return '';

  return (tempStr.charAt(0).toUpperCase() + tempStr.substring(1));
}

/**
* @function get Get a property from an object and all sub-objects by evaluating a dot-notation path into an object.
* @param {Object} {obj} Object to get property from
* @param {String} {path} Dot notation path to evaluate
* @param {*} {[defaultValue=undefined]} Specify a default value to return if the requested property is not found, is null, undefined, NaN or !isFinite
* @return {*} Return property specified by path
* @see function:set
* @example {javascript}
  var obj = {hello: {world: "!!!"}, arr:[[1,2],3,4,5]};
  utils.get(obj, 'hello.world'); //!!!
  utils.get(obj, "some.key.that.doesn't.exist", 'not found'); //not found
  utils.get(obj, "arr[0][0]"); //1
  utils.get(obj, "arr[1]"); //3
**/
const get = prop.bind(this, 'get');

/**
* @function set Set a property on an object by evaluating a dot-notation path into an object.
* @param {Object} {obj} Object to set property on
* @param {String} {path} Dot notation path to evaluate
* @param {*} {value} Value to set
* @return {String} Return the actual final path (relative to the base object) where the property was set. This is useful if property was pushed into an array; the actual array index will be returned as part of the final path
* @see get
* @note With empty array notation in a specified path (i.e my.array.key[]) the value will be appended to the array specified
* @example {javascript}
  var obj = {};
  utils.set(obj, 'hello.world', '!!!'); //hello.world
  utils.set(set, "arr[]", [1]); //arr[0]
  utils.set(obj, "arr[0][1]", 2); //arr[0][1]
  utils.set(obj, "arr[]", 3); //arr[1]
**/
const set = prop.bind(this, 'set');

/**
* @function remove Remove a property from an object/sub-object by evaluating a dot-notation path into an object.
* @param {Object} {obj} Object to remove property from
* @param {String} {path} Dot notation path to evaluate
* @return {*} Return property value of removed key specified by path
* @see get
* @example {javascript}
  var obj = {hello: {world: "!!!"}, arr:[[1,2],3,4,5]};
  utils.remove(obj, 'hello.world'); //obj === {hello: {}, arr:[[1,2],3,4,5]}
**/
const remove = prop.bind(this, 'remove');

/**
* @function getMeta Get a meta property from an object and all sub-objects by evaluating a dot-notation path into an object. This is the same as @@get except it is used for object meta properties
* @param {Object} {obj} Object to get meta property from
* @param {String} {path} Dot notation path to evaluate
* @param {*} {[defaultValue=undefined]} Specify a default value to return if the requested meta property is not found, is null, undefined, NaN or !isFinite
* @return {*} Return property specified by path
* @see setMeta
**/
const getMeta = prop.bind(this, 'getMeta');

/**
* @function setMeta Set a meta property on an object by evaluating a dot-notation path into an object. This is the same as @@set except it is used for object meta properties
* @param {Object} {obj} Object to set meta property on
* @param {String} {path} Dot notation path to evaluate
* @param {*} {value} Value to set
* @return {String} Return the actual final path (relative to the base object) where the meta property was set. This is useful if meta property was pushed into an array; the actual array index will be returned as part of the final path
* @see getMeta
**/
const setMeta = prop.bind(this, 'setMeta');

/**
* @function removeMeta Remove a meta property from an object/sub-objects by evaluating a dot-notation path into an object. This is the same as @@remove except it is used for object meta properties
* @param {Object} {obj} Object to remove meta property from
* @param {String} {path} Dot notation path to evaluate
* @return {*} Return property value of removed key specified by path
* @see setMeta
**/
const removeMeta = prop.bind(this, 'removeMeta');

/**
* @function getMetaNS Get a namespaced meta property from an object and all sub-objects by evaluating a dot-notation path into an object. This is the same as @@getMeta except that the value is retrieved from a name
* @param {Object} {obj} Object to get meta property from
* @param {String} {name} Namespace to store meta property in
* @param {String} {path} Dot notation path to evaluate
* @param {*} {[defaultValue=undefined]} Specify a default value to return if the requested meta property is not found, is null, undefined, NaN or !isFinite
* @return {*} Return property specified by path
* @see getMeta
* @see setMeta
**/
const getMetaNS = prop.bind(this, 'getMetaNS');

/**
* @function setMetaNS Set a namespaced meta property on an object by evaluating a dot-notation path into an object. This is the same as @@setMeta except that the value is stored in a name
* @param {Object} {obj} Object to set meta property on
* @param {String} {name} Namespace to store meta property in
* @param {String} {path} Dot notation path to evaluate
* @param {*} {value} Value to set
* @return {String} Return the actual final path (relative to the base object) where the meta property was set. This is useful if meta property was pushed into an array; the actual array index will be returned as part of the final path
* @see getMeta
**/
const setMetaNS = prop.bind(this, 'setMetaNS');

/**
* @function removeMetaNS Remove a namespaced meta property from an object/sub-objects by evaluating a dot-notation path into an object. This is the same as @@removeMeta except that the value is retrieved from a name
* @param {Object} {obj} Object to remove meta property from
* @param {String} {name} Namespace to remove meta property in
* @param {String} {path} Dot notation path to evaluate
* @return {*} Return property value of removed key specified by path
* @see removeMeta
**/
const removeMetaNS = prop.bind(this, 'removeMetaNS');

/**
* @function uuid Generate a random UUID
* @return {String} Return randomly generated UUID
**/
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = (c == 'x') ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function humanifyArrayItems(arr) {
  return (arr || []).reduce((sum, item, index, values) => {
    if (index === 0)
      return ('' + item);
    return ((index + 1) < values.length) ? ([sum, item].join(', ')) : ([sum, item].join(', or '));
  }, '');
}

function calcStringWeight(str) {
  var tot = 0;
  for (var i = 0, il = str.length; i < il; i++) {
    var c = str.charCodeAt(i);
    if (i > 0)
      c = c / Math.pow(10, i);
    tot += c;
  }

  return tot;
}

function isCyclic(obj, skipType) {
  function testCyclic(parentKey, thisObj, alreadyVisited) {
    if (!instanceOf(thisObj, 'object', 'array'))
      return false;

    if (!(thisObj instanceof Array) && (skipType instanceof Function) && skipType(thisObj) === true)
      return false;

    if (alreadyVisited.indexOf(thisObj) >= 0)
      return true;

    alreadyVisited.push(thisObj);

    var keys = Object.keys(thisObj);
    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          val = thisObj[key];

      if (testCyclic(key, val, alreadyVisited) === true)
        return true;
    }

    return false;
  }

  if (!obj)
    return obj;

  return testCyclic(null, obj, []);
}

function regExpEscape(str) {
  if (!str)
    return str;
  return str.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}

function equal(item1, item2) {
  if (item1 === item2)
    return true;

  if (item1 && typeof item1 === 'number' && item2 && typeof item2 === 'number') {
    if (isNaN(item1) && isNaN(item2))
      return true;

    if (!isFinite(item1) && !isFinite(item2))
      return true;
  }

  if (item1 && item2 && item1.valueOf() === item2.valueOf())
    return true;

  return false;
}

function prepad(_str, len, padStr = '0') {
  var str = ('' + _str);
  if (str.length >= len)
    return str;

  return (new Array((len - str.length) + 1)).join(padStr) + str;
}

function postpad(_str, len, padStr = '0') {
  var str = ('' + _str);
  if (str.length >= len)
    return str;

  return str + (new Array((len - str.length) + 1)).join(padStr);
}

/**
* @function {extend} Extend (copy) objects into base object. This should ALWAYS be used instead of jQuery.extend
	because it is faster, and more importantly because it WILL NOT mangle instantiated
	sub-objects.
* @param {[flags]}
* 	@type {Object} Will be considered the first of <b>args</b>
*		@type {Boolean} If true this is a deep copy
*		@type {Number} This is a bitwise combination of flags. Flags include: evisit-core-js.data.extend.DEEP, evisit-core-js.data.extend.NO_OVERWRITE, and evisit-core-js.data.extend.FILTER. If the 'FILTER' flag is specified the 2nd argument is expected to be a function to assist in which keys to copy
*	@end
* @param {[args...]}
* 	@type {Object} Objects to copy into base object. First object in the argument list is the base object.
*		@type {Function} If the second argument is a function and the bitwise flag "FILTER" is set then this function will be the callback used to filter the keys of objects during copy
			@param {String} {key} Key of object(s) being copied
			@param {*} {value} Value being copied
			@param {Object} {src} Parent Object/Array where value is being copied from
			@param {*} {dstValue} Value of same key at destination, if any
			@param {Object} {dst} Parent Object/Array where value is being copied to
		@end
*	@end
* @return {Object} Base object with all other objects merged into it
*/
function extend() {
	if (arguments.length === 0)
		return;

	if (arguments.length === 1)
		return arguments[0];

	var isDeep = false;
	var allowOverwrite = true;
	var filterFunc;
	var startIndex = 0;
	var dst = arguments[0];

	if (typeof dst === 'boolean') {
		isDeep = dst;
		startIndex++;
	} else if (typeof dst === 'number') {
		isDeep = (dst & extend.DEEP);
		allowOverwrite = !(dst & extend.NO_OVERWRITE);
		startIndex++;
		filterFunc = (dst & extend.FILTER) ? arguments[startIndex++] : undefined;
	}

	//Destination object
	dst = arguments[startIndex++];
	if (!dst)
		dst = {};

	var val;
	if (isDeep) {
		for (var i = startIndex, len = arguments.length; i < len; i++) {
			var thisArg = arguments[i];
			if (!(thisArg instanceof Object))
				continue;

			var keys = Object.keys(thisArg);
			for (var j = 0, jLen = keys.length; j < jLen; j++) {
				var key = keys[j];

				if (allowOverwrite !== true && dst.hasOwnProperty(key))
					continue;

				val = thisArg[key];
				var dstVal = dst[key];

				if (filterFunc && filterFunc(key, val, thisArg, dstVal, dst) === false)
					continue;

				if (val && typeof val === 'object' && !(val instanceof String) && !(val instanceof Number) &&
						(val.constructor === Object.prototype.constructor || val.constructor === Array.prototype.constructor)) {
					var isArray = (val instanceof Array);
					if (!dstVal)
						dstVal = (isArray) ? [] : {};
					val = extend(true, (isArray) ? [] : {}, dstVal, val);
				}

				dst[key] = val;
			}
		}
	} else {
		for (var i = startIndex, len = arguments.length; i < len; i++) {
			var thisArg = arguments[i];
			if (!(thisArg instanceof Object))
				continue;

			var keys = Object.keys(thisArg);
			for (var j = 0, jLen = keys.length; j < jLen; j++) {
				var key = keys[j];

				if (allowOverwrite !== true && dst.hasOwnProperty(key))
					continue;

				val = thisArg[key];
				if (filterFunc) {
					var dstVal = dst[key];
					if (filterFunc(key, val, thisArg, dstVal, dst) === false)
						continue;
				}

				dst[key] = val;
			}
		}
	}

	if (dst._audit) {
  	var b = dst._audit.base;
    b.modified = getTimeNow();
    b.updateCount++;
	}

	return dst;
}

(function(base) {
	base.DEEP = 0x01;
	base.NO_OVERWRITE = 0x02;
	base.FILTER = 0x04;
})(extend);

const getTimeNow = (function() {
    if (typeof performance !== 'undefined' && performance.now)
      return performance.now.bind(performance);

    var nanosecondsInMilliseconds = 1000000;
    return function() {
      var hrTime = process.hrtime();
      return (hrTime[0] * 1000) + (hrTime[1] / nanosecondsInMilliseconds);
    };
  })();

var uidCounter = 1;

module.exports = Object.assign(module.exports, {
  copyStaticMethods,
  definePropertyRO,
  definePropertyRW,
  typeOf,
  instanceOf,
  id,
  audit,
  aliases,
  empty,
  uid,
  uuid,
  sizeOf,
  prettify,
  capitalize,
  noe,
  get,
  getProp: get,
  set,
  setProp: set,
  remove,
  removeProp: remove,
  getMeta,
  getMetaProp: getMeta,
  setMeta,
  setMetaProp: setMeta,
  removeMeta,
  removeMetaProp: removeMeta,
  getMetaNS,
  getMetaPropNS: getMetaNS,
  setMetaNS,
  setMetaPropNS: setMetaNS,
  removeMetaNS,
  removeMetaPropNS: removeMetaNS,
  humanifyArrayItems,
  calcStringWeight,
  now: getTimeNow,
  isCyclic,
  regExpEscape,
  equal,
  prepad,
  postpad,
  extend
});
