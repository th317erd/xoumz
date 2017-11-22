const RO = 0,
      RW = 1;

function defineProperty(type, obj, name, value, _getter, _setter) {
  let getter = _getter,
      setter = _setter;

  if (getter instanceof Function || setter instanceof Function) {
    Object.defineProperty(obj, name, {
      enumerable: false,
      configurable: false,
      get: getter,
      set: setter
    });
  } else {
    Object.defineProperty(obj, name, {
      writable: (type === RW),
      enumerable: false,
      configurable: false,
      value: value
    });
  }
}

const definePropertyRO =defineProperty.bind(this, RO),
      definePropertyRW = defineProperty.bind(this, RW);

function instanceOf(obj, ...args) {
  if (obj === undefined || obj === null)
    return false;

  if (args.length === 1 && args[0] === 'object')
    return !instanceOf(obj, 'string', 'number', 'boolean', 'array', 'function');

  for (var i = 0, il = args.length, objType = typeof obj; i < il; i++) {
    var type = args[i];

    if (type === objType)
      return true;
    else if (type === 'string' && (obj instanceof String))
      return true;
    else if (type === 'number' && (obj instanceof Number))
      return true;
    else if (type === 'boolean' && (obj instanceof Boolean))
      return true;
    else if (type === 'array' && (obj instanceof Array))
      return true;
    else if (type === 'function' && (obj instanceof Function))
      return true;
    else if ((type instanceof Function) && obj instanceof type)
      return true;
  }
      
  return false;
}

function typeName(obj) {
  if (obj === undefined)
    return 'undefined';
  else if (obj === null)
    return 'null';
  else if (instanceOf(obj, 'string'))
    return 'String';
  else if (instanceOf(obj, 'number'))
    return 'Number';
  else if (instanceOf(obj, 'boolean'))
    return 'Boolean';
  else if (instanceOf(obj, 'array'))
    return 'Array[' + typeName(type[0]) + ']';
  else if (instanceOf(obj, 'function'))
    return 'Function';
  else
    return 'Object';
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
};
  
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
};
  
function uid() {
	return 'U' + (uidCounter++);
};

