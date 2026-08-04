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

  if ( typeof input.firstName !== "string" || input.firstName.trim() === "") {
    errors.push(
      "First name is required."
    );
  } else if (
    input.firstName.trim().length > 30
  ) {
    errors.push(
      "First name must not exceed 30 characters."
    );
  }

  if ( typeof input.lastName !== "string" || input.lastName.trim() === "") {
    errors.push(
      "Last name is required."
    );
  } else if (
    input.lastName.trim().length > 30
  ) {
    errors.push(
      "Last name must not exceed 30 characters."
    );
  }

  if ( input.phoneNumber !== undefined && input.phoneNumber !== null && typeof input.phoneNumber !== "string") {
    errors.push(
      "Phone number must be text."
    );
  } else if (
    typeof input.phoneNumber === "string" &&
    input.phoneNumber.trim().length > 20
  ) {
    errors.push(
      "Phone number must not exceed 20 characters."
    );
  }

  if ( typeof input.email !== "string" || input.email.trim() === "") {
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

  if ( typeof input.password !== "string" || input.password === "") {
    errors.push(
      "Password is required."
    );
  } else if ( input.password.length < 8 || input.password.length > 30) {
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
  firstName,
  lastName,
  email,
  phoneNumber,
  password
}) {
  validateRegistrationInput({
    firstName,
    lastName,
    email,
    phoneNumber,
    password
  });

  const normalizedEmail =
    email.trim().toLowerCase();

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsers] =
      await connection.execute(
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
      await connection.execute(
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

    const userId = result.insertId;

    await connection.execute(
      `
      INSERT INTO UserProfile
        (
          User_ID,
          FirstName,
          LastName,
          Phone_Number
        )
      VALUES
        (?, ?, ?, ?)
      `,
      [
        userId,
        firstName.trim(),
        lastName.trim(),
        phoneNumber
          ? phoneNumber.trim()
          : null
      ]
    );

    await connection.commit();

    return {
      id: userId,
      email: normalizedEmail,
      role: "user",
      profile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber:
          phoneNumber
            ? phoneNumber.trim()
            : null
      }
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


async function loginUser({ email, password }) { 
  validateLoginInput({ email, password }); 
  
  const normalizedEmail = email.trim().toLowerCase(); 
  const [rows] = await pool.execute( 
    `
    SELECT User_ID, Email, Password, Role 
      FROM UserCredentials 
      WHERE Email = ? 
    `, 
      [normalizedEmail] 
    ); 

  if (rows.length === 0) { 
    throw new HttpError( 
      401, "Email or password is incorrect."
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