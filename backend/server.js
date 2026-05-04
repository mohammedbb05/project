import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import fs from "fs"
import path from "path"
import axios from "axios"
import FormData from "form-data"
import { PrismaClient } from "@prisma/client"
import { authenticate, requirePerfil } from "./middleware/auth.js"
import { upload } from "./middleware/upload.js"

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3000
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`

app.use(cors({ origin: "http://localhost:4200" }))
app.use(express.json())
app.use('/uploads', express.static('uploads'))

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const enviarNotificacio = async (data) => {
  try {
    await axios.post('http://localhost:5678/webhook/despesa-aprovada', data)
    console.log('Notificació enviada ✅')
  } catch (err) {
    console.log('Webhook n8n no disponible:', err.message)
  }
}

const getDocuwareAuth = async () => {
  const params = new URLSearchParams({
    grant_type: 'password',
    username: process.env.DOCUWARE_USER,
    password: process.env.DOCUWARE_PASSWORD,
    scope: 'docuware.platform',
    client_id: 'docuware.platform.net.client'
  })
  const res = await axios.post(
    process.env.DOCUWARE_TOKEN_URL,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  if (!res.data?.access_token)
    throw new Error(`DocuWare OAuth failed: ${JSON.stringify(res.data)}`)
  console.log('DocuWare auth via OAuth2 ✅')
  return { type: 'token', value: res.data.access_token }
}

const subirADocuware = async (filePath, metadata) => {
  try {
    const auth = await getDocuwareAuth()
    const cabinetId = process.env.DOCUWARE_CABINET_ID
    const fileName = path.basename(filePath)

    const indexFields = [
      { FieldName: 'DOCUMENT_TYPE',       Item: metadata.tipusDocument === 'factura' ? 'Factura' : 'Tiquet', ItemElementName: 'String'  },
      { FieldName: 'TIPUS_DOCUMENT',      Item: metadata.tipusDocument || 'tiquet',                          ItemElementName: 'String'  },
      { FieldName: 'STATUS',              Item: 'draft',                                                     ItemElementName: 'String'  },
      { FieldName: 'DOCUMENT_DATE',       Item: metadata.data ? new Date(metadata.data).toISOString() : new Date().toISOString(), ItemElementName: 'Date' },
      { FieldName: 'TOTAL_REIMBURSEMENT', Item: parseFloat(metadata.importTotal) || 0,                       ItemElementName: 'Decimal' },
      { FieldName: 'COMMENT',             Item: metadata.concepte || '',                                     ItemElementName: 'String'  },
      { FieldName: 'USER_ID',             Item: String(metadata.usuariId || ''),                             ItemElementName: 'String'  },
    ]

    const documentJson = JSON.stringify({ Fields: indexFields })
    const form = new FormData()
    form.append('document', documentJson, { contentType: 'application/json', filename: 'document.json' })

    const fileBuffer = fs.readFileSync(filePath)
    const mimeType = fileName.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' :
                     fileName.match(/\.png$/i)        ? 'image/png'  :
                     fileName.match(/\.pdf$/i)        ? 'application/pdf' : 'application/octet-stream'

    form.append('file[]', fileBuffer, { filename: fileName, contentType: mimeType })

    const uploadRes = await axios.post(
      `${process.env.DOCUWARE_URL}/DocuWare/Platform/FileCabinets/${cabinetId}/Documents`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${auth.value}`,
          'Accept': 'application/json'
        }
      }
    )
    const docId = uploadRes.data?.Id
    console.log(`Document pujat a DocuWare ✅ ID: ${docId}`)
    return docId
  } catch (err) {
    console.error('Error pujant a DocuWare:', err.response?.data || err.message)
    return null
  }
}