function initMeta(node, namespace) {
  var metaContext;

  if (!node.hasOwnProperty('_meta')) {
  	var thisUID = uid();
  	metaContext = {'_UID': thisUID, '_aliases': {}};
  	definePropertyRW(node, '_meta', metaContext);
  } else {
  	metaContext = node._meta;
  }

  if (arguments.length > 1 && namespace) {
  	if (!node._meta.hasOwnProperty(namespace)) {
	    metaContext = {};
	    definePropertyRW(node._meta, namespace, metaContext);	
  	} else {
    	metaContext = metaContext[namespace];
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
function prop(cmd, _node, namespace) {
	var node = _node,
			GET = 0x01,
      SET = 0x02,
      REMOVE = 0x04,
      c,
	    isMetaNS = false,
	    isMeta = false,
	    argStartIndex,
	    argStartIndexOne,
	    context,
	    op = ((c = cmd.charAt(0)) === 'g') ? GET : (c === 's') ? SET : REMOVE,
	    finalPath = [];
		
	switch(cmd) {
    case 'getMetaNS':
    case 'setMetaNS':
    case 'removeMetaNS':
			isMetaNS = isMeta = true;
			argStartIndex = 3;
			argStartIndexOne = 4;

			if (!node.hasOwnProperty('_meta') || !node._meta.hasOwnProperty(namespace))
				context = initMeta(node, namespace);
			else
				context = node._meta[namespace];

			finalPath = ['_meta', namespace];

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
  		parts = fullPath.replace(/([^\\])\[/g,'$1.[').replace(/([^\\])\./g,'$1..').replace(/\\([.\[])/g,'$1').split('..');
  	else
  		//Fast route
  		parts = fullPath.replace(/\[/g,'.[').split('.');

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

	if (set instanceof Array) {
		node._meta._aliases = set;
	} else if (node._meta._aliases.indexOf(set) < 0) {
		node._meta._aliases.push(set);
	}

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

	switch(which) {
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
		return ('' + tempStr).toLowerCase().replace(/\b(\w)/gi, function(a, x) { return '' + x.toUpperCase(); });
	} else {
		return ('' + tempStr).replace(/^([^\w]*)(\w)(\w+)?/gi, function(a, x, y, z) { var initial = x + y.toUpperCase(); return (z) ? (initial + z.toLowerCase()) : (initial); });
	}
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
* @function getMetaNS Get a namespaced meta property from an object and all sub-objects by evaluating a dot-notation path into an object. This is the same as @@getMeta except that the value is retrieved from a namespace
* @param {Object} {obj} Object to get meta property from
* @param {String} {namespace} Namespace to store meta property in
* @param {String} {path} Dot notation path to evaluate
* @param {*} {[defaultValue=undefined]} Specify a default value to return if the requested meta property is not found, is null, undefined, NaN or !isFinite
* @return {*} Return property specified by path
* @see getMeta
* @see setMeta
**/
const getMetaNS = prop.bind(this, 'getMetaNS');

/**
* @function setMetaNS Set a namespaced meta property on an object by evaluating a dot-notation path into an object. This is the same as @@setMeta except that the value is stored in a namespace
* @param {Object} {obj} Object to set meta property on
* @param {String} {namespace} Namespace to store meta property in
* @param {String} {path} Dot notation path to evaluate
* @param {*} {value} Value to set
* @return {String} Return the actual final path (relative to the base object) where the meta property was set. This is useful if meta property was pushed into an array; the actual array index will be returned as part of the final path
* @see getMeta
**/
const setMetaNS = prop.bind(this, 'setMetaNS');

/**
* @function removeMetaNS Remove a namespaced meta property from an object/sub-objects by evaluating a dot-notation path into an object. This is the same as @@removeMeta except that the value is retrieved from a namespace
* @param {Object} {obj} Object to remove meta property from
* @param {String} {namespace} Namespace to remove meta property in
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
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
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

function getWordSafe(_word) {
  if (!_word)
    return _word;

  var word = ('' + _word).trim().toLowerCase();
  if (word.match(/[^a-z0-9]/i))
    return;

  return word;
}

function getPluralSingularWord(_word, mode) {
  var word = getWordSafe(_word),
      tables = (mode) ? [toPluralTable, toSingularTable] : [toSingularTable, toPluralTable];

  // If found in the "main" table, simply return it
  if (tables[0].hasOwnProperty(word))
    return tables[0][word];

  // If found in the secondary table, use the word from the secondary table to index the primary table
  if (tables[1].hasOwnProperty(word))
    return tables[0][tables[1][word]];
  
  // Guess at word plurality
  var newWord = (mode) ? (word + 's') : word.replace(/(es|ies|s)$/, '');
  
  // Add this guess to the word tables
  tables[0][word] = newWord;
  tables[1][newWord] = word;

  return newWord;
}

function pluralOf(word) {
  return getPluralSingularWord(word, 1);
}

function singularOf(word) {
  return getPluralSingularWord(word, 0);
}

function registerWord(_word, _plural) {
  var word = getWordSafe(_word),
      plural = getWordSafe(_plural);
  
  if (!word || !plural)
    return;

  toPluralTable[word] = plural;
  toSingularTable[plural] = word;
}

var uidCounter = 1,
    toPluralTable = {},
    toSingularTable = {};

module.exports = function(root, requireModule) {
  Object.assign(root, {
    definePropertyRO,
    definePropertyRW,
    instanceOf,
    typeName,
    id,
    audit,
    aliases,
    empty,
    uid,
    uuid,
    sizeOf,
    prettify,
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
    pluralOf,
    singularOf,
    registerWord
  });
};