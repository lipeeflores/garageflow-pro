-- Add unique constraint for ranking_scores on profile_id and month
ALTER TABLE public.ranking_scores 
ADD CONSTRAINT ranking_scores_profile_month_unique UNIQUE (profile_id, month);