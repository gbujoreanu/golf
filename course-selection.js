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
    slope: Number(tee.slope)
  };
}

export async function ensureSavedApiCourse(client, userId, currentCourses, selection) {
  const item = apiSelectionToSavedCourse(selection);
  const existing = (currentCourses || []).find(course => course.id === item.id || (
    String(course.course).toLocaleLowerCase() === item.course.toLocaleLowerCase()
    && String(course.tee).toLocaleLowerCase() === item.tee.toLocaleLowerCase()
    && Number(course.rating) === item.rating
    && Number(course.slope) === item.slope
  ));
  if (existing) return existing;
  const row = { ...item, user_id: userId };
  const { error } = await client.from('golf_courses').upsert(row, { onConflict: 'user_id,id' });
  if (error) throw error;
  return item;
}

function safeId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
}

