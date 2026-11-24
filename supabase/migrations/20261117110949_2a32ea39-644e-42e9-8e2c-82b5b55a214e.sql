CREATE OR REPLACE FUNCTION public.wall_hero_rate(_hero int, _level int) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT (power(2, _hero) * _level)::numeric $$;
CREATE OR REPLACE FUNCTION public.wall_hero_cost(_hero int, _level int) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT round(100 * power(1.035, _level) * power(3, _hero))::numeric $$;