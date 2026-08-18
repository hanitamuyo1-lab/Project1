require('dotenv').config();
const express = require('express');
const cors = require('cors');
const emailRoutes = require('./routes/email');
const paymentRoutes = require('./routes/payment');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use(emailRoutes);
app.use(paymentRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Signal backend listening on :${PORT}`));
