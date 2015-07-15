var debug = require('debug')('configup');
var path = require('path');
var fs = require('fs');
var Module = require('module');

var FILE_EXTENSION_JSON = '.json';

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
}

exports.loadDeepMerge = loadDeepMerge;
/**
 *
 * @param filename
 * @param env
 * @param {Boolean} [strict] - merge base on the origin config file, ignore all keys that not in the origin config file.
 * @returns {*}
 */
function loadDeepMerge(filename, env, strict) {
    if (typeof env === 'boolean') {
        strict = env;
        env = undefined;
    }
    return load(filename, env, function (target, config, filename) {
        if (strict) {
            for (var key in target) {
                if (typeof target[key] === 'object') {
                    deepMerge(target[key], config[key], filename);
                } else {
                    target[key] = config[key];
                }
            }
        } else {
            deepMerge(target, config, filename);
        }
    });
    function deepMerge(target, config, filename) {
        var err = mergeObjects(target, config);
        if (err) {
            throw new Error('Cannot apply ' + filename + ': ' + err);
        }
    }
}

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


exports.mergeObjects = mergeObjects;
function mergeObjects(target, config, keyPrefix) {
    for (var key in config) {
        var fullKey = keyPrefix ? keyPrefix + '.' + key : key;
        var err = mergeSingleItemOrProperty(target, config, key, fullKey);
        if (err) return err;
    }
    return null; // no error
}

exports.mergeSingleItemOrProperty = mergeSingleItemOrProperty;
function mergeSingleItemOrProperty(target, config, key, fullKey) {
    var origValue = target[key];
    var newValue = config[key];

    if (!hasCompatibleType(origValue, newValue)) {
        return 'Cannot merge values of incompatible types for the option `' +
            fullKey + '`.';
    }

    if (Array.isArray(origValue)) {
        return mergeArrays(origValue, newValue, fullKey);
    }

    if (typeof origValue === 'object') {
        return mergeObjects(origValue, newValue, fullKey);
    }

    target[key] = newValue;
    return null; // no error
}

exports.mergeArrays = mergeArrays;
function mergeArrays(target, config, keyPrefix) {
    if (target.length !== config.length) {
        return 'Cannot merge array values of different length' +
            ' for the option `' + keyPrefix + '`.';
    }

    // Use for(;;) to iterate over undefined items, for(in) would skip them.
    for (var ix = 0; ix < target.length; ix++) {
        var fullKey = keyPrefix + '[' + ix + ']';
        var err = mergeSingleItemOrProperty(target, config, ix, fullKey);
        if (err) return err;
    }

    return null; // no error
}

exports.hasCompatibleType = hasCompatibleType;
function hasCompatibleType(origValue, newValue) {
    if (origValue === null || origValue === undefined)
        return true;

    if (Array.isArray(origValue))
        return Array.isArray(newValue);

    if (typeof origValue === 'object')
        return typeof newValue === 'object';

    // Note: typeof Array() is 'object' too,
    // we don't need to explicitly check array types
    return typeof newValue !== 'object';
}

exports.assertIsValidConfig = assertIsValidConfig;
function assertIsValidConfig(name, config) {
    if (config) {
        assert(typeof config === 'object',
            name + ' config must be a valid JSON object');
    }
}

/**
 * Find all javascript files (except for those prefixed with _)
 * and all directories.
 * @param {String} dir Full path of the directory to enumerate.
 * @return {Array.<String>} A list of absolute paths to pass to `require()`.
 * @private
 */
exports.findScripts = findScripts;
function findScripts(dir/*, extensions*/) {
    assert(dir, 'cannot require directory contents without directory name');

    var files = tryReadDir(dir);
    //extensions = extensions || _.keys(require.extensions);

    // sort files in lowercase alpha for linux
    files.sort(function(a, b) {
        a = a.toLowerCase();
        b = b.toLowerCase();

        if (a < b) {
            return -1;
        } else if (b < a) {
            return 1;
        } else {
            return 0;
        }
    });

    var results = [];
    files.forEach(function(filename) {
        // ignore index.js and files prefixed with underscore
        if (filename === 'index.js' || filename[0] === '_') {
            return;
        }

        var filepath = path.resolve(path.join(dir, filename));
        var stats = fs.statSync(filepath);

        // only require files supported by require.extensions (.txt .md etc.)
        if (stats.isFile()) {
            if (isPreferredExtension(filename))
                results.push(filepath);
            else
                debug('Skipping file %s - unknown extension', filepath);
        } else {
            debug('Skipping directory %s', filepath);
        }
    });

    return results;
}

function tryReadDir() {
    try {
        return fs.readdirSync.apply(fs, arguments);
    } catch (e) {
        return [];
    }
}

function resolveAppPath(rootDir, relativePath, resolveOptions) {
    var resolvedPath = tryResolveAppPath(rootDir, relativePath, resolveOptions);
    if (resolvedPath === undefined && !resolveOptions.optional) {
        var err = new Error('Cannot resolve path "' + relativePath + '"');
        err.code = 'PATH_NOT_FOUND';
        throw err;
    }
    return resolvedPath;
}

