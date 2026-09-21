const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESUME_SHAPE = `{"name":"","headline":"","contact":{"email":"","phone":"","location":"","linkedin":""},"summary":"","education":[{"school":"","degree":"","dates":"","details":""}],"experience":[{"title":"","org":"","dates":"","bullets":[""]}],"projects":[{"name":"","dates":"","bullets":[""]}],"skills":[""],"certifications":[""]}`;

function normalize(d = {}) {
  return {
    name: d.name || '',
    headline: d.headline || '',
    contact: Object.assign({ email: '', phone: '', location: '', linkedin: '' }, d.contact || {}),
    summary: d.summary || '',
    education: Array.isArray(d.education) ? d.education.map(e => ({
      school: e.school || '', degree: e.degree || '', dates: e.dates || '', details: e.details || '',
    })) : [],
    experience: Array.isArray(d.experience) ? d.experience.map(e => ({
      title: e.title || '', org: e.org || '', dates: e.dates || '',
      bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
    })) : [],
    projects: Array.isArray(d.projects) ? d.projects.map(e => ({
      name: e.name || '', dates: e.dates || '',
      bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
    })) : [],
    skills: Array.isArray(d.skills) ? d.skills.filter(Boolean) : [],
    certifications: Array.isArray(d.certifications) ? d.certifications.filter(Boolean) : [],
  };
}

async function structureResumeFromText(rawText) {
  const prompt = [
    "You turn a LinkedIn 'Save to PDF' export into a tight one-page resume for a college student or recent graduate applying to their first jobs or internships.",
    'Rewrite descriptions into strong, quantified bullet points where possible, but never invent facts, numbers, employers, or dates that are not implied by the source text.',
    'Prioritize: education, internships/experience, projects, skills, certifications/activities. Keep bullets concise (max ~18 words each, 2-4 bullets per role/project).',
    'Return ONLY minified JSON, no prose, no markdown fences, matching exactly this shape:',
    RESUME_SHAPE,
    "If a field is unknown, use an empty string or empty array — never placeholder text like 'N/A'.",
    'SOURCE TEXT FROM THE LINKEDIN PDF:',
    rawText.slice(0, 12000),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text in AI response');

  const cleaned = textBlock.text.trim().replace(/^```json\s*|```$/g, '');
  const parsed = JSON.parse(cleaned);
  return normalize(parsed);
}

module.exports = { structureResumeFromText, normalize };
