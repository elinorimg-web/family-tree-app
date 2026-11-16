const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.get('/api/trees', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trees ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/trees', async (req, res) => {
    const { email, title, description } = req.body;
    try {
        let userRes = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
        let userId = userRes.rows.length > 0 ? userRes.rows.at(0).user_id : (await pool.query(
            'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING user_id',
            [email, 'online_user', 'מנהלת האילן']
        )).rows.at(0).user_id;

        const newTree = await pool.query(
            'INSERT INTO trees (owner_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, title, description || '']
        );
        res.json(newTree.rows.at(0));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/trees/:treeId/full', async (req, res) => {
    const { treeId } = req.params;
    try {
        const people = await pool.query('SELECT * FROM individuals WHERE tree_id = $1 ORDER BY created_at ASC', [treeId]);
        const rels = await pool.query('SELECT * FROM parent_child_relationships WHERE tree_id = $1', [treeId]);
        res.json({ people: people.rows, relationships: rels.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/trees/:treeId/individuals', async (req, res) => {
    const { treeId } = req.params;
    const { first_name, last_name, gender, birth_date_approx, birth_place } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO individuals (tree_id, first_name, last_name, gender, birth_date_approx, birth_place) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [treeId, first_name, last_name, gender || 'unknown', birth_date_approx, birth_place]
        );
        res.json(result.rows.at(0));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/trees/:treeId/relationships', async (req, res) => {
    const { treeId } = req.params;
    const { parent_id, child_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO parent_child_relationships (tree_id, parent_id, child_id) VALUES ($1, $2, $3) RETURNING *',
            [treeId, parent_id, child_id]
        );
        res.json(result.rows.at(0));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('האפליקציה רצה בהצלחה!'));
