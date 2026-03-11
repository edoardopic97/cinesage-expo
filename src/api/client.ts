import axios from 'axios';

const API_BASE = 'https://cine-sage-app.vercel.app';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export interface MovieResult {
  Title: string;
  Year: string;
  Poster: string;
  Genre: string;
  Plot: string;
  imdbRating: string;
  Runtime?: string;
  Country?: string;
  Type?: string;
  Episodes?: number;
  Seasons?: number;
  Director?: string;
  Actors?: string;
  Language?: string;
  Awards?: string;
  imdbID?: string;
  Rated?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
}

export interface SearchResponse {
  success: boolean;
  movies: MovieResult[];
  count: number;
  cached: boolean;
}

export async function searchMovies(
  query: string,
  category: 'movie' | 'tv' | 'all' = 'all'
): Promise<SearchResponse> {
  // tRPC mutation expects the input wrapped in a specific format
  const res = await api.post('/api/trpc/movies.search', {
    json: { query, category },
  });

  // tRPC batch response: [{result:{data:{json:{...}}}}]
  const raw = res.data;
  const data = Array.isArray(raw) ? raw[0] : raw;
  const payload =
    data?.result?.data?.json ??
    data?.result?.data ??
    data?.result ??
    data;
  if (payload?.movies) return payload;
  throw new Error('Unexpected API response format');
}

export default api;
