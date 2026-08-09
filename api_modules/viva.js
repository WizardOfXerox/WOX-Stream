const { maskId, unmaskId } = require('./_utils');

// Viva Platforms Base URLs & Endpoints
const VIVA_CONFIGS = {
  vivaone: {
    name: 'Viva One',
    badge: 'WOX Viva One',
    prefix: 'vivaone_',
    base: 'https://vivaone.ph',
    api: 'https://api.vivaone.ph/v1'
  },
  vivamax: {
    name: 'VivaMax',
    badge: 'WOX VivaMax',
    prefix: 'vivamax_',
    base: 'https://vivamax.ph',
    api: 'https://api.vivamax.ph/v1'
  },
  vivamoviebox: {
    name: 'Viva MovieBox',
    badge: 'WOX MovieBox',
    prefix: 'vivamb_',
    base: 'https://vivamoviebox.ph',
    api: 'https://api.vivamoviebox.ph/v1'
  }
};

const DEFAULT_STREAM = 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';

// Expanded Viva Catalog (45 Philippine Blockbusters & Series across Viva One, VivaMax, Viva MovieBox)
const VIVA_CATALOG_ITEMS = [
  // ==========================================
  // --- VIVA ONE (15 Titles) ---
  // ==========================================
  {
    id: 'vivaone_deleter',
    sourceKey: 'vivaone',
    title: 'Deleter',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.4',
    cover: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
    description: 'An online content moderator stumbles upon a disturbing video clip of her co-worker taking her own life. As secrets unravel, she is haunted by ghostly apparitions and dark truths.',
    genres: 'Horror, Suspense, Thriller',
    episodes: [{ id: 'ep_deleter_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_spinners',
    sourceKey: 'vivaone',
    title: 'Spinners: Viva Edition',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.3',
    cover: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&auto=format&fit=crop&q=80',
    description: 'High-stakes urban street racing and adrenaline-fueled drama in the heart of Manila.',
    genres: 'Action, Crime, Thriller',
    episodes: [{ id: 'ep_spinners_1', episodeNumber: 1, name: 'Episode 1 (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_rain_espana',
    sourceKey: 'vivaone',
    title: 'The Rain in España',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.5',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    description: 'Louisse Natasha Bonifacio is an architecture student who falls for Kalix Jace Martinez, a university legal management student. Their romance faces collegiate trials and growing ambitions.',
    genres: 'Romance, Drama, University',
    episodes: [
      { id: 'ep_rain_1', episodeNumber: 1, name: 'Episode 1 (HD)', playUrl: DEFAULT_STREAM },
      { id: 'ep_rain_2', episodeNumber: 2, name: 'Episode 2 (HD)', playUrl: DEFAULT_STREAM }
    ]
  },
  {
    id: 'vivaone_expensive_candy',
    sourceKey: 'vivaone',
    title: 'Expensive Candy',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.1',
    cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    description: 'A modest high school teacher falls hopelessly in love with Candy, an independent sex worker in Angeles City.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_candy_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_martyr_single',
    sourceKey: 'vivaone',
    title: 'Martyr or Single',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.9',
    cover: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop&q=80',
    description: 'A hilarious modern romantic comedy exploring the dilemmas of modern dating, long-term relationships, and single life in the city.',
    genres: 'Comedy, Romance',
    episodes: [{ id: 'ep_martyr_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_safehouse',
    sourceKey: 'vivaone',
    title: 'Safehouse Manila',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.2',
    cover: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
    description: 'Undercover operatives seeking refuge in a safehouse discover an insider traitor within their elite task force.',
    genres: 'Action, Thriller, Crime',
    episodes: [{ id: 'ep_safehouse_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_rooftop',
    sourceKey: 'vivaone',
    title: 'Rooftop Nightmares',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.7',
    cover: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=500&auto=format&fit=crop&q=80',
    description: 'A group of college friends pull a rooftop prank during a weekend party, inadvertently unleashing an ancient vengeful spirit.',
    genres: 'Horror, Mystery',
    episodes: [{ id: 'ep_rooftop_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_unconditional',
    sourceKey: 'vivaone',
    title: 'Unconditional Love',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.4',
    cover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=500&auto=format&fit=crop&q=80',
    description: 'A heartwarming drama tracing three generations of a family rebuilding their lives in coastal Cebu.',
    genres: 'Drama, Family',
    episodes: [{ id: 'ep_uncond_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_housemaid',
    sourceKey: 'vivaone',
    title: 'The Housemaid PH',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&auto=format&fit=crop&q=80',
    description: 'A young woman hired as a nanny for an affluent family becomes caught in a web of deceit, obsession, and betrayal.',
    genres: 'Drama, Suspense',
    episodes: [{ id: 'ep_housemaid_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_breakup_playlist',
    sourceKey: 'vivaone',
    title: 'Breakup Playlist 2',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.2',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    description: 'Two musicians who parted ways years ago reunite for an acoustic anniversary concert, confronting unhealed heartbreaks.',
    genres: 'Music, Romance, Drama',
    episodes: [{ id: 'ep_playlist_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_sid_aya',
    sourceKey: 'vivaone',
    title: 'Sid & Aya: Not a Love Story',
    category: '1',
    area: 'Philippines',
    year: '2021',
    score: '9.5',
    cover: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500&auto=format&fit=crop&q=80',
    description: 'Sid suffers from insomnia and hires Aya to accompany him during his sleepless nights in Manila.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_sidaya_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_miss_granny',
    sourceKey: 'vivaone',
    title: 'Miss Granny PH',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.3',
    cover: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&auto=format&fit=crop&q=80',
    description: 'A 70-year-old grandmother magically regains her 20-year-old appearance after taking a portrait at a mysterious photo studio.',
    genres: 'Comedy, Music, Fantasy',
    episodes: [{ id: 'ep_granny_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_st_gallen',
    sourceKey: 'vivaone',
    title: 'Meet Me in St. Gallen',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.1',
    cover: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&auto=format&fit=crop&q=80',
    description: 'Jesse and Celeste cross paths in Switzerland after years apart, questioning whether fate or timing dictates true love.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_gallen_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_camp_sawi',
    sourceKey: 'vivaone',
    title: 'Camp Sawi',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '8.9',
    cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    description: 'Five heartbroken women attend a specialized wellness camp on a secluded island to recover from devastating breakups.',
    genres: 'Comedy, Drama, Romance',
    episodes: [{ id: 'ep_campsawi_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivaone_this_time',
    sourceKey: 'vivaone',
    title: 'This Time',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
    description: 'Childhood friends who only meet every summer vacation navigate the evolution of their feelings as they grow older.',
    genres: 'Romance, Youth',
    episodes: [{ id: 'ep_thistime_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },

  // ==========================================
  // --- VIVAMAX (15 Titles) ---
  // ==========================================
  {
    id: 'vivamax_pantaxa',
    sourceKey: 'vivamax',
    title: 'Pantaxa Laiya',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.2',
    cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    description: 'Glamour, beach resort competitions, and fiery rivalries ignite as aspiring models compete for the coveted Pantaxa title in Laiya.',
    genres: 'Drama, Reality, Romance',
    episodes: [
      { id: 'ep_pantaxa_1', episodeNumber: 1, name: 'Episode 1 (HD)', playUrl: DEFAULT_STREAM },
      { id: 'ep_pantaxa_2', episodeNumber: 2, name: 'Episode 2 (HD)', playUrl: DEFAULT_STREAM }
    ]
  },
  {
    id: 'vivamax_selina_gold',
    sourceKey: 'vivamax',
    title: 'Selina\'s Gold',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.1',
    cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80',
    description: 'Sold by her father to pay off a gambling debt, Selina is forced to work in a remote gold-mining compound where secrets run deep.',
    genres: 'Drama, History, Thriller',
    episodes: [{ id: 'ep_selina_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_scorpio_nights_3',
    sourceKey: 'vivamax',
    title: 'Scorpio Nights 3',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '8.8',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    description: 'A young man living in a claustrophobic boarding house becomes entangled in an affair with the wife of a dangerous security guard.',
    genres: 'Thriller, Romance, Drama',
    episodes: [{ id: 'ep_scorpio_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_adonis',
    sourceKey: 'vivamax',
    title: 'Adonis: Island Desire',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&auto=format&fit=crop&q=80',
    description: 'A tropical island getaway becomes an intense psychological game of romance and betrayal when mysterious strangers arrive.',
    genres: 'Drama, Mystery, Romance',
    episodes: [{ id: 'ep_adonis_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_sukat',
    sourceKey: 'vivamax',
    title: 'Sukat: Full Measure',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.9',
    cover: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500&auto=format&fit=crop&q=80',
    description: 'A passionate story of ambition, fashion design rivalries, and uninhibited romance in suburban Manila.',
    genres: 'Drama, Romance',
    episodes: [{ id: 'ep_sukat_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_bora_paradise',
    sourceKey: 'vivamax',
    title: 'Bora: Island Paradise',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.1',
    cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    description: 'Sun-kissed beaches, midnight parties, and forbidden romances collide during Boracay peak season.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_bora_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_island_boys',
    sourceKey: 'vivamax',
    title: 'Island Boys',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.7',
    cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&auto=format&fit=crop&q=80',
    description: 'Four childhood friends on a coastal fishing island face life-changing choices when a luxury yacht docks nearby.',
    genres: 'Adventure, Drama',
    episodes: [{ id: 'ep_islands_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_secrets_estate',
    sourceKey: 'vivamax',
    title: 'Secrets of the Estate',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&auto=format&fit=crop&q=80',
    description: 'Inheriting an ancestral hacienda, a young heiress uncovers dark family legacies hidden behind locked doors.',
    genres: 'Mystery, Thriller',
    episodes: [{ id: 'ep_estate_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_midnight_affair',
    sourceKey: 'vivamax',
    title: 'Midnight Affair',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.2',
    cover: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=500&auto=format&fit=crop&q=80',
    description: 'A chance late-night taxi ride sparks an intense affair between two strangers running away from their pasts.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_midnight_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_dark_secrets',
    sourceKey: 'vivamax',
    title: 'Dark Secrets',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.8',
    cover: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=500&auto=format&fit=crop&q=80',
    description: 'An investigative journalist probing a high-society scandal realizes she is being hunted by those in power.',
    genres: 'Thriller, Suspense',
    episodes: [{ id: 'ep_darksec_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_moonlight_palms',
    sourceKey: 'vivamax',
    title: 'Moonlight Palms',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.3',
    cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    description: 'Under the swaying palms of Palawan, a painter discovers inspiration and forbidden love with a resort owner.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_moonlight_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_velvet_nights',
    sourceKey: 'vivamax',
    title: 'Velvet Nights',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.9',
    cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    description: 'Glamorous nightlife meets underground crime syndicates in Makati high-rise lounges.',
    genres: 'Thriller, Drama',
    episodes: [{ id: 'ep_velvet_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_siren_sea',
    sourceKey: 'vivamax',
    title: 'Siren of the Sea',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    description: 'A free-diver off the coast of Panglao rescues a mysterious swimmer who harbors ancient oceanic secrets.',
    genres: 'Fantasy, Drama',
    episodes: [{ id: 'ep_siren_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_tropical_storm',
    sourceKey: 'vivamax',
    title: 'Tropical Storm',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.1',
    cover: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
    description: 'Stranded in a remote lodge during a super typhoon, eight guests realize a killer is among them.',
    genres: 'Action, Thriller',
    episodes: [{ id: 'ep_storm_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamax_golden_hour',
    sourceKey: 'vivamax',
    title: 'Golden Hour',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '9.4',
    cover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
    description: 'A photographer capturing sunset landcapes in Siargao meets a free spirit who changes her life forever.',
    genres: 'Drama, Romance',
    episodes: [{ id: 'ep_golden_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },

  // ==========================================
  // --- VIVA MOVIEBOX (15 Titles) ---
  // ==========================================
  {
    id: 'vivamb_ang_pambansang_third_wheel',
    sourceKey: 'vivamoviebox',
    title: 'Ang Pambansang Third Wheel',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=500&auto=format&fit=crop&q=80',
    description: 'Trina is a perpetual third wheel who finally meets Neo, a man who seems perfect. But complication arises when she discovers he has an 8-year-old son.',
    genres: 'Romance, Comedy, Drama',
    episodes: [{ id: 'ep_thirdwheel_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_squatter',
    sourceKey: 'vivamoviebox',
    title: 'Squatters: Manila Heat',
    category: '1',
    area: 'Philippines',
    year: '2024',
    score: '8.9',
    cover: 'https://images.unsplash.com/photo-1477959858617-67f30ac4ce78?w=500&auto=format&fit=crop&q=80',
    description: 'A gritty urban tale of survival, brotherhood, and forbidden romance set in the slums of Metro Manila.',
    genres: 'Action, Drama',
    episodes: [{ id: 'ep_squatters_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_miracle_cell_7',
    sourceKey: 'vivamoviebox',
    title: 'Miracle in Cell No. 7 (PH)',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.7',
    cover: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    description: 'A mentally impaired father is wrongfully accused of a crime and imprisoned. His fellow inmates help smuggle his young daughter into prison to see him.',
    genres: 'Drama, Family, Heartwarming',
    episodes: [{ id: 'ep_miracle_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_100_tula',
    sourceKey: 'vivamoviebox',
    title: '100 Tula Para Kay Stella',
    category: '1',
    area: 'Philippines',
    year: '2021',
    score: '9.3',
    cover: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=500&auto=format&fit=crop&q=80',
    description: 'Fidel, a stuttering college student, writes 100 poems for Stella, a rockstar aspiring classmate he has secretly loved for years.',
    genres: 'Romance, Music, Drama',
    episodes: [{ id: 'ep_tula_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_exes_baggage',
    sourceKey: 'vivamoviebox',
    title: 'Exes Baggage',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.4',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    description: 'Pia and Nix meet by chance and quickly fall in love. But unresolved issues from their exes threaten to tear them apart.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_exes_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_unforgettable',
    sourceKey: 'vivamoviebox',
    title: 'Unforgettable',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.2',
    cover: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&auto=format&fit=crop&q=80',
    description: 'Jasmine travels on foot across Luzon with her rescue dog to visit her sick grandmother in Baguio.',
    genres: 'Comedy, Drama, Family',
    episodes: [{ id: 'ep_unforget_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_revirginized',
    sourceKey: 'vivamoviebox',
    title: 'Revirginized',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '8.8',
    cover: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop&q=80',
    description: 'A mother who got pregnant at 16 decides to relive her lost youth by attending a wild weekend beach festival.',
    genres: 'Comedy, Drama',
    episodes: [{ id: 'ep_revir_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_buybust',
    sourceKey: 'vivamoviebox',
    title: 'BuyBust',
    category: '1',
    area: 'Philippines',
    year: '2021',
    score: '9.6',
    cover: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
    description: 'An anti-narcotics squad is trapped inside a labyrinthine Manila slum during a botched drug raid.',
    genres: 'Action, Thriller, Crime',
    episodes: [{ id: 'ep_buybust_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_second_chance',
    sourceKey: 'vivamoviebox',
    title: 'A Second Chance PH',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.5',
    cover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=500&auto=format&fit=crop&q=80',
    description: 'Popoy and Basha face the harsh realities of married life and financial strains after years of courtship.',
    genres: 'Drama, Romance',
    episodes: [{ id: 'ep_secchance_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_never_not_love',
    sourceKey: 'vivamoviebox',
    title: 'Never Not Love You',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.3',
    cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
    description: 'Gio and Joanne move to London together, struggling to balance career aspirations and love in a foreign land.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_nevernot_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_hows_of_us',
    sourceKey: 'vivamoviebox',
    title: 'The Hows of Us',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.6',
    cover: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&auto=format&fit=crop&q=80',
    description: 'A young couple dealing with career pressure tries to save their relationship and their shared house.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_howsofus_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_hello_love_goodbye',
    sourceKey: 'vivamoviebox',
    title: 'Hello, Love, Goodbye',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '9.8',
    cover: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500&auto=format&fit=crop&q=80',
    description: 'Joy, a domestic worker in Hong Kong, meets Ethan, a bartender. They find solace in each other while pursuing big dreams.',
    genres: 'Romance, Drama',
    episodes: [{ id: 'ep_hello_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_beauty_bestie',
    sourceKey: 'vivamoviebox',
    title: 'Beauty and the Bestie',
    category: '1',
    area: 'Philippines',
    year: '2021',
    score: '9.0',
    cover: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop&q=80',
    description: 'An undercover agent enlists his estranged best friend to impersonate a missing beauty pageant contestant.',
    genres: 'Action, Comedy',
    episodes: [{ id: 'ep_bestie_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_super_parental',
    sourceKey: 'vivamoviebox',
    title: 'The Super Parental Guardians',
    category: '1',
    area: 'Philippines',
    year: '2022',
    score: '9.1',
    cover: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&auto=format&fit=crop&q=80',
    description: 'Unlikely guardians Arci and Paco are forced to raise orphaned kids while battling hilarious local gang rivalries.',
    genres: 'Comedy, Action, Family',
    episodes: [{ id: 'ep_parental_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  },
  {
    id: 'vivamb_fantastica',
    sourceKey: 'vivamoviebox',
    title: 'Fantastica',
    category: '1',
    area: 'Philippines',
    year: '2023',
    score: '8.9',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    description: 'A struggling carnival owner goes on a magical quest across fairytale realms to find three lost princesses.',
    genres: 'Comedy, Fantasy, Adventure',
    episodes: [{ id: 'ep_fantastica_1', episodeNumber: 1, name: 'Full Movie (HD)', playUrl: DEFAULT_STREAM }]
  }
];

function normalizeTitle(t) {
  if (!t) return '';
  return t.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
}

module.exports = async function vivaHandler(req, res) {
  const query = req.query || {};
  const action = query.action || 'search';
  const targetSource = (query.source || 'all').toLowerCase();

  try {
    if (action === 'catalog' || action === 'search') {
      const keyword = (query.q || query.keyword || '').trim().toLowerCase();
      
      let items = VIVA_CATALOG_ITEMS;
      if (targetSource !== 'all') {
        items = items.filter(i => i.sourceKey === targetSource);
      }

      if (keyword) {
        items = items.filter(i => {
          const normT = normalizeTitle(i.title);
          const normK = normalizeTitle(keyword);
          return normT.includes(normK) || normK.includes(normT) || i.genres.toLowerCase().includes(keyword);
        });
      }

      const formatted = items.map(item => {
        const cfg = VIVA_CONFIGS[item.sourceKey] || VIVA_CONFIGS.vivaone;
        return {
          id: maskId(item.sourceKey, item.id),
          rawId: item.id,
          sourceKey: item.sourceKey,
          sourceName: cfg.name,
          category: item.category,
          title: item.title,
          cover: item.cover,
          score: item.score,
          area: item.area,
          year: item.year,
          genres: item.genres,
          badge: cfg.badge,
          isViva: true
        };
      });

      return res.status(200).json({
        success: true,
        source: targetSource,
        total: formatted.length,
        items: formatted
      });
    }

    if (action === 'detail') {
      const rawId = query.id || query.contentId || '';
      const { id: unmaskedId } = unmaskId(rawId);
      const cleanId = unmaskedId.replace(/^(vivaone_|vivamax_|vivamb_)/, '');
      const item = VIVA_CATALOG_ITEMS.find(i => i.id === rawId || i.id === unmaskedId || i.id.endsWith(cleanId));

      if (!item) {
        return res.status(404).json({ success: false, error: 'Viva content not found' });
      }

      const cfg = VIVA_CONFIGS[item.sourceKey] || VIVA_CONFIGS.vivaone;
      
      // Look for duplicate/mirror matches across other sources
      const matches = VIVA_CATALOG_ITEMS.filter(i => 
        normalizeTitle(i.title) === normalizeTitle(item.title)
      );

      const mirrors = matches.map(m => {
        const mCfg = VIVA_CONFIGS[m.sourceKey] || VIVA_CONFIGS.vivaone;
        return {
          id: maskId(m.sourceKey, m.id),
          sourceKey: m.sourceKey,
          sourceName: mCfg.name,
          isDefault: m.id === item.id
        };
      });

      return res.status(200).json({
        success: true,
        detail: {
          id: maskId(item.sourceKey, item.id),
          title: item.title,
          cover: item.cover,
          description: item.description,
          category: item.category,
          area: item.area,
          year: item.year,
          score: item.score,
          genres: item.genres,
          sourceKey: item.sourceKey,
          sourceName: cfg.name,
          badge: cfg.badge,
          isViva: true,
          mirrors: mirrors,
          episodes: item.episodes.map(ep => ({
            id: ep.id,
            episodeNumber: ep.episodeNumber,
            name: ep.name,
            playUrl: ep.playUrl
          }))
        }
      });
    }

    if (action === 'episode') {
      const contentId = query.contentId || query.id || '';
      const episodeId = query.episodeId || '';
      const { id: unmaskedId } = unmaskId(contentId);
      const cleanId = unmaskedId.replace(/^(vivaone_|vivamax_|vivamb_)/, '');
      const item = VIVA_CATALOG_ITEMS.find(i => i.id === contentId || i.id === unmaskedId || i.id.endsWith(cleanId));

      if (!item) {
        return res.status(404).json({ success: false, error: 'Viva content not found' });
      }

      const episode = item.episodes.find(e => String(e.id) === String(episodeId)) || item.episodes[0];
      return res.status(200).json({
        success: true,
        streamUrl: episode ? episode.playUrl : DEFAULT_STREAM,
        downloadUrl: episode ? episode.playUrl : DEFAULT_STREAM,
        rawStreamUrl: episode ? episode.playUrl : DEFAULT_STREAM,
        subtitles: []
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid action parameter' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
