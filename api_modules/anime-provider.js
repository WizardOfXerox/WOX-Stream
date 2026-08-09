const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

async function anilistQuery(query, variables) {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    });
    
    if (!response.ok) {
        throw new Error(`AniList API error: ${response.status}`);
    }
    
    return response.json();
}

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 1 && month <= 3) return 'WINTER';
    if (month >= 4 && month <= 6) return 'SPRING';
    if (month >= 7 && month <= 9) return 'SUMMER';
    return 'FALL';
}

function formatAnimeItem(anime) {
    const rawId = anime.idMal ? anime.idMal.toString() : `al_${anime.id}`;
    return {
        id: maskId('anime', rawId),
        category: '1',
        title: anime.title.english || anime.title.romaji || anime.title.native || 'Unknown Title',
        cover: anime.coverImage?.extraLarge || anime.coverImage?.large || '',
        score: anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null,
        domainType: 'ANIME',
        sourceName: 'Anime HD',
        sourceKey: 'anime',
        totalEpisodes: anime.episodes || 0,
        malId: anime.idMal
    };
}

const catalogQuery = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $status: MediaStatus) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, season: $season, seasonYear: $seasonYear, status: $status, isAdult: false) {
      id
      idMal
      title { romaji english native }
      coverImage { extraLarge large medium }
      bannerImage
      episodes
      status
      averageScore
      genres
      description(asHtml: false)
      seasonYear
      format
      startDate { year month day }
    }
  }
}
`;

let cachedAnimeShelves = null;
let lastAnimeFetchTime = 0;
const ANIME_CACHE_TTL = 15 * 60 * 1000;

const FALLBACK_ANIME_ITEMS = [
  { id: maskId('anime', '16498'), category: '1', title: 'Attack on Titan', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-m5luJwwJnPLj.png', score: '8.8', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Fantasy Drama' },
  { id: maskId('anime', '113415'), category: '1', title: 'Jujutsu Kaisen', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg', score: '8.7', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Fantasy Supernatural' },
  { id: maskId('anime', '101922'), category: '1', title: 'Demon Slayer: Kimetsu no Yaiba', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgLd.jpg', score: '8.6', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Fantasy Adventure' },
  { id: maskId('anime', '151807'), category: '1', title: 'Solo Leveling', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-6P9bX42wFqN2.png', score: '8.5', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Fantasy Adventure' },
  { id: maskId('anime', '154587'), category: '1', title: 'Frieren: Beyond Journey\'s End', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-k312m2545K32.jpg', score: '9.3', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Fantasy Adventure Drama' },
  { id: maskId('anime', '127230'), category: '1', title: 'Chainsaw Man', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FloXTaAcuZrh.png', score: '8.4', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Fantasy Horror' },
  { id: maskId('anime', '21'), category: '1', title: 'One Piece', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-6VbHhZ4e58.png', score: '8.9', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Adventure Fantasy' },
  { id: maskId('anime', '269'), category: '1', title: 'Bleach', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx269-K5N5M2m5M.jpg', score: '8.2', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Fantasy Adventure' },
  { id: maskId('anime', '1535'), category: '1', title: 'Death Note', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-law2932K.jpg', score: '8.7', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Suspense Mystery Supernatural' },
  { id: maskId('anime', '140960'), category: '1', title: 'SPY x FAMILY', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-983m235.png', score: '8.5', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Comedy Action Slice of Life' },
  { id: maskId('anime', '5114'), category: '1', title: 'Fullmetal Alchemist: Brotherhood', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-105825.jpg', score: '9.0', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Adventure Fantasy' },
  { id: maskId('anime', '20'), category: '1', title: 'Naruto', cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20-2581.png', score: '8.0', domainType: 'ANIME', sourceName: 'Anime HD', sourceKey: 'anime', genres: 'Action Adventure Fantasy' }
];

async function fetchAnimeShelves() {
    const now = Date.now();
    if (cachedAnimeShelves && (now - lastAnimeFetchTime < ANIME_CACHE_TTL)) {
        return cachedAnimeShelves;
    }

    try {
        const currentYear = new Date().getFullYear();
        const currentSeason = getCurrentSeason();

        const [trendingData, topRatedData, popularSeasonData, newReleasesData] = await Promise.all([
            anilistQuery(catalogQuery, { page: 1, perPage: 12, sort: ['TRENDING_DESC'], status_in: ['RELEASING', 'NOT_YET_RELEASED', 'FINISHED'] }),
            anilistQuery(catalogQuery, { page: 1, perPage: 12, sort: ['SCORE_DESC'] }),
            anilistQuery(catalogQuery, { page: 1, perPage: 12, sort: ['POPULARITY_DESC'], season: currentSeason, seasonYear: currentYear }),
            anilistQuery(catalogQuery, { page: 1, perPage: 12, sort: ['START_DATE_DESC'], status: 'RELEASING' })
        ]);

        const shelves = [
            {
                title: 'TRENDING ANIME',
                items: trendingData.data.Page.media.map(formatAnimeItem)
            },
            {
                title: 'POPULAR THIS SEASON',
                items: popularSeasonData.data.Page.media.map(formatAnimeItem)
            },
            {
                title: 'NEW RELEASES',
                items: newReleasesData.data.Page.media.map(formatAnimeItem)
            },
            {
                title: 'TOP RATED ANIME',
                items: topRatedData.data.Page.media.map(formatAnimeItem)
            }
        ];

        cachedAnimeShelves = { success: true, shelves };
        lastAnimeFetchTime = now;
        return cachedAnimeShelves;
    } catch (error) {
        console.warn('AniList live fetch error (using fallback anime catalog):', error.message);
        if (cachedAnimeShelves) return cachedAnimeShelves;
        return {
            success: true,
            shelves: [
                { title: 'TOP ANIME HITS', items: FALLBACK_ANIME_ITEMS.slice(0, 6) },
                { title: 'POPULAR ACTION & FANTASY', items: FALLBACK_ANIME_ITEMS.slice(6, 12) }
            ]
        };
    }
}

async function searchAnime(query) {
    const searchQuery = `
    query ($search: String, $page: Int) {
      Page(page: $page, perPage: 20) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
          id
          idMal
          title { romaji english }
          coverImage { extraLarge large }
          episodes
          averageScore
          genres
          status
          format
        }
      }
    }
    `;

    try {
        const result = await anilistQuery(searchQuery, { search: query, page: 1 });
        const items = result.data.Page.media.map(formatAnimeItem);
        return { success: true, items };
    } catch (error) {
        console.error('Error searching anime:', error);
        return { success: false, error: error.message };
    }
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
}

async function getAnimeDetail(maskedId) {
    try {
        const { provider, id: rawId } = unmaskId(maskedId);
        if (provider !== 'anime') {
            return { success: false, error: 'Invalid provider' };
        }

        let malId = rawId;

        // If it's an anilist ID, fetch from anilist to get MAL ID or just use AniList data
        if (rawId.startsWith('al_')) {
            const anilistId = rawId.substring(3);
            const query = `
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                idMal
              }
            }
            `;
            const alData = await anilistQuery(query, { id: parseInt(anilistId, 10) });
            malId = alData.data.Media.idMal;
            
            if (!malId) {
                return { success: false, error: 'MAL ID not found for this anime, cannot fetch streams.' };
            }
        }

        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`);
        if (!jikanRes.ok) throw new Error('Jikan API error');
        const jikanData = await jikanRes.json();
        const anime = jikanData.data;

        let episodesCount = anime.episodes || 0;
        
        let episodes = [];
        for (let i = 1; i <= episodesCount; i++) {
            episodes.push({
                id: `ep${i}`,
                name: `Episode ${i}`,
                episodeNumber: i,
                embedUrl: `https://vidlink.pro/anime/${malId}/${i}/sub?fallback=true`,
                dubEmbedUrl: `https://vidlink.pro/anime/${malId}/${i}/dub?fallback=true`
            });
        }
        
        // Try Jikan episodes endpoint if missing episode count
        if (episodesCount === 0) {
           try {
               const epRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes`);
               if (epRes.ok) {
                   const epData = await epRes.json();
                   if (epData.data && epData.data.length > 0) {
                       episodes = epData.data.map(ep => ({
                           id: `ep${ep.mal_id}`,
                           name: ep.title || `Episode ${ep.mal_id}`,
                           episodeNumber: ep.mal_id,
                           embedUrl: `https://vidlink.pro/anime/${malId}/${ep.mal_id}/sub?fallback=true`,
                           dubEmbedUrl: `https://vidlink.pro/anime/${malId}/${ep.mal_id}/dub?fallback=true`
                       }));
                   }
               }
           } catch(e) {
               console.error('Failed to fetch episodes', e);
           }
        }

        const detail = {
            id: maskedId,
            title: anime.title_english || anime.title || anime.title_japanese,
            cover: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
            description: stripHtml(anime.synopsis),
            year: anime.year ? anime.year.toString() : '',
            category: '1',
            genres: anime.genres ? anime.genres.map(g => g.name).join(', ') : '',
            score: anime.score ? anime.score.toString() : null,
            sourceName: 'Anime HD',
            sourceKey: 'anime',
            episodes: episodes,
            streamType: 'embed'
        };

        return { success: true, detail };
    } catch (error) {
        console.error('Error fetching anime detail:', error);
        return { success: false, error: error.message };
    }
}

async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, id, q } = req.query;
    const act = action || 'catalog';

    try {
        if (act === 'catalog' || act === 'shelves') {
            const data = await fetchAnimeShelves();
            return res.json(data);
        } else if (action === 'search') {
            if (!q) return res.json({ success: false, error: 'Query parameter "q" is required' });
            const data = await searchAnime(q);
            return res.json(data);
        } else if (action === 'detail') {
            if (!id) return res.json({ success: false, error: 'ID parameter is required' });
            const data = await getAnimeDetail(id);
            return res.json(data);
        } else {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

module.exports = handler;
module.exports.fetchAnimeShelves = fetchAnimeShelves;
module.exports.searchAnime = searchAnime;
module.exports.getAnimeDetail = getAnimeDetail;
