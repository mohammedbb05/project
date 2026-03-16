// server.js
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import fs from "fs"
import axios from "axios"
import { PrismaClient } from "@prisma/client"
import { authenticate, requirePerfil } from "./middleware/auth.js"
import { upload } from "./middleware/upload.js"

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000

// ----------------------
// MIDDLEWARE
// ----------------------
app.use(cors({
  origin: "http://localhost:4200"
}))
app.use(express.json())
app.use('/uploads', express.static('uploads'))

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

    const token = jwt.sign(
      { userId: user.id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )
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
    if (!email || !password)
      return res.status(400).json({ error: "Falten camps" })

    const user = await prisma.usuari.findUnique({ where: { email } })
    if (!user)
      return res.status(401).json({ error: "Usuari no trobat" })

    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword)
      return res.status(401).json({ error: "Password incorrecte" })

    const token = jwt.sign(
      { userId: user.id, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    )
    res.json({ user: { id: user.id, nom: user.nom, email: user.email, perfil: user.perfil }, token })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error fent login" })
  }
})

// ----------------------
// OCR
// ----------------------
app.post("/ocr", authenticate, upload.single('imatge'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Cal pujar una imatge" })

    const imageBuffer = fs.readFileSync(req.file.path)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = req.file.mimetype

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}` }
              },
              {
                type: 'text',
                text: `Analitza aquest tiquet o factura i extreu les dades en format JSON.
Retorna NOMÉS el JSON, sense cap text addicional, amb aquesta estructura exacta:
{
  "proveidor": "nom de l'empresa o establiment",
  "cif": "CIF o NIF de l'empresa (o null si no apareix)",
  "importTotal": número amb decimals,
  "iva": número percentatge IVA (o null si no apareix),
  "baseImposable": número amb decimals (o null si no apareix),
  "data": "data en format YYYY-MM-DD",
  "concepte": "descripció breu del que s'ha comprat",
  "categoria": "una d'aquestes: Dietes, Gasolina, Transport, Parking, Oficina, Altres"
}`
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const content = response.data.choices[0].message.content
    const cleanJson = content.replace(/```json|```/g, '').trim()
    const dadesExtretes = JSON.parse(cleanJson)

    res.json({
      dades: dadesExtretes,
      urlImatge: `http://localhost:3000/uploads/${req.file.filename}`
    })

  } catch (error) {
    console.error('Error OCR:', error.response?.data || error.message)
    res.status(500).json({ error: "Error processant la imatge" })
  }
})

// ----------------------
// LLEGIR DESPESES
// ----------------------
app.get("/despesa", authenticate, async (req, res) => {
  try {
    let despeses

    if (req.user.perfil === 'admin' || req.user.perfil === 'validador') {
      despeses = await prisma.despesa.findMany({
        include: {
          usuari: { select: { nom: true, email: true } }
        }
      })
    } else {
      despeses = await prisma.despesa.findMany({
        where: { usuariId: req.user.id }
      })
    }

    res.json({ despeses })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint despeses" })
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
// EDITAR DESPESA
// ----------------------
app.put("/despesa/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa)
      return res.status(404).json({ error: "Despesa no trobada" })
    if (despesa.usuariId !== req.user.id && req.user.perfil !== 'admin')
      return res.status(403).json({ error: "No tens permís per editar" })

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
    if (!despesa)
      return res.status(404).json({ error: "Despesa no trobada" })
    if (despesa.usuariId !== req.user.id && req.user.perfil !== 'admin')
      return res.status(403).json({ error: "No tens permís per eliminar" })

    await prisma.despesa.delete({ where: { id } })
    res.json({ message: "Despesa eliminada correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminant despesa" })
  }
})

// ----------------------
// APROVAR DESPESA
// ----------------------
app.post("/despesa/:id/aprovar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({
      where: { id },
      include: { usuari: true }
    })
    if (!despesa)
      return res.status(404).json({ error: "Despesa no trobada" })

    const updated = await prisma.despesa.update({
      where: { id },
      data: { estat: "aprovat" }
    })

    // ✅ Envia notificació a n8n
    try {
      await axios.post('http://localhost:5678/webhook/despesa-aprovada', {
        nomUsuari: despesa.usuari.nom,
        emailUsuari: despesa.usuari.email,
        proveidor: despesa.proveidor,
        importTotal: despesa.importTotal
      })
      console.log('Notificació enviada a n8n ✅')
    } catch (webhookError) {
      console.log('Webhook n8n no disponible:', webhookError.message)
    }

    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error aprovant despesa" })
  }
})

// ----------------------
// REBUTJAR DESPESA
// ----------------------
app.post("/despesa/:id/rebutjar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa)
      return res.status(404).json({ error: "Despesa no trobada" })

    const updated = await prisma.despesa.update({
      where: { id },
      data: { estat: "rebutjat" }
    })
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
    const where = {}

    if (req.user.perfil === 'usuari') {
      where.usuariId = req.user.id
    }

    if (estat) where.estat = estat
    if (categoria) where.categoria = categoria
    if (data_inici || data_fi) {
      where.data = {}
      if (data_inici) where.data.gte = new Date(data_inici)
      if (data_fi) where.data.lte = new Date(data_fi)
    }

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
    const where = req.user.perfil === 'usuari' ? { usuariId: req.user.id } : {}
    const categories = await prisma.despesa.groupBy({
      by: ["categoria"],
      where,
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
    const where = req.user.perfil === 'usuari' ? { usuariId: req.user.id } : {}
    const total = await prisma.despesa.aggregate({
      where,
      _sum: { importTotal: true }
    })
    res.json({ total: total._sum.importTotal || 0 })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error calculant total" })
  }
})

