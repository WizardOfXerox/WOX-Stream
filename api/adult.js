/**
 * Adult Content (18+) API Module for WOX-Stream
 * 
 * IMPORTANT - Content Gating:
 * This module itself does NOT implement gating. It is expected that the frontend
 * handles the gating via a Settings toggle (e.g., an 18+ mode switch).
 * 
 * Sources:
 * - EPORNER API v2 (Primary)
 * - RedTube API (Secondary / Fallback - currently not implemented in primary paths)
 */

const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

async function fetchEpornerData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Eporner API Error: ${response.status} ${response.statusText}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching from Eporner:', error);
        return null;
    }
}

function formatEpornerVideo(video) {
    return {
        id: maskId('adult', video.id),
        category: '0',
        title: video.title,
        cover: video.default_thumb?.src || '',
        score: video.rate ? video.rate.toString() : null,
        domainType: 'MOVIE',
        sourceName: 'Adult',
        sourceKey: 'adult',
        duration: video.length_min || ''
    };
}

async function fetchAdultPaginated(page = 1, order = 'top-rated', query = '') {
    const url = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=20&page=${page}&thumbsize=medium&order=${order}&format=json`;
    const data = await fetchEpornerData(url);
    if (data && Array.isArray(data.videos)) {
        return data.videos.map(formatEpornerVideo);
    }
    return [];
}

async function fetchAdultShelves() {
    const shelves = [
        { title: 'TRENDING NOW', type: 'ADULT_SECTION', order: 'most-viewed', per_page: 12 },
        { title: 'TOP RATED', type: 'ADULT_SECTION', order: 'top-rated', per_page: 12 },
        { title: 'LATEST RELEASES', type: 'ADULT_SECTION', order: 'latest', per_page: 12 }
    ];

    const results = await Promise.all(shelves.map(async (shelf) => {
        const url = `https://www.eporner.com/api/v2/video/search/?query=&per_page=${shelf.per_page}&page=1&thumbsize=medium&order=${shelf.order}&format=json`;
        const data = await fetchEpornerData(url);
        let items = [];
        if (data && data.videos) {
            items = data.videos.map(formatEpornerVideo);
        }
        return {
            title: shelf.title,
            type: shelf.type,
            items: items
        };
    }));

    return results;
}

async function searchAdult(query) {
    const url = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(query)}&per_page=20&page=1&thumbsize=medium&order=top-rated&format=json`;
    const data = await fetchEpornerData(url);
    if (data && data.videos) {
        return data.videos.map(formatEpornerVideo);
    }
    return [];
}

async function getAdultDetail(id) {
    const unmasked = unmaskId(id);
    const videoId = unmasked.id;
    
    // In EPORNER, the single video endpoint responds directly with the video object
    // Wait, the API documentation says the detail endpoint is:
    // https://www.eporner.com/api/v2/video/id/?id={video_id}&thumbsize=big&format=json
    // And usually it returns the single video object or an object with the video inside.
    // The previous prompt said:
    // Fetch from EPORNER: https://www.eporner.com/api/v2/video/id/?id={video_id}&thumbsize=big&format=json
    
    const url = `https://www.eporner.com/api/v2/video/id/?id=${videoId}&thumbsize=big&format=json`;
    const data = await fetchEpornerData(url);
    
    // Check if the video object itself is returned or it's wrapped
    const video = data?.video || data;
    
    if (video && video.id) {
        return {
            id: id,
            title: video.title,
            cover: video.default_thumb?.src || '',
            description: `Keywords: ${video.keywords || ''}`,
            year: video.added ? video.added.split('-')[0] : '',
            category: '0',
            genres: video.keywords || '',
            score: video.rate ? video.rate.toString() : null,
            sourceName: 'Adult',
            sourceKey: 'adult',
            episodes: [
                {
                    id: videoId,
                    name: 'Full Video',
                    episodeNumber: 1,
                    definitions: [],
                    subtitles: []
                }
            ],
            embedUrl: `https://www.eporner.com/embed/${videoId}/`,
            streamType: 'embed'
        };
    }
    return null;
}

const handler = async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action || 'catalog';

    try {
        if (action === 'catalog') {
            const shelves = await fetchAdultShelves();
            return res.status(200).json({ success: true, shelves });
        } else if (action === 'search') {
            const query = req.query.q || '';
            const results = await searchAdult(query);
            return res.status(200).json({ success: true, results });
        } else if (action === 'detail') {
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({ success: false, error: 'Missing ID' });
            }
            const detail = await getAdultDetail(id);
            if (detail) {
                return res.status(200).json({ success: true, detail });
            } else {
                return res.status(404).json({ success: false, error: 'Not found' });
            }
        } else {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Adult API Error:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = handler;
module.exports.fetchAdultShelves = fetchAdultShelves;
module.exports.fetchAdultPaginated = fetchAdultPaginated;
module.exports.searchAdult = searchAdult;
module.exports.getAdultDetail = getAdultDetail;
