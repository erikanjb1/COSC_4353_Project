const authService = require(
  "../services/authService"
);

function register(req, res, next) {
  try {
    const result =
      authService.registerUser({
        email: req.body.email,
        password: req.body.password,
        role: req.body.role
      });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

function login(req, res, next) {
  try {
    const result =
      authService.loginUser({
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