import { withSignedAvatars } from '/shared/social.js?v=4';

export async function loadGroupScorecard(client, roundId) {
  const { data, error } = await client.rpc('fairway_group_scorecard', { round_session_id:roundId });
  if (error) throw error;
  if (!data) throw new Error('This scorecard is not available.');
  return { ...data, participants:await withSignedAvatars(client, data.participants || []) };
}

export async function savePlayerScorecard(client, roundId, playerId, holes, status='draft') {
  const scores=Array.from({length:18},(_,index)=>{
    const value=Number(holes[index]);
    return Number.isInteger(value)&&value>0 ? value : null;
  });
  const { error } = await client.rpc('fairway_upsert_scorecard', {
    round_session_id:roundId,scorecard_player:playerId,scores,card_status:status
  });
  if (error) throw error;
}

export async function completeGroupRound(client, roundId) {
  const { error } = await client.rpc('fairway_update_round_status', {
    round_session_id:roundId,next_status:'completed'
  });
  if (error) throw error;
}
