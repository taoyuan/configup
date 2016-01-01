var t = require('chai').assert;
var configup = require('../');

describe('configup', function () {
  it('load with deep merge with default', function () {
    var config = configup.loadDeepMerge(__dirname + '/fixtures/config/foo');
    t.ok(config);
    t.equal(config.foo, 'hello');
    t.equal(config.bar, 'world');
  });

  it('load with deep merge with strict mode', function () {
    var config = configup.loadDeepMerge(__dirname + '/fixtures/config/foo', true);
    t.ok(config);
    t.ok(config.foo);
    t.notOk(config.bar);
    t.equal(config.foo, 'hello');
  });

  it('should return undefined if no config files exists', function () {
    var config = configup.loadDeepMerge(__dirname + '/fixtures/config/not_exist');
    t.isUndefined(config);
  });
});
