"use strict";

require("core-js/modules/es6.promise");

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const DataStream = require(process.env.SCRAMJET_TEST_HOME || "../../").DataStream;

const StreamError = require(process.env.SCRAMJET_TEST_HOME || "../../").errors.StreamError;

const getStream = () => {
  const ret = new DataStream();
  let cnt = 0;

  for (let i = 0; i < 100; i++) ret.write({
    val: cnt++
  });

  process.nextTick(() => ret.end());
  return ret;
};

const decorateAsynchronously =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(function* (chunk) {
    return new Promise(res => {
      setTimeout(() => res(Object.assign({
        ref: true
      }, chunk)), 7 + 3 * (chunk.val % 4));
    });
  });

  return function decorateAsynchronously(_x) {
    return _ref.apply(this, arguments);
  };
}();

const decorateAsynchronouslyWithError =
/*#__PURE__*/
function () {
  var _ref2 = _asyncToGenerator(function* (chunk) {
    if (chunk.val === 22) {
      return new Promise((res, rej) => {
        setTimeout(() => rej(new Error("Err")), 100);
      });
    } else {
      return decorateAsynchronously(chunk);
    }
  });

  return function decorateAsynchronouslyWithError(_x2) {
    return _ref2.apply(this, arguments);
  };
}();

const decorateAsynchronouslyWithLotsOfErrors =
/*#__PURE__*/
function () {
  var _ref3 = _asyncToGenerator(function* (chunk) {
    if (!(chunk.val % 4)) {
      throw new Error("err");
    } else {
      return decorateAsynchronously(chunk);
    }
  });

  return function decorateAsynchronouslyWithLotsOfErrors(_x3) {
    return _ref3.apply(this, arguments);
  };
}();

module.exports = {
  test_ok(test) {
    return _asyncToGenerator(function* () {
      test.plan(3);
      const a = [];
      return getStream().map(decorateAsynchronously).each(i => a.push(i)).on("end", () => {
        test.ok(a[0].ref, "called asynchronous map");
        test.equals(a.length, 100, "accumulated all items");
        test.ok(a[0].val === 0 && a[1].val === 1 && a[2].val === 2 && a[3].val === 3, "Order should be preserved " + JSON.stringify(a[3]));
        test.end();
      }).on("error", e => test.ok(false, "should not fail! " + e)).run();
    })();
  },

  test_err(test) {
    return _asyncToGenerator(function* () {
      if (process.env.TRAVIS === "true") return test.end();
      test.plan(3);
      return getStream().map(decorateAsynchronouslyWithError).once("error", (e, chunk) => {
        test.ok(true, "Should emit error");
        test.ok(e instanceof Error, "Thrown should be an instance of Error");
        test.equals(chunk.val, 22, "Should error on and pass catch 22... I mean chunk...");
        test.end();
      }).once("end", () => {
        test.fail("Should not end!");
        test.end();
      }).run();
    })();
  },

  test_error_flow(test) {
    test.plan(2);
    let z = 0;
    return getStream().map(decorateAsynchronouslyWithLotsOfErrors).catch((e, chunk) => (z++, chunk)).toArray().then(ret => {
      test.equals(z, 25, "Should call catch on every fourth element");
      test.equals(ret.length, 100, "Should contain all elements");
      test.end();
    }, err => {
      test.fail(err, "Should not throw");
      test.end();
    });
  },

  test_error_filtering(test) {
    test.plan(2);
    let z = 0;
    return getStream().map(decorateAsynchronouslyWithLotsOfErrors).catch(() => (z++, undefined)).toArray().then(ret => {
      test.equals(z, 25, "Should call catch on every fourth element");
      test.equals(ret.length, 75, "Should contain all elements");
      test.end();
    }, err => {
      test.fail(err, "Should not throw");
      test.end();
    });
  },

  test_catch(test) {
    test.plan(5);
    return getStream().map(decorateAsynchronouslyWithError).catch(({
      cause,
      chunk
    }) => {
      test.equal(cause.message, "Err", "Should pass the error in {cause}");
      test.equal(chunk.val, 22, "Should fail on the catch 22... chunk...");
    }).toArray().then(ret => {
      test.equals(ret.length, 99, "Should contain all items except one");
      test.equals(ret[21].val, 21, "Should preserver order of elements (part 1)");
      test.equals(ret[22].val, 23, "Should preserver order of elements (part 2)");
      test.end();
    }, err => {
      test.fail(err);
      test.end();
    });
  },

  test_catch_chaining(test) {
    test.plan(10);
    let cause1 = null;
    return getStream().map(decorateAsynchronouslyWithError).catch(({
      cause,
      chunk
    }) => {
      test.equal(cause.message, "Err", "Should pass the error in {cause}");
      test.equal(chunk.val, 22, "Should fail on the catch 22... chunk...");
      cause1 = cause;
      throw cause;
    }).catch(err => {
      const cause = err.cause,
            chunk = err.chunk;
      test.ok(err instanceof StreamError, "Should be passing StreamErrors");
      test.equal(cause1, cause, "Should pass on the same cause");
      test.equal(chunk.val, 22, "Should pass on the same chunk");
      throw cause1 = new Error("Err2");
    }).pipe(new DataStream()).catch(({
      cause
    }) => {
      test.equal(cause1, cause, "Should pass the new error");
      throw cause;
    }).pipe(new DataStream()).catch(({
      cause
    }) => {
      test.equal(cause1, cause, "Should pass the new error");
    }).toArray().then(ret => {
      test.equals(ret.length, 99, "Should not reject and contain all items except one");
      test.equals(ret[21].val, 21, "Should preserver order of elements (part 1)");
      test.equals(ret[22].val, 23, "Should preserver order of elements (part 2)");
      test.end();
    }, err => {
      test.fail(err);
      test.end();
    });
  }

};