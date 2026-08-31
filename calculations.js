export function roundToOne(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

export function sumHoles(holes = []) {
  return holes.reduce((total, score) => total + (Number(score) || 0), 0);
}

export function scoreDifferential(score, courseRating, slopeRating, pcc = 0) {
  const scoreValue = Number(score);
  const ratingValue = Number(courseRating);
  const slopeValue = Number(slopeRating);
  const pccValue = Number(pcc) || 0;

  if (!Number.isFinite(scoreValue) || !Number.isFinite(ratingValue) || !Number.isFinite(slopeValue) || slopeValue <= 0) {
    return null;
  }

  return roundToOne((113 / slopeValue) * (scoreValue - ratingValue - pccValue));
}

export function handicapSelection(scoreCount) {
  if (scoreCount < 3) return { use: 0, adjustment: 0 };
  if (scoreCount === 3) return { use: 1, adjustment: -2 };
  if (scoreCount === 4) return { use: 1, adjustment: -1 };
  if (scoreCount === 5) return { use: 1, adjustment: 0 };
  if (scoreCount === 6) return { use: 2, adjustment: -1 };
  if (scoreCount <= 8) return { use: 2, adjustment: 0 };
  if (scoreCount <= 11) return { use: 3, adjustment: 0 };
  if (scoreCount <= 14) return { use: 4, adjustment: 0 };
  if (scoreCount <= 16) return { use: 5, adjustment: 0 };
  if (scoreCount <= 18) return { use: 6, adjustment: 0 };
  if (scoreCount === 19) return { use: 7, adjustment: 0 };
  return { use: 8, adjustment: 0 };
}

export function calculateHandicapIndex(rounds = []) {
  const recentRounds = [...rounds]
    .filter((round) => round && round.date && Number.isFinite(Number(round.total)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 20);

  const scoredRounds = recentRounds
    .map((round) => ({
      ...round,
      differential: scoreDifferential(round.total, round.courseRating, round.slope, round.pcc)
    }))
    .filter((round) => round.differential !== null);

  const selection = handicapSelection(scoredRounds.length);
  if (!selection.use) {
    return {
      index: null,
      eligible: false,
      totalCount: scoredRounds.length,
      usedCount: 0,
      usedRoundIds: [],
      roundsNeeded: Math.max(0, 3 - scoredRounds.length)
    };
  }

  const selected = [...scoredRounds]
    .sort((a, b) => a.differential - b.differential)
    .slice(0, selection.use);
  const average = selected.reduce((sum, round) => sum + round.differential, 0) / selected.length;
  const index = Math.min(54, roundToOne(average + selection.adjustment));

  return {
    index,
    eligible: true,
    totalCount: scoredRounds.length,
    usedCount: selected.length,
    usedRoundIds: selected.map((round) => round.id),
    roundsNeeded: 0
  };
}

export function courseHandicap(handicapIndex, slopeRating, courseRating, par) {
  const index = Number(handicapIndex);
  const slope = Number(slopeRating);
  const rating = Number(courseRating);
  const parValue = Number(par);
  if (![index, slope, rating, parValue].every(Number.isFinite) || slope <= 0) return null;
  return Math.round(index * (slope / 113) + (rating - parValue));
}

export function calculateAverages(rounds = []) {
  const totals = rounds.map((round) => Number(round.total)).filter(Number.isFinite);
  if (!totals.length) {
    return { rounds: 0, average: null, recentAverage: null, best: null, averageToPar: null };
  }

  const recent = [...rounds]
    .filter((round) => Number.isFinite(Number(round.total)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);
  const toPar = rounds
    .filter((round) => Number.isFinite(Number(round.total)) && Number.isFinite(Number(round.par)))
    .map((round) => Number(round.total) - Number(round.par));

  return {
    rounds: totals.length,
    average: roundToOne(totals.reduce((sum, total) => sum + total, 0) / totals.length),
    recentAverage: roundToOne(recent.reduce((sum, round) => sum + Number(round.total), 0) / recent.length),
    best: Math.min(...totals),
    averageToPar: toPar.length ? roundToOne(toPar.reduce((sum, value) => sum + value, 0) / toPar.length) : null
  };
}

export function formatToPar(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const numeric = Number(value);
  if (numeric === 0) return "E";
  return numeric > 0 ? `+${roundToOne(numeric)}` : String(roundToOne(numeric));
}