// ----------------------
// LLISTAR USUARIS — només admin
// ----------------------
app.get("/users", authenticate, requirePerfil('admin'), async (req, res) => {
  try {
    const usuaris = await prisma.usuari.findMany({
      select: { id: true, nom: true, email: true, perfil: true }
    })
    res.json({ usuaris })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint usuaris" })
  }
})

// ----------------------
// FULLES DE DESPESA
// ----------------------

// Crear fulla
app.post("/fulla", authenticate, async (req, res) => {
  try {
    const { titol, mes, any } = req.body
    if (!titol || !mes || !any)
      return res.status(400).json({ error: "Falten camps obligatoris" })

    const fulla = await prisma.fullaDespesa.create({
      data: {
        titol,
        mes,
        any: parseInt(any),
        estat: "draft",
        usuariId: req.user.id
      }
    })
    res.json({ fulla })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error creant fulla" })
  }
})

// Llistar fulles
app.get("/fulla", authenticate, async (req, res) => {
  try {
    let fulles

    if (req.user.perfil === 'admin' || req.user.perfil === 'validador') {
      fulles = await prisma.fullaDespesa.findMany({
        include: {
          usuari: { select: { nom: true, email: true } },
          despeses: true
        }
      })
    } else {
      fulles = await prisma.fullaDespesa.findMany({
        where: { usuariId: req.user.id },
        include: { despeses: true }
      })
    }

    res.json({ fulles })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint fulles" })
  }
})

// Veure fulla per ID
app.get("/fulla/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({
      where: { id },
      include: {
        usuari: { select: { nom: true, email: true } },
        despeses: true
      }
    })
    if (!fulla)
      return res.status(404).json({ error: "Fulla no trobada" })

    res.json({ fulla })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint fulla" })
  }
})

// Assignar despesa a fulla
app.post("/fulla/:id/despesa/:despesaId", authenticate, async (req, res) => {
  try {
    const fullaId = parseInt(req.params.id)
    const despesaId = parseInt(req.params.despesaId)

    const fulla = await prisma.fullaDespesa.findUnique({ where: { id: fullaId } })
    if (!fulla)
      return res.status(404).json({ error: "Fulla no trobada" })
    if (fulla.usuariId !== req.user.id)
      return res.status(403).json({ error: "No tens permís" })

    const despesa = await prisma.despesa.update({
      where: { id: despesaId },
      data: { fullaId }
    })
    res.json({ despesa })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error assignant despesa" })
  }
})

// Enviar fulla a aprovació
app.post("/fulla/:id/enviar", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({ where: { id } })
    if (!fulla)
      return res.status(404).json({ error: "Fulla no trobada" })
    if (fulla.usuariId !== req.user.id)
      return res.status(403).json({ error: "No tens permís" })

    const updated = await prisma.fullaDespesa.update({
      where: { id },
      data: { estat: "pendent" }
    })
    res.json({ fulla: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error enviant fulla" })
  }
})

// Aprovar fulla
app.post("/fulla/:id/aprovar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({
      where: { id },
      include: { usuari: true }
    })
    if (!fulla)
      return res.status(404).json({ error: "Fulla no trobada" })

    await prisma.despesa.updateMany({
      where: { fullaId: id },
      data: { estat: "aprovat" }
    })

    const updated = await prisma.fullaDespesa.update({
      where: { id },
      data: { estat: "aprovat" }
    })

    // ✅ Envia notificació a n8n
    try {
      await axios.post('http://localhost:5678/webhook/despesa-aprovada', {
        nomUsuari: fulla.usuari.nom,
        emailUsuari: fulla.usuari.email,
        proveidor: `Fulla: ${fulla.titol}`,
        importTotal: fulla.despeses?.reduce((acc, d) => acc + d.importTotal, 0) || 0
      })
      console.log('Notificació fulla enviada a n8n ✅')
    } catch (webhookError) {
      console.log('Webhook n8n no disponible:', webhookError.message)
    }

    res.json({ fulla: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error aprovant fulla" })
  }
})

// Rebutjar fulla
app.post("/fulla/:id/rebutjar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({ where: { id } })
    if (!fulla)
      return res.status(404).json({ error: "Fulla no trobada" })

    await prisma.despesa.updateMany({
      where: { fullaId: id },
      data: { estat: "rebutjat" }
    })

    const updated = await prisma.fullaDespesa.update({
      where: { id },
      data: { estat: "rebutjat" }
    })
    res.json({ fulla: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error rebutjant fulla" })
  }
})

// Eliminar fulla
app.delete("/fulla/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({ where: { id } })
    if (!fulla)
      return res.status(404).json({ error: "Fulla no trobada" })
    if (fulla.usuariId !== req.user.id && req.user.perfil !== 'admin')
      return res.status(403).json({ error: "No tens permís" })

    await prisma.despesa.updateMany({
      where: { fullaId: id },
      data: { fullaId: null }
    })

    await prisma.fullaDespesa.delete({ where: { id } })
    res.json({ message: "Fulla eliminada correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminant fulla" })
  }
})

// ----------------------
// START SERVER
// ----------------------
app.listen(PORT, () => console.log(`Servidor al port ${PORT}`))