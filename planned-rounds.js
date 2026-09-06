import { withSignedAvatars } from '/shared/social.js?v=4';

export async function loadPlannedRoundData(client) {
  const [{ data:rounds, error:roundsError }, { data:courses, error:coursesError }] = await Promise.all([
    client.rpc('fairway_planned_rounds'),
    client.from('golf_courses').select('id,course,tee,par,rating,slope').order('course').order('tee')
  ]);
  if (roundsError || coursesError) throw roundsError || coursesError;
  const people = (rounds || []).flatMap(round => round.participants || []);
  const signed = await withSignedAvatars(client, people);
  const byId = new Map(signed.map(person => [person.id, person]));
  return {
    courses:courses || [],
    rounds:(rounds || []).map(round => ({
      ...round,
      participants:(round.participants || []).map(person => byId.get(person.id) || person)
    }))
  };
}

export async function createPlannedRound(client, values) {
  const { data, error } = await client.rpc('fairway_create_round_session', {
    course_row_id:values.courseId, play_at:values.playAt, zone:values.timeZone, note_text:values.notes
  });
  if (error) throw error;
  return data;
}

export async function updatePlannedRound(client, id, values) {
  const { error } = await client.rpc('fairway_update_planned_round', {
    round_session_id:id, course_row_id:values.courseId, play_at:values.playAt,
    zone:values.timeZone, note_text:values.notes
  });
  if (error) throw error;
}

export async function invitePlayers(client, roundId, userIds) {
  for (const targetId of userIds) {
    const { error } = await client.rpc('fairway_invite_player', { round_session_id:roundId, target_id:targetId });
    if (error) throw error;
  }
}

export async function respondToRound(client, id, response) {
  const { error } = await client.rpc('fairway_respond_round', { round_session_id:id, response, add_calendar:false });
  if (error) throw error;
}

export async function removePlayer(client, roundId, userId) {
  const { error } = await client.rpc('fairway_remove_round_participant', { round_session_id:roundId, target_id:userId });
  if (error) throw error;
}

export async function leaveRound(client, id) {
  const { error } = await client.rpc('fairway_leave_planned_round', { round_session_id:id });
  if (error) throw error;
}

export async function cancelRound(client, id) {
  const { error } = await client.rpc('fairway_cancel_planned_round', { round_session_id:id });
  if (error) throw error;
}
