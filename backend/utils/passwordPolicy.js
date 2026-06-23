const MIN_PASSWORD_LENGTH = 8;

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  return null;
};

module.exports = { MIN_PASSWORD_LENGTH, validatePassword };
