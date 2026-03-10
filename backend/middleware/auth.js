// middleware/auth.js
import jwt from "jsonwebtoken"

export const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  if (!authHeader) return res.status(401).json({ error: "Token no proporcionat" })

  const token = authHeader.split(" ")[1] // format: Bearer <token>
  if (!token) return res.status(401).json({ error: "Token no vàlid" })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: decoded.userId } // afegim usuari a req
    next()
  } catch (err) {
    return res.status(403).json({ error: "Token invàlid o caducat" })
  }
}