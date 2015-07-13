var debug = require('debug')('configup');
var fs = require('fs');
var utils = require('./utils');

/**
 * Load named configuration.
 * @param {String} filename filename without ext
 * @param {String|Function} [env] Environment, usually `process.env.NODE_ENV`
 * @param {function(target:Object, config:Object, filename:String)} mergeFn
 * @returns {Object}
 */
exports.load = load;
function load(filename, env, mergeFn) {
    if (typeof env === 'function') {
        mergeFn = env;
        env = "development";
    }
    var files = findConfigFiles(filename, env);
    if (files.length) {
        debug('found %s %s files', env, filename);
        files.forEach(function (f) {
            debug('  %s', f);
        });
    }
    var configs = loadConfigFiles(files);
    var merged = mergeConfigurations(configs, mergeFn);

    debug('merged %s %s configuration %j', env, filename, merged);

    return merged;
};

exports.loadDeepMerge = loadDeepMerge;
function loadDeepMerge(filename, env) {
    return load(filename, env, function deepMerge(target, config, fileName) {
        var err = utils.mergeObjects(target, config);
        if (err) {
            throw new Error('Cannot apply ' + fileName + ': ' + err);
        }
    })
};

/**
 * Search `appRootDir` for all files containing configuration for `name`.
 * @param {String} filename filename without ext
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @returns {Array.<String>} Array of absolute file paths.
 */
function findConfigFiles(filename, env) {
    var master = ifExists(filename + '.json');
    if (!master) return [];

    var candidates = [
        master,
        ifExistsWithAnyExt(filename + '.local'),
        ifExistsWithAnyExt(filename + '.' + env)
    ];

    return candidates.filter(function (c) {
        return c !== undefined;
    });

    function ifExists(fileName) {
        return fs.existsSync(fileName) ? fileName : undefined;
    }

    function ifExistsWithAnyExt(fileName) {
        return ifExists(fileName + '.js') || ifExists(fileName + '.json');
    }
}

/**
 * Load configuration files into an array of objects.
 * Attach non-enumerable `_filename` property to each object.
 * @param {Array.<String>} files
 * @returns {Array.<Object>}
 */
function loadConfigFiles(files) {
    return files.map(function (f) {
        var config = require(f);
        Object.defineProperty(config, '_filename', {
            enumerable: false,
            value: f
        });
        return config;
    });
}

/**
 * Merge multiple configuration objects into a single one.
 * @param {Array.<Object>} configObjects
 * @param {function(target:Object, config:Object, filename:String)} mergeFn
 */
function mergeConfigurations(configObjects, mergeFn) {
    var result = configObjects.shift() || {};
    while (configObjects.length) {
        var next = configObjects.shift();
        mergeFn(result, next, next['_filename']);
    }
    return result;
}
