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

app.use(cors({ origin: "http://localhost:4200" }))
app.use(express.json())
app.use('/uploads', express.static('uploads'))

// ----------------------
// HELPER — Envia notificació
// ----------------------
const enviarNotificacio = async (data) => {
  try {
    await axios.post('http://localhost:5678/webhook/despesa-aprovada', data)
    console.log('Notificació enviada ✅')
  } catch (err) {
    console.log('Webhook n8n no disponible:', err.message)
  }
}

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
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: 'text', text: `Analitza aquest tiquet o factura i extreu les dades en format JSON.
Retorna NOMÉS el JSON, sense cap text addicional, amb aquesta estructura exacta:
{
  "proveidor": "nom de l'empresa o establiment",
  "cif": "CIF o NIF de l'empresa (o null si no apareix)",
  "importTotal": número amb decimals,
  "iva": número percentatge IVA (o null si no apareix),
  "baseImposable": número amb decimals (o null si no apareix),
  "data": "data en format YYYY-MM-DD",
  "concepte": "descripció breu del que s'ha comprat",
  "categoria": "una d'aquestes: Dietes, Gasolina, Transport, Parking, Restaurant, Oficina, Altres"
}` }
          ]
        }]
      },
      { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } }
    )

    const content = response.data.choices[0].message.content
    const cleanJson = content.replace(/```json|```/g, '').trim()
    const dadesExtretes = JSON.parse(cleanJson)

    res.json({ dades: dadesExtretes, urlImatge: `http://localhost:3000/uploads/${req.file.filename}` })

  } catch (error) {
    console.error('Error OCR:', error.response?.data || error.message)
    res.status(500).json({ error: "Error processant la imatge" })
  }
})

