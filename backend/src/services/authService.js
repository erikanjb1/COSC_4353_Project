const bcrypt = require("bcrypt");

const { pool } = require("../data/db");

const HttpError = require("../utils/httpError");

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

async function registerUser({
  email,
  password
}) {
  validateRegistrationInput({
    email,
    password
  });

  const normalizedEmail =
    email.trim().toLowerCase();

  const [existingUsers] =
    await pool.execute(
      `
      SELECT User_ID
      FROM UserCredentials
      WHERE Email = ?
      `,
      [normalizedEmail]
    );

  if (existingUsers.length > 0) {
    throw new HttpError(
      409,
      "An account with this email already exists."
    );
  }

  const hashedPassword =
    await bcrypt.hash(password, 10);

  const [result] =
    await pool.execute(
      `
      INSERT INTO UserCredentials
        (Email, Password, Role)
      VALUES
        (?, ?, ?)
      `,
      [
        normalizedEmail,
        hashedPassword,
        "user"
      ]
    );

  return {
    id: result.insertId,
    email: normalizedEmail,
    role: "user"
  };
}

async function loginUser({
  email,
  password
}) {
  validateLoginInput({
    email,
    password
  });

  const normalizedEmail =
    email.trim().toLowerCase();

  const [rows] =
    await pool.execute(
      `
      SELECT
        User_ID,
        Email,
        Password,
        Role
      FROM UserCredentials
      WHERE Email = ?
      `,
      [normalizedEmail]
    );

  if (rows.length === 0) {
    throw new HttpError(
      401,
      "Email or password is incorrect."
    );
  }

  const user = rows[0];

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.Password
    );

  if (!passwordMatches) {
    throw new HttpError(
      401,
      "Email or password is incorrect."
    );
  }

  return {
    user: {
      id: user.User_ID,
      email: user.Email,
      role: user.Role
    },

    token: `mock-token-${user.User_ID}`
  };
}

module.exports = {
  validateRegistrationInput,
  validateLoginInput,
  registerUser,
  loginUser
};