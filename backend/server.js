const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt'); // PATCH 3 : ajout pour hachage des mots de passe

const app = express();
const port = 8000;

/* ============================================================
   MIDDLEWARES
   ============================================================
   Les middlewares servent à :
   - contrôler / transformer les données entrantes
   - sécuriser l'application
   - mieux structurer le backend
   Ici on ajoute express.json() et un CORS restreint.
============================================================ */

// Permet de recevoir des objets JSON au lieu de texte brut.
// But : éviter d'exécuter du SQL brut reçu depuis le frontend.
app.use(express.json());

// CORS limité : seul le frontend autorisé peut appeler l'API.
// But : éviter qu'un site malveillant ne consomme l'API.
app.use(cors({
  origin: "http://localhost:3000"
}));

/* ============================================================
   Middlewares simples de validation
   - validateUserId : contrôle ID numérique
   - sanitizeComment : protection XSS
============================================================ */

function validateUserId(req, res, next) {
  const { id } = req.body;

  // But : empêcher valeurs malveillantes ou injections indirectes
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  next();
}

function sanitizeComment(req, res, next) {
  let { content } = req.body;

  // Empêcher contenus vides
  if (!content || content.length === 0) {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }

  // Protection minimale contre XSS
  // But : empêcher <script> dans les commentaires
  content = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  req.body.content = content;
  next();
}

/* ============================================================
   BASE DE DONNÉES SQLITE
============================================================ */

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Création de la table users si elle n'existe pas.
// NOTE : les mots de passe seront hachés maintenant (PATCH 3)
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  password TEXT NOT NULL
)`);

// Table des commentaires
db.run(`CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL
)`);

/* ============================================================
   INSERTION D'UTILISATEURS ALÉATOIRES (API randomuser.me)
   PATCH 3 : Hachage bcrypt ajouté ici
============================================================ */

async function insertRandomUsers() {
  try {
    const urls = [1, 2, 3].map(() => axios.get('https://randomuser.me/api/'));
    const results = await Promise.all(urls);
    const users = results.map(r => r.data.results[0]);

    users.forEach(async (u) => {
      const fullName = `${u.name.first} ${u.name.last}`;
      const password = u.login.password;

      // PATCH 3 : hachage bcrypt
      // But : empêcher tout stockage de mot de passe en clair
      const hashedPassword = await bcrypt.hash(password, 10);

      // Requête paramétrée sécurisée
      db.run(
        `INSERT INTO users (name, password) VALUES (?, ?)`,
        [fullName, hashedPassword],
        (err) => {
          if (err) console.error(err.message);
        }
      );
    });

    console.log('Inserted 3 secure (hashed) users into database.');
  } catch (err) {
    console.error('Error inserting users:', err.message);
  }
}

/* ============================================================
   ROUTES API
============================================================ */

// Remplit la base avec 3 utilisateurs
app.get('/populate', async (req, res) => {
  await insertRandomUsers();
  res.send('Inserted 3 users into database.');
});

/* ----------------------------------------------------------------
   SUPPRESSION DE /query
   AVANT : db.run(req.body) -> exécution SQL arbitraire
---------------------------------------------------------------- */

/* ============================================================
   Liste des IDs utilisateurs
============================================================ */

app.get('/users', (req, res) => {
  db.all('SELECT id FROM users', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Database error');
    }
    res.json(rows);
  });
});

/* ============================================================
   ROUTE /user (PATCHÉE)
   Ajout : validateUserId middleware
============================================================ */

app.post('/user', validateUserId, (req, res) => {
  const { id } = req.body;

  db.get(
    "SELECT id, name FROM users WHERE id = ?",
    [id],
    (err, row) => {
      if (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({ error: err.message });
      }

      res.json(row ? [row] : []);
    }
  );
});

/* ============================================================
   Gestion des commentaires
   Ajout du middleware sanitizeComment 
============================================================ */

app.post('/comment', sanitizeComment, (req, res) => {
  const { content } = req.body;

  db.run(
    `INSERT INTO comments (content) VALUES (?)`,
    [content],
    (err) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// Lecture des commentaires
app.get('/comments', (req, res) => {
  db.all('SELECT * FROM comments ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Database error');
    }
    res.json(rows);
  });
});

/* ============================================================
   Lancement du serveur
============================================================ */

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
