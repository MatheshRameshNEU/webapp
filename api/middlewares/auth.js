const bcrypt = require('bcrypt');

const authMiddleware = (User) => {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json();
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json();
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {

        return res.status(401).json();
      }
      if (!user.email_verified) {
        return res.status(403).json();
      }
      req.user = user; 
      next(); 
    } catch (error) {
      return res.status(400).json();
    }
  };
};

module.exports = authMiddleware;
