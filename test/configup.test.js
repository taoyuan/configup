var t = require('chai').assert;
var configup = require('../');

describe('configup', function () {
    it('load with deep merge', function () {
        var config = configup.loadDeepMerge(__dirname + '/fixtures/config/foo');
        t.ok(config);
        t.equal(config.foo, 'hello');
    });
});