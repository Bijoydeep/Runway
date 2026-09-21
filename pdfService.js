const PDFDocument = require('pdfkit');

const ACCENT = '#2B4CE0';
const INK = '#1A1B22';
const DIM = '#5A5A64';

function sectionTitle(doc, title) {
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10.5).text(title.toUpperCase());
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(ACCENT).lineWidth(1.1).stroke();
  doc.moveDown(0.6);
}

function rowLine(doc, left, right, size = 10.5) {
  const startY = doc.y;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(size).text(left, { continued: false });
  if (right) {
    doc.fillColor(DIM).font('Helvetica').fontSize(size - 1)
      .text(right, doc.page.margins.left, startY, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'right',
      });
  }
}

function bulletList(doc, items = []) {
  items.forEach((b) => {
    doc.fillColor(INK).font('Helvetica').fontSize(10).text(`•  ${b}`, {
      indent: 10,
      lineGap: 1,
    });
  });
}

/**
 * Renders a resume object (see aiService normalize() for the shape) to a PDF
 * and returns it as a Buffer.
 */
function renderResumePdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(21).text(r.name || 'Your Name');
    if (r.headline) {
      doc.moveDown(0.15);
      doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10.5).text(r.headline);
    }
    const contactBits = [r.contact.email, r.contact.phone, r.contact.location, r.contact.linkedin]
      .filter(Boolean).join('   ·   ');
    if (contactBits) {
      doc.moveDown(0.2);
      doc.fillColor(DIM).font('Helvetica').fontSize(9.5).text(contactBits);
    }

    if (r.summary) {
      sectionTitle(doc, 'Summary');
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(r.summary, { lineGap: 1 });
    }

    if (r.education.length) {
      sectionTitle(doc, 'Education');
      r.education.forEach((e) => {
        rowLine(doc, e.school, e.dates);
        if (e.degree) doc.fillColor(DIM).font('Helvetica-Oblique').fontSize(9.5).text(e.degree);
        if (e.details) doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(e.details);
        doc.moveDown(0.4);
      });
    }

    if (r.experience.length) {
      sectionTitle(doc, 'Experience');
      r.experience.forEach((e) => {
        rowLine(doc, [e.title, e.org].filter(Boolean).join(', '), e.dates);
        bulletList(doc, e.bullets);
        doc.moveDown(0.4);
      });
    }

    if (r.projects.length) {
      sectionTitle(doc, 'Projects');
      r.projects.forEach((e) => {
        rowLine(doc, e.name, e.dates);
        bulletList(doc, e.bullets);
        doc.moveDown(0.4);
      });
    }

    if (r.skills.length) {
      sectionTitle(doc, 'Skills');
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(r.skills.join('  ·  '));
    }

    if (r.certifications.length) {
      sectionTitle(doc, 'Certifications & Activities');
      bulletList(doc, r.certifications);
    }

    doc.end();
  });
}

module.exports = { renderResumePdf };