const actualitzarEstatDocuware = async (docuwareId, estat) => {
  try {
    const auth = await getDocuwareAuth()
    const cabinetId = process.env.DOCUWARE_CABINET_ID
    await axios.put(
      `${process.env.DOCUWARE_URL}/DocuWare/Platform/FileCabinets/${cabinetId}/Documents/${docuwareId}/Fields`,
      { Field: [{ FieldName: 'STATUS', Item: estat, ItemElementName: 'String' }] },
      {
        headers: {
          'Authorization': `Bearer ${auth.value}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )
    console.log(`DocuWare estat actualitzat a "${estat}" per document ${docuwareId} ✅`)
  } catch (err) {
    console.error('Error actualitzant estat DocuWare:', err.response?.data || err.message)
  }
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

// POST /login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: "Falten camps" })
    const user = await prisma.usuari.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: "Usuari no trobat" })
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) return res.status(401).json({ error: "Password incorrecte" })
    const token = jwt.sign({ userId: user.id, perfil: user.perfil }, process.env.JWT_SECRET, { expiresIn: "24h" })
    res.json({
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        perfil: user.perfil,
        mustChangePassword: user.mustChangePassword || false  // ✅ primer login
      },
      token
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error fent login" })
  }
})

// POST /users — Solo admin pot crear usuaris
app.post("/users", authenticate, requirePerfil('admin'), async (req, res) => {
  try {
    const { nom, email, password, perfil } = req.body
    if (!nom || !email || !password)
      return res.status(400).json({ error: "Falten camps obligatoris" })
    const perfilFinal = perfil || "usuari"
    const existingUser = await prisma.usuari.findUnique({ where: { email } })
    if (existingUser)
      return res.status(409).json({ error: "Ja existeix un usuari amb aquest email" })
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.usuari.create({
      data: {
        nom, email,
        password: hashedPassword,
        perfil: perfilFinal,
        mustChangePassword: true  // ✅ força canvi de contrasenya en primer login
      }
    })
    res.status(201).json({
      user: { id: user.id, nom: user.nom, email: user.email, perfil: user.perfil }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error creant usuari" })
  }
})

// PUT /users/:id — Edita un usuari (admin only)
app.put("/users/:id", authenticate, requirePerfil('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { nom, email, perfil, password } = req.body
    const data = {}
    if (nom) data.nom = nom
    if (email) data.email = email
    if (perfil) data.perfil = perfil
    if (password) {
      data.password = await bcrypt.hash(password, 10)
      data.mustChangePassword = true  // ✅ si admin canvia contrasenya, força canvi
    }
    const updated = await prisma.usuari.update({
      where: { id },
      data,
      select: { id: true, nom: true, email: true, perfil: true, pressupost: true }
    })
    res.json({ usuari: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualitzant usuari" })
  }
})

// DELETE /users/:id — Elimina un usuari (admin only)
app.delete("/users/:id", authenticate, requirePerfil('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.id)
      return res.status(400).json({ error: "No pots eliminar el teu propi compte" })
    await prisma.usuari.delete({ where: { id } })
    res.json({ message: "Usuari eliminat correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminant usuari" })
  }
})

// GET /users
app.get("/users", authenticate, requirePerfil('admin', 'validador'), async (req, res) => {
  try {
    const usuaris = await prisma.usuari.findMany({
      select: { id: true, nom: true, email: true, perfil: true, pressupost: true, mustChangePassword: true }
    })
    res.json({ usuaris })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint usuaris" })
  }
})

// ─────────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────────

// GET /perfil
app.get("/perfil", authenticate, async (req, res) => {
  try {
    const usuari = await prisma.usuari.findUnique({
      where: { id: req.user.id },
      select: { id: true, nom: true, email: true, perfil: true, pressupost: true }
    })
    res.json({ usuari })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint perfil" })
  }
})

// PUT /perfil
app.put("/perfil", authenticate, async (req, res) => {
  try {
    const { nom, email } = req.body
    const updated = await prisma.usuari.update({
      where: { id: req.user.id },
      data: { nom, email },
      select: { id: true, nom: true, email: true, perfil: true }
    })
    res.json({ usuari: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualitzant perfil" })
  }
})

// PUT /perfil/contrasenya
app.put("/perfil/contrasenya", authenticate, async (req, res) => {
  try {
    const { passwordActual, passwordNou } = req.body
    if (!passwordActual || !passwordNou)
      return res.status(400).json({ error: "Falten camps" })
    const usuari = await prisma.usuari.findUnique({ where: { id: req.user.id } })
    const valid = await bcrypt.compare(passwordActual, usuari.password)
    if (!valid) return res.status(401).json({ error: "Contrasenya actual incorrecta" })
    const hashed = await bcrypt.hash(passwordNou, 10)
    await prisma.usuari.update({
      where: { id: req.user.id },
      data: {
        password: hashed,
        mustChangePassword: false  // ✅ ja ha canviat la contrasenya
      }
    })
    res.json({ message: "Contrasenya canviada correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error canviant contrasenya" })
  }
})

// ─────────────────────────────────────────────
// OCR
// ─────────────────────────────────────────────

app.post("/ocr", authenticate, upload.single('imatge'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Cal pujar una imatge" })
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
  "categoria": "una d'aquestes: Dietes, Gasolina, Transport, Parking, Restaurant, Oficina, Altres",
  "tipusDocument": "tiquet si és un rebut simple sense CIF/IVA desglossat, factura si té CIF i desglosament d'IVA"
}`
            }
          ]
        }]
      },
      { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } }
    )
    const content = response.data.choices[0].message.content
    const cleanJson = content.replace(/```json|```/g, '').trim()
    const dadesExtretes = JSON.parse(cleanJson)
    const urlImatge = `${SERVER_URL}/uploads/${req.file.filename}`
    res.json({ dades: dadesExtretes, urlImatge })
  } catch (error) {
    console.error('Error OCR:', error.response?.data || error.message)
    res.status(500).json({ error: "Error processant la imatge" })
  }
})

