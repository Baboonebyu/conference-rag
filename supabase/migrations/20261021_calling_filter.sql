-- Add optional speaker-calling filtering to RAG vector search.
-- Run this once in Supabase SQL Editor for an existing project.

DROP FUNCTION IF EXISTS public.match_sentences(vector, integer);

CREATE INDEX IF NOT EXISTS sentence_embeddings_calling_idx
ON public.sentence_embeddings (calling);

CREATE OR REPLACE FUNCTION public.match_sentences(
  query_embedding vector(1536),
  match_count integer DEFAULT 20,
  filter_calling text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  talk_id uuid,
  title text,
  speaker text,
  calling text,
  url text,
  text text,
  similarity float
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF filter_calling IS NULL THEN
    RETURN QUERY
    SELECT
      se.id,
      se.talk_id,
      se.title,
      se.speaker,
      se.calling,
      se.url,
      se.text,
      1 - (se.embedding <=> query_embedding) AS similarity
    FROM public.sentence_embeddings AS se
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      se.id,
      se.talk_id,
      se.title,
      se.speaker,
      se.calling,
      se.url,
      se.text,
      1 - (se.embedding <=> query_embedding) AS similarity
    FROM public.sentence_embeddings AS se
    WHERE se.calling = filter_calling
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_speaker_callings()
RETURNS TABLE (calling text)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT DISTINCT se.calling
  FROM public.sentence_embeddings AS se
  WHERE se.calling IS NOT NULL AND btrim(se.calling) <> ''
  ORDER BY se.calling;
$$;

REVOKE ALL ON FUNCTION public.match_sentences(vector, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_sentences(vector, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_speaker_callings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_speaker_callings() TO authenticated;

NOTIFY pgrst, 'reload schema';
