const { setCorsHeaders, maskId, unmaskId } = require('./_utils');

// Helper for fetching a collection
async function fetchCollection(collection, title, limit = 12) {
    try {
        const query = `collection:${collection} AND mediatype:movies`;
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&fl[]=downloads&sort[]=downloads desc&rows=${limit}&page=1&output=json`;
        
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        const docs = data.response?.docs || [];
        
        const items = docs.map(doc => ({
            id: maskId('classics', doc.identifier),
            category: '0',
            title: doc.title || 'Unknown Title',
            cover: `https://archive.org/services/img/${doc.identifier}`,
            score: '', 
            domainType: 'MOVIE',
            sourceName: 'Classics',
            sourceKey: 'classics'
        }));
        
        if (items.length === 0) return null;
        
        return {
            title: title,
            type: 'CLASSICS_SECTION',
            items: items
        };
    } catch (e) {
        console.error(`Error fetching collection ${collection}:`, e);
        return null;
    }
}

async function fetchClassicsPaginated(page = 1, collection = 'feature_films') {
    try {
        const query = collection ? `collection:${collection} AND mediatype:movies` : 'mediatype:movies';
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&fl[]=downloads&sort[]=downloads desc&rows=20&page=${page}&output=json`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        const docs = data.response?.docs || [];
        return docs.map(doc => ({
            id: maskId('classics', doc.identifier),
            category: '0',
            title: doc.title || 'Unknown Title',
            cover: `https://archive.org/services/img/${doc.identifier}`,
            score: '',
            domainType: 'MOVIE',
            sourceName: 'Classics',
            sourceKey: 'classics'
        }));
    } catch (_) {
        return [];
    }
}

async function searchClassics(query) {
    try {
        const searchQuery = `${query} AND mediatype:movies`;
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQuery)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&fl[]=downloads&sort[]=downloads desc&rows=20&output=json`;
        
        const response = await fetch(url);
        if (!response.ok) return [];
        
        const data = await response.json();
        const docs = data.response?.docs || [];
        
        return docs.map(doc => ({
            id: maskId('classics', doc.identifier),
            category: '0',
            title: doc.title || 'Unknown Title',
            cover: `https://archive.org/services/img/${doc.identifier}`,
            score: '',
            domainType: 'MOVIE',
            sourceName: 'Classics',
            sourceKey: 'classics'
        }));
    } catch (e) {
        console.error('Error in searchClassics:', e);
        return [];
    }
}

const handler = async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    const { action, id, q } = req.query;
    
    if (action === 'search' || (action === undefined && q)) {
        const query = q || '';
        const items = await searchClassics(query);
        return res.status(200).json({
            success: true,
            data: items
        });
    }
    
    if (action === 'detail' && id) {
        try {
            const { id: identifier } = unmaskId(id);
            if (!identifier) {
                return res.status(400).json({ success: false, error: 'Invalid ID' });
            }
            
            const url = `https://archive.org/metadata/${identifier}`;
            const response = await fetch(url);
            if (!response.ok) {
                return res.status(500).json({ success: false, error: 'Failed to fetch metadata' });
            }
            
            const data = await response.json();
            const metadata = data.metadata || {};
            const files = data.files || [];
            
            let genres = metadata.subject || '';
            if (Array.isArray(genres)) {
                genres = genres.join(', ');
            }
            
            // Find video files
            const videoFiles = files.filter(f => {
                if (!f.name) return false;
                const name = f.name.toLowerCase();
                const format = (f.format || '').toLowerCase();
                return format.includes('mpeg') || 
                       format.includes('h.264') || 
                       format.includes('video') || 
                       format.includes('mp4') || 
                       name.endsWith('.mp4') || 
                       name.endsWith('.ogv') || 
                       name.endsWith('.webm') || 
                       name.endsWith('.mkv');
            });
            
            // Sort by size desc
            videoFiles.sort((a, b) => {
                const sizeA = parseInt(a.size) || 0;
                const sizeB = parseInt(b.size) || 0;
                return sizeB - sizeA;
            });
            
            let streamUrl = '';
            if (videoFiles.length > 0) {
                streamUrl = `https://archive.org/download/${identifier}/${videoFiles[0].name}`;
            }
            
            const detail = {
                id: id,
                title: metadata.title || 'Unknown Title',
                cover: `https://archive.org/services/img/${identifier}`,
                description: metadata.description || 'No description available.',
                year: metadata.year || metadata.date || '',
                category: '0',
                genres: genres,
                score: '',
                sourceName: 'Classics',
                sourceKey: 'classics',
                episodes: [
                    { 
                        id: 'ep1', 
                        name: 'Full Movie', 
                        episodeNumber: 1, 
                        definitions: [], 
                        subtitles: [] 
                    }
                ],
                embedUrl: `https://archive.org/embed/${identifier}`,
                streamUrl: streamUrl,
                streamType: 'mp4'
            };
            
            return res.status(200).json({
                success: true,
                detail: detail
            });
        } catch (e) {
            console.error('Error fetching detail:', e);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
    }
    
    // Default: action=catalog or empty
    const shelves = await fetchClassicsShelves();
    return res.status(200).json({
        success: true,
        shelves: shelves
    });
};
async function fetchClassicsShelves() {
    const shelvesPromises = [
        fetchCollection('feature_films', 'CLASSIC FEATURE FILMS', 12),
        fetchCollection('Film_Noir', 'FILM NOIR COLLECTION', 12),
        fetchCollection('scifi_horror', 'SCI-FI & HORROR CLASSICS', 12),
        fetchCollection('animationandcartoons', 'CLASSIC ANIMATION', 12)
    ];
    
    const shelves = (await Promise.all(shelvesPromises)).filter(Boolean);
    return shelves;
}

module.exports = handler;
module.exports.fetchClassicsShelves = fetchClassicsShelves;
module.exports.fetchClassicsPaginated = fetchClassicsPaginated;
module.exports.searchClassics = searchClassics;