// ─────────────────────────────────────────────
// DESPESES
// ─────────────────────────────────────────────

app.get("/despesa", authenticate, async (req, res) => {
  try {
    const { tipus } = req.query
    const whereBase = tipus ? { tipusDocument: tipus } : {}
    let despeses
    if (req.user.perfil === 'admin' || req.user.perfil === 'validador') {
      despeses = await prisma.despesa.findMany({
        where: whereBase,
        include: { usuari: { select: { nom: true, email: true } } }
      })
    } else {
      despeses = await prisma.despesa.findMany({
        where: { ...whereBase, usuariId: req.user.id },
        select: {
          id: true, proveidor: true, cif: true, importTotal: true,
          iva: true, baseImposable: true, data: true, concepte: true,
          categoria: true, urlImatge: true, usuariId: true, estat: true,
          fullaId: true, comentari: true, docuwareId: true, tipusDocument: true
        }
      })
    }
    res.json({ despeses })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint despeses" })
  }
})

app.post("/despesa", authenticate, async (req, res) => {
  try {
    const { proveidor, cif, importTotal, iva, baseImposable, data, concepte, categoria, urlImatge, tipusDocument } = req.body
    if (!proveidor || !importTotal || !data || !concepte || !categoria)
      return res.status(400).json({ error: "Falten camps obligatoris" })
    if (tipusDocument === 'factura' && !cif)
      return res.status(400).json({ error: "Les factures requereixen CIF" })
    const tipusValid = tipusDocument === 'factura' ? 'factura' : 'tiquet'
    const usuariCreador = await prisma.usuari.findUnique({
      where: { id: req.user.id }, select: { nom: true }
    })
    const despesa = await prisma.despesa.create({
      data: {
        proveidor, cif: cif || "", importTotal,
        iva: iva || null, baseImposable: baseImposable || null,
        data: new Date(data), concepte, categoria,
        urlImatge: urlImatge || "", usuariId: req.user.id,
        estat: "draft", tipusDocument: tipusValid
      }
    })
    if (urlImatge) {
      const filename = urlImatge.split('/uploads/')[1]
      if (filename) {
        const filePath = path.join('uploads', filename)
        if (fs.existsSync(filePath)) {
          subirADocuware(filePath, {
            proveidor, cif, importTotal, data, categoria, concepte,
            usuariId: req.user.id, tipusDocument: tipusValid
          }).then(async (docuwareId) => {
            if (docuwareId) {
              await prisma.despesa.update({
                where: { id: despesa.id },
                data: { docuwareId: String(docuwareId) }
              }).catch(() => {})
            }
          }).catch(err => console.error('Error DocuWare background:', err.message))
        }
      }
    }
    const validadors = await prisma.usuari.findMany({
      where: { perfil: { in: ['validador', 'admin'] } },
      select: { nom: true, email: true }
    })
    for (const validador of validadors) {
      await enviarNotificacio({
        nomUsuari: validador.nom, emailUsuari: validador.email,
        proveidor, importTotal,
        subject: `🆕 Nova ${tipusValid} pendent d'aprovació`,
        missatge: `L'usuari ${usuariCreador.nom} ha creat una nova ${tipusValid} de ${importTotal}€ a ${proveidor}.`
      })
    }
    res.json({ despesa })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error creant despesa" })
  }
})

