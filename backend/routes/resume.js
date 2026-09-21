const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { requireAuth } = require('../middleware/auth');
const { structureResumeFromText, normalize } = require('../services/aiService');
const { renderResumePdf } = require('../services/pdfService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are accepted.'));
    cb(null, true);
  },
});

// Upload a LinkedIn "Save to PDF" export, extract its text, and ask the AI
// to turn it into a structured resume draft.
router.post('/parse', requireAuth, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF uploaded.' });

  try {
    const parsed = await pdfParse(req.file.buffer);
    const rawText = parsed.text || '';
    if (!rawText.trim()) {
      return res.status(422).json({ error: "Couldn't read any text from that PDF." });
    }
    const resume = await structureResumeFromText(rawText);
    res.json({ resume });
  } catch (err) {
    console.error('parse failed:', err);
    res.status(500).json({ error: 'Could not process that PDF right now.' });
  }
});

// Take an (edited) resume object from the client and render it to a PDF.
router.post('/pdf', requireAuth, async (req, res) => {
  try {
    const resume = normalize(req.body.resume || {});
    const buffer = await renderResumePdf(resume);
    const filename = `${(resume.name || 'resume').trim().replace(/\s+/g, '_').toLowerCase()}_runway_resume.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('pdf render failed:', err);
    res.status(500).json({ error: 'Could not generate the PDF.' });
  }
});

module.exports = router;
