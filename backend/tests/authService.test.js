const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/data/db");

const {
  registerUser,
  loginUser
} = require(
  "../src/services/authService"
);

test.beforeEach(async function () {
  await pool.execute(
    "DELETE FROM UserCredentials WHERE Email LIKE ?",
    ["%example.com"]
  );
});

test(
  "registers a valid user",
  async function () {
    const result = await registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    assert.equal(
      result.email,
      "student@example.com"
    );

    assert.equal(
      result.role,
      "user"
    );
  }
);

test(
  "rejects duplicate emails",
  async function () {
    await registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    await assert.rejects(
      async function () {
        await registerUser({
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
  async function () {
    await registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    const result = await loginUser({
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
  async function () {
    await registerUser({
      email: "student@example.com",
      password: "Password123"
    });

    await assert.rejects(
      async function () {
        await loginUser({
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

test("rejects login with missing password", 
  async function () {
    await assert.rejects(
      async function () {
        await loginUser({ 
          email: "a@b.com" 
        });
      }, 
      function (error) { 
        return error.status === 400; 
      }
    );
  }
);

test("rejects password shorter than 8 characters", 
  async function () {
    await assert.rejects(
      async function () {
        await registerUser({ 
          email: "a@b.com", 
          password: "short" 
        });
      }, 
      function (error) { 
        return error.status === 400; 
      }
    );
  }
);

test("rejects password longer than 30 characters",
  async function () {
    await assert.rejects(
      async function () {
      await registerUser({ 
        email: "a@b.com", 
        password: "P".repeat(31) 
      });
    }, 
    function (error) { 
      return error.status === 400; 
    });
  }
);

test("rejects registration with missing email", 
  async function () {
    await assert.rejects(
      async function () {
        await registerUser({ 
          password: "Password123" 
        });
      },
      function (error) {
        return error.status === 400;
      }
    );
  }
);

test("rejects registration with invalid email format", 
  async function () {
    await assert.rejects(
      async function () {
        await registerUser({ 
          email: "not-an-email", 
          password: "Password123" 
        });
      }, 
      function (error) { 
        return error.status === 400; 
      }
    );
  }
);

test("rejects login with missing email", 
  async function () {
    await assert.rejects(
      async function () {
        await loginUser({ 
          password: "Password123" 
        });
      }, 
    function (error) { 
      return error.status === 400;
    });
  }
);