import { formatToPar, roundToOne, scoreDifferential, sumHoles } from './calculations.js';

export function normalizeHoleCount(value) {
  return Number(value) === 9 ? 9 : 18;
}

export function teeSnapshotForLength(tee, holeCount) {
  const count=normalizeHoleCount(holeCount);
  return count===9
    ? { par:Math.round(Number(tee.par)/2), rating:roundToOne(Number(tee.rating)/2), slope:Number(tee.slope) }
    : { par:Number(tee.par), rating:Number(tee.rating), slope:Number(tee.slope) };
}

export function summarizeScores(scores, tee, holeCount, pcc=0) {
  const count=normalizeHoleCount(holeCount);
  const played=Array.from(scores).slice(0,count).map(Number);
  const front=sumHoles(played.slice(0,9));
  const back=count===18?sumHoles(played.slice(9,18)):null;
  const total=front+(back||0);
  const complete=played.length===count&&played.every(score=>Number.isInteger(score)&&score>0);
  const snapshot=teeSnapshotForLength(tee,count);
  return {count,front,back,total,complete,par:snapshot.par,rating:snapshot.rating,
    toPar:complete?formatToPar(total-snapshot.par):'—',
    differential:complete?scoreDifferential(total,snapshot.rating,snapshot.slope,pcc):null};
}
