// middleware/auth.js
import jwt from "jsonwebtoken"

export const authenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  if (!authHeader) return res.status(401).json({ error: "Token no proporcionat" })

  const token = authHeader.split(" ")[1]
  if (!token) return res.status(401).json({ error: "Token no vàlid" })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: decoded.userId, perfil: decoded.perfil }  // ✅ afegit perfil
    next()
  } catch (err) {
    return res.status(403).json({ error: "Token invàlid o caducat" })
  }
}

// ✅ Middleware per verificar rol
export const requirePerfil = (...perfils) => {
  return (req, res, next) => {
    if (!perfils.includes(req.user.perfil)) {
      return res.status(403).json({ error: "No tens permís per fer aquesta acció" })
    }
    next()
  }
}