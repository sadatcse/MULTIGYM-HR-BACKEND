import jwt from 'jsonwebtoken';

// Verbatim port of config/authConfig.js. Unused in the original app (nothing imports
// it) and unused here — kept for parity with the affiliate/employee auth system that
// was apparently never finished.
export function generateToken(id: string): string {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: '2d',
  });
}