function tryResolveAppPath(rootDir, relativePath, resolveOptions) {
    var fullPath;
    var start = relativePath.substring(0, 2);

    /* In order to retain backward compatibility, we need to support
     * two ways how to treat values that are not relative nor absolute
     * path (e.g. `relativePath = 'foobar'`)
     *  - `resolveOptions.strict = true` searches in `node_modules` only
     *  - `resolveOptions.strict = false` attempts to resolve the value
     *     as a relative path first before searching `node_modules`
     */
    resolveOptions = resolveOptions || { strict: true };

    var isModuleRelative = false;
    if (relativePath[0] === '/') {
        fullPath = relativePath;
    } else if (start === './' || start === '..') {
        fullPath = path.resolve(rootDir, relativePath);
    } else if (!resolveOptions.strict) {
        isModuleRelative = true;
        fullPath = path.resolve(rootDir, relativePath);
    }

    if (fullPath) {
        // This check is needed to support paths pointing to a directory
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }

        try {
            fullPath = require.resolve(fullPath);
            return fullPath;
        } catch (err) {
            if (!isModuleRelative) {
                debug ('Skipping %s - %s', fullPath, err);
                return undefined;
            }
        }
    }

    // Handle module-relative path, e.g. `loopback/common/models`

    // Module.globalPaths is a list of globally configured paths like
    //   [ env.NODE_PATH values, $HOME/.node_modules, etc. ]
    // Module._nodeModulePaths(rootDir) returns a list of paths like
    //   [ rootDir/node_modules, rootDir/../node_modules, etc. ]
    var modulePaths = Module.globalPaths
        .concat(Module._nodeModulePaths(rootDir));

    fullPath = modulePaths
        .map(function(candidateDir) {
            var absPath = path.join(candidateDir, relativePath);
            try {
                // NOTE(bajtos) We need to create a proper String object here,
                // otherwise we can't attach additional properties to it
                /*jshint -W053 */
                var filePath = new String(require.resolve(absPath));
                filePath.unresolvedPath = absPath;
                return filePath;
            } catch (err) {
                return absPath;
            }
        })
        .filter(function(candidate) {
            return fs.existsSync(candidate.toString());
        })
        [0];

    if (fullPath) {
        if (fullPath.unresolvedPath && resolveOptions.fullResolve === false)
            return fullPath.unresolvedPath;
        // Convert String object back to plain string primitive
        return fullPath.toString();
    }

    debug ('Skipping %s - module not found', fullPath);
    return undefined;
}

exports.resolveRelativePaths = resolveRelativePaths;
function resolveRelativePaths(relativePaths, appRootDir) {
    var resolveOpts = { strict: false };
    relativePaths.forEach(function(relativePath, k) {
        var resolvedPath = tryResolveAppPath(appRootDir, relativePath, resolveOpts);
        if (resolvedPath !== undefined) {
            relativePaths[k] = resolvedPath;
        } else {
            debug ('skipping boot script %s - unknown file', relativePath);
        }
    });
}

function getExcludedExtensions() {
    return {
        '.json': '.json',
        '.node': 'node'
    };
}

function isPreferredExtension (filename) {
    var includeExtensions = require.extensions;

    var ext = path.extname(filename);
    return (ext in includeExtensions) && !(ext in getExcludedExtensions());
}

function fixFileExtension(filepath, files, onlyScriptsExportingFunction) {
    var results = [];
    var otherFile;

    /* Prefer coffee scripts over json */
    if (isPreferredExtension(filepath)) return filepath;

    var basename = path.basename(filepath, FILE_EXTENSION_JSON);
    var sourceDir = path.dirname(filepath);

    files.forEach(function(f) {
        otherFile = path.resolve(sourceDir, f);

        var stats = fs.statSync(otherFile);
        if (stats.isFile()) {
            var otherFileExtension = path.extname(f);

            if (!(otherFileExtension in getExcludedExtensions()) &&
                path.basename(f, otherFileExtension) == basename) {
                if (!onlyScriptsExportingFunction)
                    results.push(otherFile);
                else if (onlyScriptsExportingFunction &&
                    (typeof require.extensions[otherFileExtension]) === 'function') {
                    results.push(otherFile);
                }
            }
        }
    });
    return (results.length > 0 ? results[0] : undefined);
}

exports.resolveAppScriptPath = resolveAppScriptPath;
function resolveAppScriptPath(rootDir, relativePath, resolveOptions) {
    var resolvedPath = resolveAppPath(rootDir, relativePath, resolveOptions);
    if (!resolvedPath) {
        return false;
    }
    var sourceDir = path.dirname(resolvedPath);
    var files = tryReadDir(sourceDir);
    var fixedFile = fixFileExtension(resolvedPath, files, false);
    return (fixedFile === undefined ? resolvedPath : fixedFile);
}
