const bcrypt = require("bcrypt");

const { pool } = require("./db");

async function seedAdmin() {
  const email = "admin@queuesmart.com";
  const password = "Admin123!";

  const [existingUsers] =
    await pool.execute(
      `
      SELECT User_ID
      FROM UserCredentials
      WHERE Email = ?
      `,
      [email]
    );

  if (existingUsers.length > 0) {
    console.log(
      "Admin account already exists."
    );

    await pool.end();
    return;
  }

  const hashedPassword =
    await bcrypt.hash(password, 10);

  await pool.execute(
    `
    INSERT INTO UserCredentials
      (Email, Password, Role)
    VALUES
      (?, ?, ?)
    `,
    [
      email,
      hashedPassword,
      "administrator"
    ]
  );

  console.log(
    "Admin account created."
  );

  await pool.end();
}

seedAdmin().catch(function (error) {
  console.error(
    "Failed to create admin:",
    error.message
  );

  process.exit(1);
});