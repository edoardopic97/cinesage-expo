import axios from 'axios';
import { auth } from '../lib/firebase';

const API_BASE = 'https://cinelyse-api.vercel.app';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use(async (config) => {
  const headers = await getAuthHeaders();
  Object.assign(config.headers, headers);
  return config;
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
  category: 'movie' | 'tv' | 'all' = 'all',
  uid?: string,
  exclude?: string[],
  aiMode: boolean = true
): Promise<SearchResponse> {
  let enrichedQuery = query;
  if (exclude?.length) {
    enrichedQuery += `. Do NOT include any of these titles I already have: ${exclude.join(', ')}`;
  }
  const res = await api.post('/api/trpc/movies.search', {
    json: { query: enrichedQuery, category, uid: uid || null, aiMode },
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

export async function searchByTitle(query: string): Promise<MovieResult[]> {
  const headers = await getAuthHeaders();
  const res = await axios.get(`${API_BASE}/api/movie/search`, {
    params: { s: query },
    headers,
  });
  if (res.data?.Response !== 'True' || !res.data.Search) return [];
  const details = await Promise.all(
    res.data.Search.slice(0, 10).map(async (m: any) => {
      try {
        const d = await axios.get(`${API_BASE}/api/movie/details`, {
          params: { i: m.imdbID },
          headers,
        });
        if (d.data?.Response !== 'True') return null;
        const r = d.data;
        return {
          Title: r.Title,
          Year: r.Year,
          Poster: r.Poster !== 'N/A' ? r.Poster : '',
          Genre: r.Genre !== 'N/A' ? r.Genre : '',
          Plot: r.Plot !== 'N/A' ? r.Plot : '',
          imdbRating: r.imdbRating !== 'N/A' ? r.imdbRating : '',
          Runtime: r.Runtime !== 'N/A' ? r.Runtime : undefined,
          Country: r.Country !== 'N/A' ? r.Country : undefined,
          Type: r.Type,
          Director: r.Director !== 'N/A' ? r.Director : undefined,
          Actors: r.Actors !== 'N/A' ? r.Actors : undefined,
          Language: r.Language !== 'N/A' ? r.Language : undefined,
          Awards: r.Awards !== 'N/A' ? r.Awards : undefined,
          imdbID: r.imdbID,
          Rated: r.Rated !== 'N/A' ? r.Rated : undefined,
          Ratings: r.Ratings,
        } as MovieResult;
      } catch { return null; }
    })
  );
  return details.filter(Boolean) as MovieResult[];
}
