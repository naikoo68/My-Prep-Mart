import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Verifies the JWT from the Authorization header and attaches req.user.
export async function protect(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account has been blocked" });
    }
    if (user.expiresAt && user.expiresAt.getTime() < Date.now()) {
      return res.status(403).json({ message: "This temporary account has expired" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
}

// Like `protect`, but does NOT block EXPIRED accounts — it only requires a
// valid token and a non-blocked user. Used for endpoints an expired client
// must still reach: viewing their profile and upgrading/renewing their plan.
export async function attachUser(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) token = header.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authorized, no token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    if (user.status === "blocked") return res.status(403).json({ message: "Your account has been blocked" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
}

// Restricts a route to specific roles, e.g. authorize("admin").
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

// Attaches req.user if a valid token is present, but never blocks the request.
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      const expired = user?.expiresAt && user.expiresAt.getTime() < Date.now();
      if (user && user.status !== "blocked" && !expired) req.user = user;
    } catch {
      /* ignore invalid token for optional auth */
    }
  }
  next();
}
