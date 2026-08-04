const authService = require(
  "../services/authService"
);

async function register(req, res, next) {
  try {
    const result =
      await authService.registerUser({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        password: req.body.password
      });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result =
      await authService.loginUser({
        email: req.body.email,
        password: req.body.password
      });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login
};