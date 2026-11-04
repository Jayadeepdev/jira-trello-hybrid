export const validate = (schema) => async (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      errors: error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
};