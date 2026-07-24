const crypto = require("node:crypto");

const {
  users
} = require("../data/store");

const HttpError = require(
  "../utils/httpError"
);

function validateRegistrationInput(input) {
  const errors = [];
  //invalid input validation
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new HttpError(
      400,
      "Invalid Request Form."
    );
  }

  if (
    typeof input.email !== "string" ||
    input.email.trim() === ""
  ) {
    errors.push(
      "Email is required."
    );
  } else if (
    input.email.trim().length > 100
  ) {
    errors.push(
      "Email must not exceed 100 characters."
    );
  } else {
    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(input.email.trim())) {
      errors.push(
        "Email must be a valid email address."
      );
    }
  }

  if (
    typeof input.password !== "string" ||
    input.password === ""
  ) {
    errors.push(
      "Password is required."
    );
  } else if (
    input.password.length < 8 ||
    input.password.length > 30
  ) {
    errors.push(
      "Password must contain between 8 and 30 characters."
    );
  }

  if (
    input.role !== undefined &&
    !["user", "administrator"].includes(
      input.role
    )
  ) {
    errors.push(
      "Role must be user or administrator."
    );
  }

  if (errors.length > 0) {
    throw new HttpError(
      400,
      "Validation failed.",
      errors
    );
  }
}

function validateLoginInput(input) {
  const errors = [];

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new HttpError(
      400,
      "Invalid Request Form."
    );
  }

  if (
    typeof input.email !== "string" ||
    input.email.trim() === ""
  ) {
    errors.push("Email is required.");
  }

  if (
    typeof input.password !== "string" ||
    input.password === ""
  ) {
    errors.push("Password is required.");
  }

  if (errors.length > 0) {
    throw new HttpError(
      400,
      "Validation failed.",
      errors
    );
  }
}

function registerUser({
  email,
  password,
  role
}) {
  validateRegistrationInput({
    email,
    password,
    role
  });

  const normalizedEmail =
    email.trim().toLowerCase();

  const existingUser = users.find(
    function (user) {
      return user.email === normalizedEmail;
    }
  );

  if (existingUser) {
    throw new HttpError(
      409,
      "An account with this email already exists."
    );
  }

  const newUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    password,
    role: "user",
    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  return {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    createdAt: newUser.createdAt
  };
}

function loginUser({
  email,
  password
}) {
  validateLoginInput({
    email,
    password
  });

  const normalizedEmail =
    email.trim().toLowerCase();

  const user = users.find(
    function (item) {
      return (
        item.email === normalizedEmail &&
        item.password === password
      );
    }
  );

  if (!user) {
    throw new HttpError(
      401,
      "Email or password is incorrect."
    );
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    },

    token: `mock-token-${user.id}`
  };
}

module.exports = {
  validateRegistrationInput,
  validateLoginInput,
  registerUser,
  loginUser
};