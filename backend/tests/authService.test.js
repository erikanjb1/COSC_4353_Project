const test = require("node:test");
const assert = require(
  "node:assert/strict"
);

const {
  users,
  resetStore
} = require("../src/data/store");

const {
  registerUser,
  loginUser
} = require(
  "../src/services/authService"
);

test.beforeEach(function () {
  resetStore();
});

test(
  "registers a valid user",
  function () {
    const result = registerUser({
      email: "student@example.com",
      password: "Password123",
      role: "user"
    });

    assert.equal(
      result.email,
      "student@example.com"
    );

    assert.equal(
      result.role,
      "user"
    );

    assert.equal(users.length, 1);
  }
);

test(
  "rejects duplicate emails",
  function () {
    registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    assert.throws(
      function () {
        registerUser({
          email: "student@example.com",
          password: "AnotherPassword123"
        });
      },
      function (error) {
        return error.status === 409;
      }
    );
  }
);

test(
  "logs in a registered user",
  function () {
    registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    const result = loginUser({
      email: "student@example.com",
      password: "Password123"
    });

    assert.equal(
      result.user.email,
      "student@example.com"
    );

    assert.equal(
      result.user.role,
      "user"
    );
  }
);

test(
  "rejects an incorrect password",
  function () {
    registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    assert.throws(
      function () {
        loginUser({
          email: "student@example.com",
          password: "WrongPassword"
        });
      },
      function (error) {
        return error.status === 401;
      }
    );
  }
);