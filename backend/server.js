const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { calcular, COMBUSTIBLES } = require('./calculator');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Use persistent data dir on Render, fallback to local for dev
const DATA_DIR = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'data')
  : __dirname;
const DB_PATH = path.join(DATA_DIR, 'database.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Create data and uploads directories if they don't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Seed database and uploads from repo on first run (production only)
if (process.env.NODE_ENV === 'production') {
  const seedDb = path.join(__dirname, 'database.db');
  if (fs.existsSync(seedDb)) {
    const seedSize = fs.statSync(seedDb).size;
    const destSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    // Copy if destination doesn't exist or seed is larger (has more data)
    if (!fs.existsSync(DB_PATH) || seedSize > destSize) {
      fs.copyFileSync(seedDb, DB_PATH);
      console.log('Seeded database.db from repo (' + seedSize + ' bytes, was ' + destSize + ')');
    } else {
      console.log('DB already exists (' + destSize + ' bytes), seed is ' + seedSize + ' bytes - keeping existing');
    }
  }
  const seedUploads = path.join(__dirname, 'uploads');
  if (fs.existsSync(seedUploads)) {
    fs.readdirSync(seedUploads).forEach(f => {
      if (f === '.gitkeep') return;
      const dest = path.join(UPLOADS_DIR, f);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(seedUploads, f), dest);
        console.log('Seeded upload:', f);
      }
    });
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images as static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize SQLite Database
let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err);
  } else {
    console.log('Connected to SQLite database');
    db.run('PRAGMA foreign_keys = ON');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Users table ready');
  });

  // Evaluations table
  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      caldera_id TEXT,
      fuel_type TEXT,
      operation_hours INTEGER,
      data JSON,
      results JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating evaluations table:', err);
    else console.log('Evaluations table ready');
  });

  // Company ficha table
  db.run(`
    CREATE TABLE IF NOT EXISTS company_ficha (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      empresa TEXT,
      ciiu TEXT,
      ciiu_description TEXT,
      avenue TEXT,
      avenue_number TEXT,
      avenue_address TEXT,
      district TEXT,
      province TEXT,
      department TEXT,
      website TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating company_ficha table:', err);
    else console.log('Company ficha table ready');
  });

  // Plants ficha table
  db.run(`
    CREATE TABLE IF NOT EXISTS plants_ficha (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nombre TEXT,
      avenue TEXT,
      avenue_number TEXT,
      avenue_address TEXT,
      district TEXT,
      province TEXT,
      department TEXT,
      correo TEXT,
      email TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating plants_ficha table:', err);
    else console.log('Plants ficha table ready');
  });

  // Calderos ficha table
  db.run(`
    CREATE TABLE IF NOT EXISTS calderos_ficha (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plant_id INTEGER NOT NULL,
      nombre TEXT,
      marca TEXT,
      tipo_caldero TEXT,
      configuracion TEXT,
      combustible TEXT,
      capacidad_instalada REAL,
      capacidad_unidad TEXT,
      presion_diseño REAL,
      presion_unidad TEXT,
      imagen_path TEXT,
      superficie REAL,
      año INTEGER,
      tratamiento_externo TEXT,
      tratamiento_interno TEXT,
      diametro_d REAL,
      longitud_l REAL,
      altura_h REAL,
      ancho_a REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants_ficha(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating calderos_ficha table:', err);
    else console.log('Calderos ficha table ready');
  });
}

// Helper function to promisify db.get
function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper function to promisify db.all
function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper function to promisify db.run
function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID || this.changes);
    });
  });
}

// Helper function to save base64 image to disk
function saveBase64Image(base64String, userId) {
  try {
    if (!base64String || base64String.length === 0) {
      return null;
    }

    // Extract base64 data (remove data:image/...;base64, prefix if present)
    let imageData = base64String;
    const matches = base64String.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (matches) {
      imageData = matches[2];
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = matches ? matches[1] : 'png';
    const filename = `company_${userId}_${timestamp}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    // Convert base64 to buffer and save
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(filepath, buffer);

    console.log(`✓ Image saved: ${filename}`);
    return filename;
  } catch (error) {
    console.error('Error saving image:', error.message);
    return null;
  }
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============ AUTH ROUTES ============

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = await dbRun('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', [
      email,
      hashedPassword,
      email.split('@')[0]
    ]);

    // Generate JWT token
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: userId.toString(),
        email,
        name: email.split('@')[0]
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Password (test mode - no email verification)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find user
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ EVALUATION ROUTES ============

