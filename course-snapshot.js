// Versioned, allowlisted course data only. No scores, profiles, or provider prose.
export function normalizeHoleData(rows) {
  if (!Array.isArray(rows)) return [];
  const groups = new Map();
  for (const row of rows) {
    const number = numeric(row?.hole ?? row?.number ?? row?.hole_number, 1, 36, true);
    if (number == null) continue;
    const hole = {
      number,
      par: numeric(row?.par, 2, 8, true),
      yardage: numeric(row?.yardage ?? row?.yards, 1, 1500, true),
      stroke_index: numeric(row?.stroke_index ?? row?.handicap ?? row?.hcp, 1, 36, true)
    };
    const previous = groups.get(number);
    // Conflicting duplicate numbers are ambiguous, not a license to guess.
    groups.set(number, previous === undefined ? hole : JSON.stringify(previous) === JSON.stringify(hole) ? hole : null);
  }
  return [...groups.values()].filter(Boolean).sort((a,b) => a.number-b.number);
}

export function selectedCourseSnapshot({ course, tee }) {
  if (!course?.id || !tee?.key || !course.retrievedAt) throw new Error('Course provenance is incomplete. Select it again.');
  const teeHoles = normalizeHoleData(tee.sourceHoles);
  const courseHoles = normalizeHoleData(course.sourceHoles);
  const numbers = new Set([...courseHoles, ...teeHoles].map(hole => hole.number));
  const holes = [...numbers].sort((a,b)=>a-b).map(number => {
    const specific = teeHoles.find(hole => hole.number === number);
    const generic = courseHoles.find(hole => hole.number === number);
    return {
      number,
      par: specific?.par ?? generic?.par ?? null,
      // Never describe a course-wide yardage/handicap as tee-specific.
      yardage: specific?.yardage ?? null,
      stroke_index: specific?.stroke_index ?? null
    };
  });
  return {
    version: 1,
    provider: 'opengolfapi',
    retrieved_at: new Date(course.retrievedAt).toISOString(),
    course: { id: course.id, name: course.name, city: course.city || '', state: course.state || '', hole_count: course.holes ?? null, par: course.par ?? null },
    tee: { id: tee.sourceId ?? null, selection_key: tee.key, name: tee.name, gender: tee.gender || '', par: tee.sourcePar ?? null, rating: tee.sourceRating ?? null, slope: tee.slope ?? null, yardage: tee.yardage ?? null },
    holes,
    // Preserve course-level data separately, without assigning it to a tee.
    course_holes: courseHoles
  };
}

export function snapshotForRound(snapshot, holeCount) {
  if (!snapshot) return null; // Historical/manual data is not fabricated.
  if (![9,18].includes(Number(holeCount))) throw new Error('Invalid round length');
  return { ...JSON.parse(JSON.stringify(snapshot)), round_hole_count: Number(holeCount) };
}

function numeric(value, min, max, integer = false) {
  if (value == null || value === '' || typeof value === 'boolean' || typeof value === 'object') return null;
  const number = Number(value);
  return Number.isFinite(number) && (!integer || Number.isInteger(number)) && number >= min && number <= max ? number : null;
}