app.put("/despesa/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })
    if (despesa.usuariId !== req.user.id && req.user.perfil !== 'admin' && req.user.perfil !== 'validador')
      return res.status(403).json({ error: "No tens permís per editar" })
    const updated = await prisma.despesa.update({ where: { id }, data: req.body })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualitzant despesa" })
  }
})

app.delete("/despesa/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })
    if (req.user.perfil !== 'admin' && req.user.perfil !== 'validador' && despesa.usuariId !== req.user.id)
      return res.status(403).json({ error: "No tens permís per eliminar" })
    await prisma.despesa.delete({ where: { id } })
    res.json({ message: "Despesa eliminada correctament" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminant despesa" })
  }
})

app.post("/despesa/:id/aprovar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const despesa = await prisma.despesa.findUnique({ where: { id }, include: { usuari: true } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })
    const updated = await prisma.despesa.update({ where: { id }, data: { estat: "aprovat" } })
    if (despesa.docuwareId) await actualitzarEstatDocuware(despesa.docuwareId, 'aprovat')
    await enviarNotificacio({
      nomUsuari: despesa.usuari.nom, emailUsuari: despesa.usuari.email,
      proveidor: despesa.proveidor, importTotal: despesa.importTotal,
      subject: `✅ Despesa aprovada`,
      missatge: `La teva despesa de ${despesa.importTotal}€ a ${despesa.proveidor} ha estat aprovada. ✅`
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error aprovant despesa" })
  }
})

app.post("/despesa/:id/rebutjar", authenticate, requirePerfil('validador', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { comentari } = req.body
    const despesa = await prisma.despesa.findUnique({ where: { id }, include: { usuari: true } })
    if (!despesa) return res.status(404).json({ error: "Despesa no trobada" })
    const updated = await prisma.despesa.update({
      where: { id },
      data: { estat: "rebutjat", comentari: comentari || null }
    })
    if (despesa.docuwareId) await actualitzarEstatDocuware(despesa.docuwareId, 'rebutjat')
    await enviarNotificacio({
      nomUsuari: despesa.usuari.nom, emailUsuari: despesa.usuari.email,
      proveidor: despesa.proveidor, importTotal: despesa.importTotal,
      subject: `❌ Despesa rebutjada`,
      missatge: `La teva despesa de ${despesa.importTotal}€ a ${despesa.proveidor} ha estat rebutjada. ${comentari ? 'Motiu: ' + comentari : ''} ❌`
    })
    res.json(updated)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error rebutjant despesa" })
  }
})

// ─────────────────────────────────────────────
// FILTRE AVANÇAT
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// ESTADÍSTIQUES
// ─────────────────────────────────────────────

