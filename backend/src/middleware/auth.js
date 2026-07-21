const HttpError = require("../utils/httpError");

function requireAuth(req, _res, next) {
  const userId = req.header("x-user-id");
  const role = req.header("x-user-role");

  if (!userId || !role) {
    return next(
      new HttpError(
        401,
        "Authentication is required."
      )
    );
  }

  if (
    !["user", "administrator"].includes(role)
  ) {
    return next(
      new HttpError(
        403,
        "Invalid user role."
      )
    );
  }

  if (userId.length > 100) {
    return next(
      new HttpError(
        400,
        "User ID must not exceed 100 characters."
      )
    );
  }

  req.user = {
    id: userId,
    role: role
  };

  next();
}

function requireAdministrator(req, _res, next) {
  if (
    req.user?.role !== "administrator"
  ) {
    return next(
      new HttpError(
        403,
        "Administrator access is required."
      )
    );
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdministrator
};