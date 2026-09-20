import { normalizeHoleData } from './course-snapshot.js';
const DEFAULT_BASE_URL = 'https://api.opengolfapi.org/v1';

export class OpenGolfApiError extends Error {
  constructor(message, code = 'provider_error') {
    super(message);
    this.name = 'OpenGolfApiError';
    this.code = code;
  }
}

export class OpenGolfApiProvider {
  constructor({ fetcher = globalThis.fetch?.bind(globalThis), baseUrl = DEFAULT_BASE_URL } = {}) {
    if (!fetcher) throw new Error('A fetch implementation is required.');
    this.fetcher = fetcher;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.searchCache = new Map();
    this.detailCache = new Map();
  }

  async searchCourses(query, { signal, limit = 8 } = {}) {
    const cleanQuery = String(query || '').trim();
    if (cleanQuery.length < 2) return [];
    const cacheKey = `${cleanQuery.toLocaleLowerCase()}|${limit}`;
    if (this.searchCache.has(cacheKey)) return this.searchCache.get(cacheKey);
    const url = `${this.baseUrl}/courses/search?q=${encodeURIComponent(cleanQuery)}&limit=${Math.max(1, Math.min(12, limit))}`;
    const payload = await this.#request(url, signal);
    const courses = normalizeCourseSearch(payload);
    this.searchCache.set(cacheKey, courses);
    return courses;
  }

  async getCourseOptions(courseId, { signal } = {}) {
    const id = String(courseId || '').trim();
    if (!id) throw new OpenGolfApiError('Choose a course first.', 'invalid_course');
    if (this.detailCache.has(id)) return this.detailCache.get(id);
    const [detailPayload, teePayload] = await Promise.all([
      this.#request(`${this.baseUrl}/courses/${encodeURIComponent(id)}`, signal),
      this.#request(`${this.baseUrl}/courses/${encodeURIComponent(id)}/tees`, signal)
    ]);
    const course = normalizeCourseDetail(detailPayload, id);
    course.retrievedAt = new Date().toISOString();
    const tees = normalizeTees(teePayload, course);
    if (!tees.length) {
      throw new OpenGolfApiError('No reliable tee ratings were available. Add this course manually instead.', 'incomplete_tees');
    }
    const result = { course, tees };
    this.detailCache.set(id, result);
    return result;
  }

  async #request(url, signal) {
    let response;
    try {
      response = await this.fetcher(url, { signal, headers: { Accept: 'application/json' } });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new OpenGolfApiError('Course search is temporarily unavailable. Use manual entry instead.', 'network_error');
    }
    if (!response?.ok) {
      const code = response?.status === 429 ? 'rate_limited' : 'provider_error';
      const message = response?.status === 429
        ? 'Course search has reached its temporary limit. Use manual entry or try again later.'
        : 'Course search is temporarily unavailable. Use manual entry instead.';
      throw new OpenGolfApiError(message, code);
    }
    try {
      return await response.json();
    } catch {
      throw new OpenGolfApiError('Course data could not be read. Use manual entry instead.', 'invalid_response');
    }
  }
}

export function normalizeCourseSearch(payload) {
  const rows = firstArray(payload?.courses, payload?.results, payload?.data?.courses, payload?.data, payload);
  const seen = new Set();
  return rows.map(normalizeCourseSummary).filter(course => {
    if (!course?.id || !course.name || seen.has(course.id)) return false;
    seen.add(course.id);
    return true;
  });
}

export function normalizeCourseDetail(payload, fallbackId = '') {
  const row = payload?.course || payload?.data?.course || payload?.data || payload || {};
  const summary = normalizeCourseSummary({ ...row, id: row.id || fallbackId });
  if (!summary?.id || !summary.name) throw new OpenGolfApiError('This course record is incomplete. Add it manually instead.', 'incomplete_course');
  const holes = validInteger(row.holes ?? row.hole_count, 1, 36);
  const scorecard = firstArray(row.scorecard, row.hole_data, row.holes_detail).map(item => ({
    hole: validInteger(item?.hole ?? item?.number, 1, 36),
    par: validInteger(item?.par, 2, 8)
  })).filter(item => item.hole && item.par);
  return { ...summary, holes, par: validNumber(row.par, 27, 90) ?? summary.par, scorecard,
    sourceHoles: normalizeHoleData(firstArray(row.scorecard, row.hole_data, row.holes_detail)).filter(hole => !holes || hole.number <= holes) };
}

export function normalizeTees(payload, course) {
  const rows = firstArray(payload?.tees, payload?.tee_sets, payload?.data?.tees, payload?.data, payload);
  const isNineHoleCourse = Number(course?.holes) === 9;
  const seen = new Set();
  return rows.map((row, index) => {
    const name = cleanText(row?.tee_name ?? row?.name ?? row?.tee ?? row?.color, 60);
    const gender = cleanText(row?.gender ?? row?.sex, 24);
    let par = validNumber(row?.par ?? course?.par, 27, 90);
    let rating = validNumber(row?.course_rating ?? row?.rating, 20, 90);
    const slope = validNumber(row?.slope ?? row?.slope_rating, 55, 155);
    if (!name || !par || !rating || !slope) return null;
    const sourcePar = par, sourceRating = rating;
    if (isNineHoleCourse || (par < 50 && rating < 50)) {
      par *= 2;
      rating *= 2;
    }
    const sourceId = cleanText(row?.tee_key ?? row?.id, 100) || null;
    const key = sourceId || `${slug(name)}-${slug(gender || 'all')}-${index}`;
    const unique = `${key}|${rating}|${slope}`;
    if (seen.has(unique)) return null;
    seen.add(unique);
    return {
      key,
      name,
      gender,
      label: gender ? `${name} · ${gender}` : name,
      par: Number(par.toFixed(1)),
      rating: Number(rating.toFixed(1)),
      slope: Number(slope),
      sourceId, sourcePar, sourceRating,
      sourceHoles: normalizeHoleData(firstArray(row?.holes, row?.scorecard, row?.hole_data, row?.holes_detail)).filter(hole => !course?.holes || hole.number <= course.holes),
      yardage: validInteger(row?.yardage ?? row?.yards, 500, 10000)
    };
  }).filter(Boolean);
}

function normalizeCourseSummary(row) {
  if (!row || typeof row !== 'object') return null;
  const name = cleanText(row.name ?? row.course_name ?? row.course, 140);
  const city = cleanText(row.city ?? row.location?.city, 80);
  const state = cleanText(row.state ?? row.state_code ?? row.location?.state, 40);
  return {
    id: cleanText(row.id ?? row.course_id ?? row.uuid, 100),
    name,
    city,
    state,
    location: [city, state].filter(Boolean).join(', ') || 'Location unavailable',
    holes: validInteger(row.holes ?? row.hole_count, 1, 36),
    par: validNumber(row.par, 27, 90)
  };
}

function firstArray(...values) {
  return values.find(Array.isArray) || [];
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validNumber(value, min, max) {
  if (value == null || value === '' || typeof value === 'boolean' || typeof value === 'object') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function validInteger(value, min, max) {
  if (value == null || value === '' || typeof value === 'boolean' || typeof value === 'object') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