app.get("/estadistiques/categoria", authenticate, async (req, res) => {
  try {
    const where = req.user.perfil === 'usuari' ? { usuariId: req.user.id } : {}
    const categories = await prisma.despesa.groupBy({ by: ["categoria"], where, _sum: { importTotal: true } })
    res.json({ categories })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error generant estadístiques" })
  }
})

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

// ─────────────────────────────────────────────
// FULLES DE DESPESES
// ─────────────────────────────────────────────

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
    const fulla = await prisma.fullaDespesa.findUnique({ where: { id }, include: { usuari: true } })
    if (!fulla) return res.status(404).json({ error: "Fulla no trobada" })
    if (fulla.usuariId !== req.user.id) return res.status(403).json({ error: "No tens permís" })
    const updated = await prisma.fullaDespesa.update({ where: { id }, data: { estat: "pendent" } })
    const validadors = await prisma.usuari.findMany({
      where: { perfil: { in: ['validador', 'admin'] } },
      select: { nom: true, email: true }
    })
    for (const validador of validadors) {
      await enviarNotificacio({
        nomUsuari: validador.nom, emailUsuari: validador.email,
        proveidor: fulla.titol, importTotal: 0,
        subject: `📋 Nova fulla pendent d'aprovació`,
        missatge: `L'usuari ${fulla.usuari.nom} ha enviat la fulla "${fulla.titol}" per aprovació.`
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
    for (const despesa of fulla.despeses) {
      if (despesa.docuwareId) await actualitzarEstatDocuware(despesa.docuwareId, 'aprovat')
    }
    const totalFulla = fulla.despeses?.reduce((acc, d) => acc + d.importTotal, 0) || 0
    await enviarNotificacio({
      nomUsuari: fulla.usuari.nom, emailUsuari: fulla.usuari.email,
      proveidor: fulla.titol, importTotal: totalFulla,
      subject: `✅ Fulla de despeses aprovada`,
      missatge: `La teva fulla "${fulla.titol}" de ${totalFulla}€ ha estat aprovada. ✅`
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
    for (const despesa of fulla.despeses) {
      if (despesa.docuwareId) await actualitzarEstatDocuware(despesa.docuwareId, 'rebutjat')
    }
    const totalFulla = fulla.despeses?.reduce((acc, d) => acc + d.importTotal, 0) || 0
    await enviarNotificacio({
      nomUsuari: fulla.usuari.nom, emailUsuari: fulla.usuari.email,
      proveidor: fulla.titol, importTotal: totalFulla,
      subject: `❌ Fulla de despeses rebutjada`,
      missatge: `La teva fulla "${fulla.titol}" ha estat rebutjada. ❌`
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

// ─────────────────────────────────────────────
// PRESSUPOST
// ─────────────────────────────────────────────

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
    const pressupostFloat = parseFloat(pressupost)

    if (!Number.isFinite(pressupostFloat)) {
      return res.status(400).json({ error: "Pressupost invàlid o no proporcionat" })
    }

    const updated = await prisma.usuari.update({
      where: { id: userId },
      data: { pressupost: pressupostFloat }
    })
    res.json({ usuari: { id: updated.id, nom: updated.nom, pressupost: updated.pressupost } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error actualitzant pressupost" })
  }
})

// ─────────────────────────────────────────────
// NOTIFICACIONS
// ─────────────────────────────────────────────

app.get("/notificacions", authenticate, async (req, res) => {
  try {
    let count = 0
    if (req.user.perfil === 'validador' || req.user.perfil === 'admin') {
      count = await prisma.despesa.count({ where: { estat: { in: ['draft', 'pendent'] } } })
    }
    res.json({ count })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error obtenint notificacions" })
  }
})

// ─────────────────────────────────────────────
// ARRENCADA DEL SERVIDOR
// ─────────────────────────────────────────────

app.listen(PORT, () => console.log(`Servidor al port ${PORT}`))