// Get all evaluations for user
app.get('/api/evaluations', verifyToken, async (req, res) => {
  try {
    const evaluations = await dbAll(
      'SELECT * FROM evaluations WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );

    const parsedEvaluations = evaluations.map(ev => ({
      id: ev.id,
      userId: ev.user_id,
      calderaId: ev.caldera_id,
      fuelType: ev.fuel_type,
      operationHours: ev.operation_hours,
      dataJson: ev.data ? JSON.parse(ev.data) : null,
      resultsSummary: ev.results ? JSON.parse(ev.results) : null,
      createdAt: ev.created_at,
      updatedAt: ev.updated_at
    }));

    res.json(parsedEvaluations);
  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single evaluation
app.get('/api/evaluations/:id', verifyToken, async (req, res) => {
  try {
    const evaluation = await dbGet(
      'SELECT * FROM evaluations WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    res.json({
      ...evaluation,
      data: evaluation.data ? JSON.parse(evaluation.data) : null,
      results: evaluation.results ? JSON.parse(evaluation.results) : null
    });
  } catch (error) {
    console.error('Get evaluation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create evaluation
app.post('/api/evaluations', verifyToken, async (req, res) => {
  try {
    const { calderaId, fuelType, operationHours, dataJson, resultsSummary } = req.body;

    const now = new Date().toISOString();
    const evaluationId = await dbRun(
      'INSERT INTO evaluations (user_id, caldera_id, fuel_type, operation_hours, data, results) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.userId,
        calderaId || null,
        fuelType || null,
        operationHours || null,
        JSON.stringify(dataJson || {}),
        JSON.stringify(resultsSummary || {})
      ]
    );

    res.status(201).json({
      id: evaluationId,
      userId: req.userId,
      calderaId,
      fuelType,
      operationHours,
      dataJson,
      resultsSummary,
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update evaluation
app.put('/api/evaluations/:id', verifyToken, async (req, res) => {
  try {
    const { calderaId, fuelType, operationHours, data, results } = req.body;

    const evaluation = await dbGet(
      'SELECT * FROM evaluations WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    await dbRun(
      'UPDATE evaluations SET caldera_id = ?, fuel_type = ?, operation_hours = ?, data = ?, results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        calderaId || evaluation.caldera_id,
        fuelType || evaluation.fuel_type,
        operationHours || evaluation.operation_hours,
        data ? JSON.stringify(data) : evaluation.data,
        results ? JSON.stringify(results) : evaluation.results,
        req.params.id
      ]
    );

    res.json({ message: 'Evaluation updated successfully', id: req.params.id });
  } catch (error) {
    console.error('Update evaluation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete evaluation
app.delete('/api/evaluations/:id', verifyToken, async (req, res) => {
  try {
    const evaluation = await dbGet(
      'SELECT * FROM evaluations WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    await dbRun('DELETE FROM evaluations WHERE id = ?', [req.params.id]);

    res.json({ message: 'Evaluation deleted successfully' });
  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ COMPANY FICHA ROUTES ============

// Get company ficha for user
app.get('/api/company-ficha', verifyToken, async (req, res) => {
  try {
    const ficha = await dbGet(
      'SELECT * FROM company_ficha WHERE user_id = ?',
      [req.userId]
    );

    if (!ficha) {
      return res.status(404).json({ error: 'Company ficha not found' });
    }

    res.json(ficha);
  } catch (error) {
    console.error('Get company ficha error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update company ficha
app.post('/api/company-ficha', verifyToken, async (req, res) => {
  try {
    const { empresa, ciiu, ciiu_description, avenue, avenue_number, avenue_address, district, province, department, website, image_path } = req.body;

    // Log received data (sanitized)
    console.log('===== COMPANY FICHA POST =====');
    console.log('User ID:', req.userId);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Received data:', { 
      empresa: empresa?.substring(0, 30), 
      ciiu, 
      avenue, 
      avenue_number, 
      avenue_address: avenue_address?.substring(0, 30), 
      district, 
      province, 
      department, 
      website: website?.substring(0, 30),
      image_path_length: image_path ? image_path.length : 0
    });

    // Handle image: if it's base64 data, save to disk; otherwise keep existing
    let imagePath = null;
    if (image_path && image_path.length > 10) {
      // Check if it's base64 (contains data:image or is a long string)
      if (image_path.startsWith('data:image') || image_path.length > 1000) {
        imagePath = saveBase64Image(image_path, req.userId);
        console.log('Image processed. Filename:', imagePath);
      } else {
        // It's already a filename
        imagePath = image_path;
      }
    }

    // Check if ficha already exists
    const existingFicha = await dbGet(
      'SELECT id, image_path as existing_image FROM company_ficha WHERE user_id = ?',
      [req.userId]
    );

    let finalImagePath = imagePath;
    if (existingFicha) {
      if (image_path === '') {
        // User explicitly cleared the image
        finalImagePath = null;
      } else if (!imagePath) {
        // Keep existing image if no new image provided
        finalImagePath = existingFicha.existing_image;
      }
    }

    if (existingFicha) {
      // Update
      console.log('Updating existing ficha ID:', existingFicha.id);
      await dbRun(
        'UPDATE company_ficha SET empresa = ?, ciiu = ?, ciiu_description = ?, avenue = ?, avenue_number = ?, avenue_address = ?, district = ?, province = ?, department = ?, website = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [empresa, ciiu, ciiu_description, avenue, avenue_number, avenue_address, district, province, department, website, finalImagePath, req.userId]
      );

      console.log('✓ Ficha updated successfully');
      res.json({ message: 'Company ficha updated successfully', id: existingFicha.id });
    } else {
      // Create
      console.log('Creating new ficha');
      const fichaId = await dbRun(
        'INSERT INTO company_ficha (user_id, empresa, ciiu, ciiu_description, avenue, avenue_number, avenue_address, district, province, department, website, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.userId, empresa, ciiu, ciiu_description, avenue, avenue_number, avenue_address, district, province, department, website, finalImagePath]
      );

      console.log('✓ Ficha created with ID:', fichaId);
      res.status(201).json({
        id: fichaId,
        user_id: req.userId,
        empresa,
        ciiu,
        ciiu_description,
        avenue,
        avenue_number,
        avenue_address,
        district,
        province,
        department,
        website,
        image_path: finalImagePath,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Create/Update company ficha error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ===== PLANTS FICHA ENDPOINTS =====

// Get all plants for user
app.get('/api/plants-ficha', verifyToken, async (req, res) => {
  try {
    const plantas = await dbAll(
      'SELECT * FROM plants_ficha WHERE user_id = ? ORDER BY id DESC',
      [req.userId]
    );

    res.json(plantas || []);
  } catch (error) {
    console.error('Get plants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single plant
app.get('/api/plants-ficha/:id', verifyToken, async (req, res) => {
  try {
    const planta = await dbGet(
      'SELECT * FROM plants_ficha WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!planta) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json(planta);
  } catch (error) {
    console.error('Get plant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update plant
app.post('/api/plants-ficha', verifyToken, async (req, res) => {
  try {
    const { id, nombre, avenue, avenue_number, avenue_address, district, province, department, correo, email, image_path } = req.body;

    // Log received data (sanitized)
    console.log('===== PLANT FICHA POST =====');
    console.log('User ID:', req.userId);
    console.log('Plant ID:', id);
    console.log('Received data:', { 
      nombre, 
      avenue, 
      avenue_number, 
      avenue_address: avenue_address?.substring(0, 30), 
      district, 
      province, 
      department, 
      correo,
      email,
      image_path_length: image_path ? image_path.length : 0
    });

    // Handle image: if it's base64 data, save to disk; otherwise keep existing
    let imagePath = null;
    if (image_path && image_path.length > 10) {
      // Check if it's base64 (contains data:image or is a long string)
      if (image_path.startsWith('data:image') || image_path.length > 1000) {
        imagePath = saveBase64Image(image_path, req.userId);
        console.log('Image processed. Filename:', imagePath);
      } else if (image_path !== '') {
        // It's already a filename
        imagePath = image_path;
      }
    }

    // If updating and no new image, check if we need to keep the existing one
    if (id) {
      // Update existing plant
      const existingPlant = await dbGet(
        'SELECT id, image_path as existing_image FROM plants_ficha WHERE id = ? AND user_id = ?',
        [id, req.userId]
      );

      if (!existingPlant) {
        return res.status(404).json({ error: 'Plant not found' });
      }

      let finalImagePath = imagePath;
      if (!imagePath && image_path !== '') {
        // Keep existing image if no new image provided and user didn't explicitly clear it
        finalImagePath = existingPlant.existing_image;
      } else if (image_path === '') {
        // User explicitly cleared the image
        finalImagePath = null;
      }

      console.log('Updating plant ID:', id);
      await dbRun(
        'UPDATE plants_ficha SET nombre = ?, avenue = ?, avenue_number = ?, avenue_address = ?, district = ?, province = ?, department = ?, correo = ?, email = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [nombre, avenue, avenue_number, avenue_address, district, province, department, correo, email, finalImagePath, id, req.userId]
      );

      console.log('✓ Plant updated successfully');
      res.json({ message: 'Plant updated successfully', id });
    } else {
      // Create new plant
      console.log('Creating new plant');
      const plantId = await dbRun(
        'INSERT INTO plants_ficha (user_id, nombre, avenue, avenue_number, avenue_address, district, province, department, correo, email, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.userId, nombre, avenue, avenue_number, avenue_address, district, province, department, correo, email, imagePath]
      );

      console.log('✓ Plant created with ID:', plantId);
      res.status(201).json({
        id: plantId,
        user_id: req.userId,
        nombre,
        avenue,
        avenue_number,
        avenue_address,
        district,
        province,
        department,
        correo,
        email,
        image_path: imagePath,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Create/Update plant error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete plant
app.delete('/api/plants-ficha/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('===== DELETE PLANT =====');
    console.log('User ID:', req.userId);
    console.log('Plant ID:', id);

    // Verify plant belongs to user
    const planta = await dbGet(
      'SELECT id FROM plants_ficha WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!planta) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const calderosRows = await dbAll(
      'SELECT id FROM calderos_ficha WHERE plant_id = ? AND user_id = ?',
      [id, req.userId]
    );
    const calderosCount = calderosRows?.length || 0;

    await dbRun(
      'DELETE FROM calderos_ficha WHERE plant_id = ? AND user_id = ?',
      [id, req.userId]
    );

    await dbRun(
      'DELETE FROM plants_ficha WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    console.log('✓ Plant deleted successfully');
    res.json({ message: 'Plant deleted successfully', deletedCalderos: calderosCount });
  } catch (error) {
    console.error('❌ Delete plant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== CALDEROS FICHA ENDPOINTS =====

// Get ALL calderos for the logged-in user (across all plants)
app.get('/api/calderos-ficha', verifyToken, async (req, res) => {
  try {
    const calderos = await dbAll(
      'SELECT * FROM calderos_ficha WHERE user_id = ? ORDER BY id DESC',
      [req.userId]
    );
    res.json(calderos || []);
  } catch (error) {
    console.error('Get all calderos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all calderos for a plant
app.get('/api/calderos-ficha/plant/:plantId', verifyToken, async (req, res) => {
  try {
    const { plantId } = req.params;

    // Verify plant belongs to user
    const plant = await dbGet(
      'SELECT id FROM plants_ficha WHERE id = ? AND user_id = ?',
      [plantId, req.userId]
    );

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const calderos = await dbAll(
      'SELECT * FROM calderos_ficha WHERE plant_id = ? AND user_id = ? ORDER BY id DESC',
      [plantId, req.userId]
    );

    res.json(calderos || []);
  } catch (error) {
    console.error('Get calderos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single caldero
app.get('/api/calderos-ficha/:id', verifyToken, async (req, res) => {
  try {
    const caldero = await dbGet(
      'SELECT * FROM calderos_ficha WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!caldero) {
      return res.status(404).json({ error: 'Caldero not found' });
    }

    res.json(caldero);
  } catch (error) {
    console.error('Get caldero error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update caldero
app.post('/api/calderos-ficha', verifyToken, async (req, res) => {
  try {
    const { id, plant_id, nombre, marca, tipo_caldero, configuracion, combustible, capacidad_instalada, capacidad_unidad, presion_diseño, presion_unidad, imagen_path, superficie, año, tratamiento_externo, tratamiento_interno, diametro_d, longitud_l, altura_h, ancho_a } = req.body;

    console.log('===== CALDERO POST =====');
    console.log('User ID:', req.userId);
    console.log('Caldero ID:', id);
    console.log('Plant ID:', plant_id);
    console.log('Nombre:', nombre);
    console.log('Tipo:', tipo_caldero);

    // Verify plant belongs to user
    const plant = await dbGet(
      'SELECT id FROM plants_ficha WHERE id = ? AND user_id = ?',
      [plant_id, req.userId]
    );

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Handle image
    let imagenPath = null;
    if (imagen_path && imagen_path.length > 10) {
      if (imagen_path.startsWith('data:image') || imagen_path.length > 1000) {
        imagenPath = saveBase64Image(imagen_path, req.userId);
        console.log('Image processed. Filename:', imagenPath);
      } else if (imagen_path !== '') {
        imagenPath = imagen_path;
      }
    }

    if (id) {
      // Update existing caldero
      const existingCaldero = await dbGet(
        'SELECT id, imagen_path FROM calderos_ficha WHERE id = ? AND user_id = ?',
        [id, req.userId]
      );

      if (!existingCaldero) {
        return res.status(404).json({ error: 'Caldero not found' });
      }

      let finalImagePath = imagenPath;
      if (!imagenPath && imagen_path !== '') {
        finalImagePath = existingCaldero.imagen_path;
      } else if (imagen_path === '') {
        finalImagePath = null;
      }

      console.log('Updating caldero ID:', id);
      await dbRun(
        'UPDATE calderos_ficha SET nombre = ?, marca = ?, tipo_caldero = ?, configuracion = ?, combustible = ?, capacidad_instalada = ?, capacidad_unidad = ?, presion_diseño = ?, presion_unidad = ?, imagen_path = ?, superficie = ?, año = ?, tratamiento_externo = ?, tratamiento_interno = ?, diametro_d = ?, longitud_l = ?, altura_h = ?, ancho_a = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [nombre, marca, tipo_caldero, configuracion, combustible, capacidad_instalada, capacidad_unidad, presion_diseño, presion_unidad, finalImagePath, superficie, año, tratamiento_externo, tratamiento_interno, diametro_d, longitud_l, altura_h, ancho_a, id, req.userId]
      );

      console.log('✓ Caldero updated successfully');
      res.json({ message: 'Caldero updated successfully', id });
    } else {
      // Create new caldero
      console.log('Creating new caldero');
      const calderoId = await dbRun(
        'INSERT INTO calderos_ficha (user_id, plant_id, nombre, marca, tipo_caldero, configuracion, combustible, capacidad_instalada, capacidad_unidad, presion_diseño, presion_unidad, imagen_path, superficie, año, tratamiento_externo, tratamiento_interno, diametro_d, longitud_l, altura_h, ancho_a) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.userId, plant_id, nombre, marca, tipo_caldero, configuracion, combustible, capacidad_instalada, capacidad_unidad, presion_diseño, presion_unidad, imagenPath, superficie, año, tratamiento_externo, tratamiento_interno, diametro_d, longitud_l, altura_h, ancho_a]
      );

      console.log('✓ Caldero created with ID:', calderoId);
      res.status(201).json({
        id: calderoId,
        user_id: req.userId,
        plant_id,
        nombre,
        marca,
        tipo_caldero,
        configuracion,
        combustible,
        capacidad_instalada,
        capacidad_unidad,
        presion_diseño,
        presion_unidad,
        imagen_path: imagenPath,
        superficie,
        año,
        tratamiento_externo,
        tratamiento_interno,
        diametro_d,
        longitud_l,
        altura_h,
        ancho_a,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Create/Update caldero error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete caldero
app.delete('/api/calderos-ficha/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('===== DELETE CALDERO =====');
    console.log('User ID:', req.userId);
    console.log('Caldero ID:', id);

    // Verify caldero belongs to user
    const caldero = await dbGet(
      'SELECT id, plant_id FROM calderos_ficha WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!caldero) {
      return res.status(404).json({ error: 'Caldero not found' });
    }

    await dbRun(
      'DELETE FROM calderos_ficha WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    console.log('✓ Caldero deleted successfully');
    res.json({ message: 'Caldero deleted successfully' });
  } catch (error) {
    console.error('❌ Delete caldero error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Token verification endpoint (for testing)
app.get('/api/verify-token', verifyToken, (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Token is valid',
    userId: req.userId 
  });
});

// ─── Calculator endpoint ───────────────────────────────────────────────────
app.post('/api/calcular', verifyToken, (req, res) => {
  try {
    const { tipo_combustible, tipo_vapor, ...inputs } = req.body;
    if (!tipo_combustible || !COMBUSTIBLES[tipo_combustible]) {
      return res.status(400).json({
        ok: false,
        error: `Combustible '${tipo_combustible}' no reconocido. Opciones: ${Object.keys(COMBUSTIBLES).join(', ')}`
      });
    }
    const resultado = calcular(tipo_combustible, tipo_vapor || 'Saturado', inputs);
    res.json({ ok: true, resultados: resultado });
  } catch (err) {
    console.error('Calculator error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API is running' });
});

// Serve Angular frontend in production
const ANGULAR_DIST = path.join(__dirname, '..', 'dist', 'enerapp');
if (fs.existsSync(ANGULAR_DIST)) {
  app.use(express.static(ANGULAR_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(ANGULAR_DIST, 'index.html'));
  });
  console.log('Serving Angular frontend from', ANGULAR_DIST);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST   /api/auth/signup`);
  console.log(`  POST   /api/auth/login`);
  console.log(`  GET    /api/evaluations (protected)`);
  console.log(`  POST   /api/evaluations (protected)`);
  console.log(`  GET    /api/evaluations/:id (protected)`);
  console.log(`  PUT    /api/evaluations/:id (protected)`);
  console.log(`  DELETE /api/evaluations/:id (protected)`);
  console.log(`  POST   /api/calcular (protected)`);
});