// ----------------------
// LLEGIR DESPESES ✅ retorna comentari
// ----------------------
app.get("/despesa", authenticate, async (req, res) => {
  try {
    let despeses

    if (req.user.perfil === 'admin' || req.user.perfil === 'validador') {
      despeses = await prisma.despesa.findMany({
        include: { usuari: { select: { nom: true, email: true } } }
      })
    } else {
      // ✅ select explícit per incloure comentari
      despeses = await prisma.despesa.findMany({
        where: { usuariId: req.user.id },
        select: {
          id: true,
          proveidor: true,
          cif: true,
          importTotal: true,
          iva: true,
          baseImposable: true,
          data: true,
          concepte: true,
          categoria: true,
          urlImatge: true,
          usuariId: true,
          estat: true,
          fullaId: true,
          comentari: true  // ✅ inclòs
        }
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

    const usuariCreador = await prisma.usuari.findUnique({
      where: { id: req.user.id },
      select: { nom: true }
    })

    const despesa = await prisma.despesa.create({
      data: {
        proveidor, cif: cif || "", importTotal,
        iva: iva || null, baseImposable: baseImposable || null,
        data: new Date(data), concepte, categoria,
        urlImatge: urlImatge || "", usuariId: req.user.id, estat: "draft"
      }
    })

    const validadors = await prisma.usuari.findMany({
      where: { perfil: { in: ['validador', 'admin'] } },
      select: { nom: true, email: true }
    })

    for (const validador of validadors) {
      await enviarNotificacio({
        nomUsuari: validador.nom,
        emailUsuari: validador.email,
        proveidor: proveidor,
        importTotal: importTotal,
        subject: `🆕 Nova despesa pendent d'aprovació`,
        missatge: `L'usuari ${usuariCreador.nom} ha creat una nova despesa de ${importTotal}€ a ${proveidor}. Accedeix al sistema per revisar-la i aprovar-la.`
      })
    }

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
    if (despesa.usuariId !== req.user.id && req.user.perfil !== 'admin' && req.user.perfil !== 'validador')
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

    if (req.user.perfil !== 'admin' && req.user.perfil !== 'validador' && despesa.usuariId !== req.user.id)
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
      where: { id }, include: { usuari: true }
    })
    if (!despesa)
      return res.status(404).json({ error: "Despesa no trobada" })

    const updated = await prisma.despesa.update({
      where: { id }, data: { estat: "aprovat" }
    })

    await enviarNotificacio({
      nomUsuari: despesa.usuari.nom,
      emailUsuari: despesa.usuari.email,
      proveidor: despesa.proveidor,
      importTotal: despesa.importTotal,
      subject: `✅ Despesa aprovada`,
      missatge: `La teva despesa de ${despesa.importTotal}€ a ${despesa.proveidor} ha estat aprovada. ✅`
    })

    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error aprovant despesa" })
  }
})

// ----------------------
// REBUTJAR DESPESA ✅ amb comentari
// ----------------------
app.post("/despesa/:id/rebutjar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { comentari } = req.body
    const despesa = await prisma.despesa.findUnique({
      where: { id }, include: { usuari: true }
    })
    if (!despesa)
      return res.status(404).json({ error: "Despesa no trobada" })

    const updated = await prisma.despesa.update({
      where: { id },
      data: { estat: "rebutjat", comentari: comentari || null }
    })

    await enviarNotificacio({
      nomUsuari: despesa.usuari.nom,
      emailUsuari: despesa.usuari.email,
      proveidor: despesa.proveidor,
      importTotal: despesa.importTotal,
      subject: `❌ Despesa rebutjada`,
      missatge: `La teva despesa de ${despesa.importTotal}€ a ${despesa.proveidor} ha estat rebutjada. ${comentari ? 'Motiu: ' + comentari : ''} ❌`
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

    if (req.user.perfil === 'usuari') where.usuariId = req.user.id
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
      by: ["categoria"], where, _sum: { importTotal: true }
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
    const total = await prisma.despesa.aggregate({ where, _sum: { importTotal: true } })
    res.json({ total: total._sum.importTotal || 0 })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error calculant total" })
  }
})

// ----------------------
// LLISTAR USUARIS
// ----------------------
app.get("/users", authenticate, requirePerfil('admin', 'validador'), async (req, res) => {
  try {
    const usuaris = await prisma.usuari.findMany({
      select: { id: true, nom: true, email: true, perfil: true, pressupost: true }
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
app.post("/fulla", authenticate, async (req, res) => {
  try {
    const { titol, mes, any } = req.body
    if (!titol || !mes || !any)
      return res.status(400).json({ error: "Falten camps obligatoris" })

    const fulla = await prisma.fullaDespesa.create({
      data: { titol, mes, any: parseInt(any), estat: "draft", usuariId: req.user.id }
    })
    res.json({ fulla })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error creant fulla" })
  }
})

app.get("/fulla", authenticate, async (req, res) => {
  try {
    let fulles

    if (req.user.perfil === 'admin' || req.user.perfil === 'validador') {
      fulles = await prisma.fullaDespesa.findMany({
        include: { usuari: { select: { nom: true, email: true } }, despeses: true }
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

app.get("/fulla/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({
      where: { id },
      include: { usuari: { select: { nom: true, email: true } }, despeses: true }
    })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })
    res.json({ fulla })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint fulla" })
  }
})

app.post("/fulla/:id/despesa/:despesaId", authenticate, async (req, res) => {
  try {
    const fullaId = parseInt(req.params.id)
    const despesaId = parseInt(req.params.despesaId)

    const fulla = await prisma.fullaDespesa.findUnique({ where: { id: fullaId } })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })
    if (fulla.usuariId !== req.user.id) return res.status(403).json({ error: "No tens permís" })

    const despesa = await prisma.despesa.update({ where: { id: despesaId }, data: { fullaId } })
    res.json({ despesa })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error assignant despesa" })
  }
})

app.post("/fulla/:id/enviar", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({
      where: { id }, include: { usuari: true }
    })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })
    if (fulla.usuariId !== req.user.id) return res.status(403).json({ error: "No tens permís" })

    const updated = await prisma.fullaDespesa.update({ where: { id }, data: { estat: "pendent" } })

    const validadors = await prisma.usuari.findMany({
      where: { perfil: { in: ['validador', 'admin'] } },
      select: { nom: true, email: true }
    })

    for (const validador of validadors) {
      await enviarNotificacio({
        nomUsuari: validador.nom,
        emailUsuari: validador.email,
        proveidor: fulla.titol,
        importTotal: 0,
        subject: `📋 Nova fulla pendent d'aprovació`,
        missatge: `L'usuari ${fulla.usuari.nom} ha enviat la fulla "${fulla.titol}" per aprovació. Accedeix al sistema per revisar-la.`
      })
    }

    res.json({ fulla: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error enviant fulla" })
  }
})

app.post("/fulla/:id/aprovar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({
      where: { id }, include: { usuari: true, despeses: true }
    })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })

    await prisma.despesa.updateMany({ where: { fullaId: id }, data: { estat: "aprovat" } })
    const updated = await prisma.fullaDespesa.update({ where: { id }, data: { estat: "aprovat" } })

    const totalFulla = fulla.despeses?.reduce((acc, d) => acc + d.importTotal, 0) || 0
    await enviarNotificacio({
      nomUsuari: fulla.usuari.nom,
      emailUsuari: fulla.usuari.email,
      proveidor: fulla.titol,
      importTotal: totalFulla,
      subject: `✅ Fulla de despeses aprovada`,
      missatge: `La teva fulla de despeses "${fulla.titol}" de ${totalFulla}€ ha estat aprovada. ✅`
    })

    res.json({ fulla: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error aprovant fulla" })
  }
})

