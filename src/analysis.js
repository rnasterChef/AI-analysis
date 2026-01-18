import { supabase } from "./supabase.js";

export async function loadUserVotes(roomId, userId) {
  const { data: votes, error: voteError } = await supabase
    .from("votes")
    .select("decision, question_id")
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (voteError) throw voteError;
  if (!votes || votes.length === 0) return { votes: [], questions: [] };

  const questionIds = Array.from(
    new Set(votes.map(v => v.question_id).filter(Boolean))
  );
  if (questionIds.length === 0) return { votes, questions: [] };

  const { data: questions, error: questionError } = await supabase
    .from("questions")
    .select("id, qnum, content, kind")
    .in("id", questionIds)
    .order("qnum", { ascending: true });

  if (questionError) throw questionError;

  return { votes, questions };
}
