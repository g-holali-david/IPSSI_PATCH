const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

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
   BASE DE DONNÉES SQLITE
   ============================================================
   Connexion et création des tables.
============================================================ */

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

// Création de la table users si elle n'existe pas.
// NOTE : les mots de passe sont encore en clair (patch futur).
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
   ============================================================
   Avant : insertion SQL vulnérable (concaténation de chaînes).
   Maintenant : utilisation de requêtes paramétrées.
============================================================ */

async function insertRandomUsers() {
  try {
    // Récupère 3 utilisateurs aléatoires
    const urls = [1, 2, 3].map(() => axios.get('https://randomuser.me/api/'));
    const results = await Promise.all(urls);
    const users = results.map(r => r.data.results[0]);

    users.forEach(u => {
      const fullName = `${u.name.first} ${u.name.last}`;
      const password = u.login.password; // Sera hashé dans un patch futur

      // Requête paramétrée :
      // But : empêcher toute injection SQL dans les valeurs insérées.
      db.run(
        `INSERT INTO users (name, password) VALUES (?, ?)`,
        [fullName, password],
        (err) => {
          if (err) console.error(err.message);
        }
      );
    });

    console.log('Inserted 3 users into database.');
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
   DANGER : permettait DROP TABLE, UPDATE, SELECT interne...
   BUT : éliminer une vulnérabilité critique d'injection SQL totale.
---------------------------------------------------------------- */

/* ============================================================
   Récupération de tous les IDs utilisateurs
============================================================ */

app.get('/users', (req, res) => {
  // Lecture simple, pas de données dangereuses
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
   ============================================================
   AVANT :
     db.all(req.body) -> exécution directe du SQL envoyé par le client
   IMPACT :
     Injection SQL, perte totale de contrôle sur la BDD
   APRÈS :
     - Validation de l'entrée
     - Requête paramétrée
     - Retour propre
============================================================ */

app.post('/user', (req, res) => {
  const { id } = req.body;

  // Validation des données
  // But : empêcher les chaînes malveillantes ou valeurs non numériques.
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // Requête paramétrée SAFE
  db.get(
    "SELECT id, name FROM users WHERE id = ?",
    [id],
    (err, row) => {
      if (err) {
        console.error("SQL Error:", err.message);
        return res.status(500).json({ error: err.message });
      }

      // Retourne un tableau pour correspondre au format attendu par le frontend
      res.json(row ? [row] : []);
    }
  );
});

/* ============================================================
   COMMENTS
============================================================ */

// Ajout d'un commentaire
app.post('/comment', (req, res) => {
  const { content } = req.body;

  // Validation simple
  // But : empêcher l'envoi de données vides ou très dangereuses.
  if (!content || content.length === 0) {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }

  // Requête paramétrée
  // But : empêcher l'injection SQL dans l'insertion de commentaires.
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
// NOTE : XSS possible si content contient du HTML -> patch futur côté frontend
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
   LANCEMENT DU SERVEUR
============================================================ */

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
