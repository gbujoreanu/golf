import { selectedCourseSnapshot } from './course-snapshot.js';

export function apiSelectionToSavedCourse(selection) {
  const course = selection?.course;
  const tee = selection?.tee;
  if (!course?.id || !course?.name || !tee?.key) throw new Error('Choose a course and tee.');
  return {
    id: `ogapi-${safeId(course.id)}-${safeId(tee.key)}`.slice(0, 180),
    course: course.name,
    tee: tee.label || tee.name,
    par: Number(tee.par),
    rating: Number(tee.rating),
    slope: Number(tee.slope),
    course_snapshot: selectedCourseSnapshot(selection)
  };
}

export async function ensureSavedApiCourse(client, userId, currentCourses, selection) {
  const item = apiSelectionToSavedCourse(selection);
  // An explicit API selection refreshes only its private saved tee, not old rounds.
  // Never conflate a manually-entered course with a provider identity by name.
  const row = { ...item, user_id: userId };
  const { error } = await client.from('golf_courses').upsert(row, { onConflict: 'user_id,id' });
  if (error) throw error;
  return item;
}

function safeId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
}
