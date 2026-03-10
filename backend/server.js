// server.js
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"
import { authenticate } from "./middleware/auth.js"

dotenv.config()

const app = express()      // <-- primer
const prisma = new PrismaClient()

// CORS (frontend Angular)
app.use(cors({
  origin: "http://localhost:4200"  // URL del teu frontend Angular
}))

app.use(express.json())

const PORT = process.env.PORT || 3000

// ----------------------
// REGISTRE USUARI
// ----------------------
app.post("/users", async (req, res) => {
  try {
    const { nom, email, password, perfil } = req.body
    if (!nom || !email || !password)
      return res.status(400).json({ error: "Falten camps obligatoris" })

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.usuari.create({
      data: { nom, email, password: hashedPassword, perfil: perfil || "usuari" }
    })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "24h" })

    res.json({ user: { id: user.id, nom: user.nom, email: user.email, perfil: user.perfil }, token })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error creant usuari" })
  }
})

// ----------------------
// LOGIN
// ----------------------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: "Falten camps" })

    const user = await prisma.usuari.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: "Usuari no trobat" })

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) return res.status(401).json({ error: "Password incorrecte" })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "24h" })
    res.json({ user: { id: user.id, nom: user.nom, email: user.email, perfil: user.perfil }, token })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error fent login" })
  }
})

// ----------------------
// CREAR DESPESA
// ----------------------
app.post("/despesa", authenticate, async (req, res) => {
  try {
    const { proveidor, cif, importTotal, iva, baseImposable, data, concepte, categoria, urlImatge } = req.body
    if (!proveidor || !importTotal || !data || !concepte || !categoria)
      return res.status(400).json({ error: "Falten camps obligatoris" })

    const despesa = await prisma.despesa.create({
      data: {
        proveidor,
        cif: cif || "",
        importTotal,
        iva: iva || null,
        baseImposable: baseImposable || null,
        data: new Date(data),
        concepte,
        categoria,
        urlImatge: urlImatge || "",
        usuariId: req.user.id,
        estat: "draft"
      }
    })
    res.json({ despesa })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error creant despesa" })
  }
})

// ----------------------
// LLEGIR DESPESES
// ----------------------
app.get("/despesa", authenticate, async (req, res) => {
  try {
    const despeses = await prisma.despesa.findMany({ where: { usuariId: req.user.id } })
    res.json({ despeses })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint despeses" })
  }
})

// ----------------------
// EDITAR DESPESA
// ----------------------
app.put("/despesa/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })
    if (despesa.usuariId !== req.user.id) return res.status(403).json({ error: "No tens permís per editar" })

    const updated = await prisma.despesa.update({ where: { id }, data: req.body })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualitzant despesa" })
  }
})

// ----------------------
// ELIMINAR DESPESA
// ----------------------
app.delete("/despesa/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })
    if (despesa.usuariId !== req.user.id) return res.status(403).json({ error: "No tens permís per eliminar" })

    await prisma.despesa.delete({ where: { id } })
    res.json({ message: "Despesa eliminada correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminant despesa" })
  }
})

// ----------------------
// APROVAR / REBUTJAR DESPESA
// ----------------------
app.post("/despesa/:id/aprovar", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })

    const updated = await prisma.despesa.update({ where: { id }, data: { estat: "aprovat" } })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error aprovant despesa" })
  }
})

app.post("/despesa/:id/rebutjar", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })

    const updated = await prisma.despesa.update({ where: { id }, data: { estat: "rebutjat" } })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error rebutjant despesa" })
  }
})

// ----------------------
// FILTRAR DESPESES
// ----------------------
app.get("/despesa/filter", authenticate, async (req, res) => {
  try {
    const { estat, categoria, data_inici, data_fi } = req.query
    const where = { usuariId: req.user.id }
    if (estat) where.estat = estat
    if (categoria) where.categoria = categoria
    if (data_inici || data_fi) where.data = {}
    if (data_inici) where.data.gte = new Date(data_inici)
    if (data_fi) where.data.lte = new Date(data_fi)

    const despeses = await prisma.despesa.findMany({ where })
    res.json({ despeses })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error filtrant despeses" })
  }
})

// ----------------------
// ESTADÍSTIQUES PER CATEGORIA
// ----------------------
app.get("/estadistiques/categoria", authenticate, async (req, res) => {
  try {
    const categories = await prisma.despesa.groupBy({
      by: ["categoria"],
      where: { usuariId: req.user.id },
      _sum: { importTotal: true }
    })
    res.json({ categories })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error generant estadístiques" })
  }
})

// ----------------------
// TOTAL DESPESES
// ----------------------
app.get("/estadistiques/total", authenticate, async (req, res) => {
  try {
    const total = await prisma.despesa.aggregate({
      where: { usuariId: req.user.id },
      _sum: { importTotal: true }
    })
    res.json({ total: total._sum.importTotal || 0 })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error calculant total" })
  }
})

// ----------------------
// START SERVER
// ----------------------
app.listen(PORT, () => console.log(`Servidor al port ${PORT}`))