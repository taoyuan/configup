
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