app.post("/fulla/:id/rebutjar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({
      where: { id }, include: { usuari: true, despeses: true }
    })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })

    await prisma.despesa.updateMany({ where: { fullaId: id }, data: { estat: "rebutjat" } })
    const updated = await prisma.fullaDespesa.update({ where: { id }, data: { estat: "rebutjat" } })

    const totalFulla = fulla.despeses?.reduce((acc, d) => acc + d.importTotal, 0) || 0
    await enviarNotificacio({
      nomUsuari: fulla.usuari.nom,
      emailUsuari: fulla.usuari.email,
      proveidor: fulla.titol,
      importTotal: totalFulla,
      subject: `❌ Fulla de despeses rebutjada`,
      missatge: `La teva fulla de despeses "${fulla.titol}" ha estat rebutjada. ❌`
    })

    res.json({ fulla: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error rebutjant fulla" })
  }
})

app.delete("/fulla/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const fulla = await prisma.fullaDespesa.findUnique({ where: { id } })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })

    if (req.user.perfil !== 'admin' && req.user.perfil !== 'validador' && fulla.usuariId !== req.user.id)
      return res.status(403).json({ error: "No tens permís" })

    await prisma.despesa.updateMany({ where: { fullaId: id }, data: { fullaId: null } })
    await prisma.fullaDespesa.delete({ where: { id } })
    res.json({ message: "Fulla eliminada correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminant fulla" })
  }
})

// ----------------------
// PRESSUPOST USUARI
// ----------------------
app.get("/pressupost", authenticate, async (req, res) => {
  try {
    const usuari = await prisma.usuari.findUnique({
      where: { id: req.user.id },
      select: { pressupost: true, nom: true }
    })

    const despeses = await prisma.despesa.findMany({
      where: { usuariId: req.user.id, estat: { not: 'rebutjat' } }
    })

    const totalGastat = despeses.reduce((acc, d) => acc + d.importTotal, 0)
    const restant = usuari.pressupost - totalGastat
    const percentatge = Math.round((totalGastat / usuari.pressupost) * 100)

    res.json({ pressupost: usuari.pressupost, totalGastat, restant, percentatge })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint pressupost" })
  }
})

app.put("/pressupost/:userId", authenticate, requirePerfil('admin', 'validador'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId)
    const { pressupost } = req.body

    const updated = await prisma.usuari.update({
      where: { id: userId },
      data: { pressupost: parseFloat(pressupost) }
    })

    res.json({ usuari: { id: updated.id, nom: updated.nom, pressupost: updated.pressupost } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualitzant pressupost" })
  }
})

// ----------------------
// NOTIFICACIONS
// ----------------------
app.get("/notificacions", authenticate, async (req, res) => {
  try {
    let count = 0

    if (req.user.perfil === 'validador' || req.user.perfil === 'admin') {
      count = await prisma.despesa.count({
        where: { estat: { in: ['draft', 'pendent'] } }
      })
    }

    res.json({ count })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint notificacions" })
  }
})

// ----------------------
// START SERVER
// ----------------------
app.listen(PORT, () => console.log(`Servidor al port ${PORT}`))