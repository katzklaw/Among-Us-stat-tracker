const STORAGE_KEY = 'among-us-stat-tracker-data';

const createPlayerStats = () => ({
  gamesPlayed: 0,
  gamesAsCrewmate: 0,
  gamesAsImpostor: 0,
  crewWins: 0,
  impWins: 0,
  crewWinRate: 0,
  impWinRate: 0
});

const finalizePlayerRates = (playerStats) => {
  for (const stat of Object.values(playerStats)) {
    stat.crewWinRate = stat.gamesAsCrewmate ? stat.crewWins / stat.gamesAsCrewmate : 0;
    stat.impWinRate = stat.gamesAsImpostor ? stat.impWins / stat.gamesAsImpostor : 0;
  }

  return playerStats;
};

function parseLogText(text, fileName = 'unknown.log') {
  const lines = String(text).split(/\r?\n/);
  const stats = {
    fileName,
    games: lines.some((line) => line.trim() && !/set protection on/i.test(line)) ? 1 : 0,
    impWins: 0,
    crewWins: 0,
    totalKills: 0,
    crewDeaths: 0,
    playerStats: {}
  };
  const roles = new Map();
  const seenDeaths = new Set();
  const playerStats = new Map();
  let inRolesSection = false;
  let winnerRecorded = false;

  const normalizeName = (name) => String(name || '').replace(/\s*\(.+?\)$/, '').trim();
  const normalizeRole = (role = '') => String(role).trim().toLowerCase();
  const crewRoles = new Set(['crewmate', 'crew', 'engineer', 'scientist', 'tracker', 'detective', 'noisemaker', 'host']);
  const impostorRoles = new Set(['impostor', 'viper', 'shapeshifter', 'phantom']);
  const isImpostorRole = (role = '') => impostorRoles.has(normalizeRole(role));
  const isCrewLikeRole = (role = '') => crewRoles.has(normalizeRole(role)) || !isImpostorRole(role);

  const getPlayerStats = (name) => {
    const normalized = normalizeName(name).toLowerCase();
    if (!normalized) {
      return null;
    }

    if (!playerStats.has(normalized)) {
      playerStats.set(normalized, createPlayerStats());
    }

    return playerStats.get(normalized);
  };

  const recordWinnerForPlayers = (winnerTeam) => {
    for (const [playerName, playerRole] of roles.entries()) {
      const playerRecord = getPlayerStats(playerName);
      if (!playerRecord) {
        continue;
      }

      if (winnerTeam === 'crewmate' && isCrewLikeRole(playerRole)) {
        playerRecord.crewWins += 1;
      }

      if (winnerTeam === 'impostor' && isImpostorRole(playerRole)) {
        playerRecord.impWins += 1;
      }
    }
  };

  const registerDeath = (name) => {
    const cleaned = normalizeName(name);
    if (!cleaned || seenDeaths.has(cleaned.toLowerCase())) {
      return;
    }

    const role = roles.get(cleaned.toLowerCase());
    const isCrewLike = role ? isCrewLikeRole(role) : true;
    if (isCrewLike) {
      stats.crewDeaths += 1;
    }
    seenDeaths.add(cleaned.toLowerCase());
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /set protection on/i.test(trimmed)) {
      continue;
    }

    if (/^Player's Roles:/.test(trimmed)) {
      inRolesSection = true;
      continue;
    }

    if (inRolesSection) {
      const roleMatch = trimmed.match(/^(.+?) \(([^)]+)\) : (.+)$/);
      if (roleMatch) {
        const playerName = roleMatch[1].trim();
        const playerRole = roleMatch[3].trim().toLowerCase();
        roles.set(playerName.toLowerCase(), playerRole);

        const playerRecord = getPlayerStats(playerName);
        if (playerRecord) {
          playerRecord.gamesPlayed += 1;
          if (isCrewLikeRole(playerRole)) {
            playerRecord.gamesAsCrewmate += 1;
          } else if (isImpostorRole(playerRole)) {
            playerRecord.gamesAsImpostor += 1;
          }
        }
        continue;
      }

      if (/^\[/.test(trimmed)) {
        inRolesSection = false;
      }
    }

    const normalized = trimmed.toLowerCase();

    if (/^winners?:?\s*/i.test(trimmed)) {
      const winnerTeamMatch = trimmed.match(/^winners?:?\s*(crewmates?|crew|impostors?|impostor team)\b/i);
      if (winnerTeamMatch) {
        const winnerTeam = winnerTeamMatch[1].toLowerCase();
        if (/^crew|^crewmate/.test(winnerTeam)) {
          stats.crewWins += 1;
          recordWinnerForPlayers('crewmate');
          winnerRecorded = true;
          continue;
        }

        if (/^impostor/.test(winnerTeam)) {
          stats.impWins += 1;
          recordWinnerForPlayers('impostor');
          winnerRecorded = true;
          continue;
        }
      }
    }

    if (!winnerRecorded && /impostor team wins|impostors? win|impostor wins/.test(normalized)) {
      stats.impWins += 1;
      recordWinnerForPlayers('impostor');
      winnerRecorded = true;
      continue;
    }

    if (!winnerRecorded && /crewmates? win|crew win|crewmate win/.test(normalized)) {
      stats.crewWins += 1;
      recordWinnerForPlayers('crewmate');
      winnerRecorded = true;
      continue;
    }

    const killMatch = trimmed.match(/^(.+?)\s*(?:\([^)]+\))?\s+killed\s+(.+?)\s*(?:\([^)]+\))?(?:\s+(?:at|outside|in|near|during|from)\b|$)/i);
    if (killMatch) {
      const victim = normalizeName(killMatch[2]);
      if (!/^\d+\s+players$/i.test(victim)) {
        stats.totalKills += 1;
        registerDeath(victim);
        continue;
      }
    }

    const deathLineMatch = trimmed.match(/^(.*?)\s*(?:\([^)]+\))?\s+(?:was killed|was eliminated|was ejected|is dead|has died)(?:\s+by\b.*)?$/i);
    if (deathLineMatch) {
      registerDeath(deathLineMatch[1]);
      continue;
    }

    const roundDeathsMatch = trimmed.match(/players died this round:\s*(.+)$/i);
    if (roundDeathsMatch) {
      const names = roundDeathsMatch[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      for (const name of names) {
        registerDeath(name);
      }
      continue;
    }

    const bodyFoundMatch = trimmed.match(/^(.*?)\s*(?:\([^)]+\))?'s body was found/i);
    if (bodyFoundMatch) {
      registerDeath(bodyFoundMatch[1]);
    }
  }

  stats.playerStats = finalizePlayerRates(Object.fromEntries(playerStats.entries()));
  return stats;
}

const elements = {
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  searchInput: document.getElementById('searchInput'),
  clearButton: document.getElementById('clearButton'),
  gameTableBody: document.getElementById('gameTableBody'),
  playerTableBody: document.getElementById('playerTableBody'),
  gamesTotal: document.getElementById('gamesTotal'),
  crewWinsTotal: document.getElementById('crewWinsTotal'),
  impWinsTotal: document.getElementById('impWinsTotal'),
  totalKillsTotal: document.getElementById('totalKillsTotal'),
  crewDeathsTotal: document.getElementById('crewDeathsTotal')
};

const state = {
  entries: [],
  players: {},
  search: ''
};

function loadStoredEntries() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function aggregatePlayers(entries) {
  const playerMap = {};

  for (const entry of entries) {
    for (const [playerName, stat] of Object.entries(entry.playerStats || {})) {
      if (!playerMap[playerName]) {
        playerMap[playerName] = createPlayerStats();
      }

      const target = playerMap[playerName];
      target.gamesPlayed += stat.gamesPlayed;
      target.gamesAsCrewmate += stat.gamesAsCrewmate;
      target.gamesAsImpostor += stat.gamesAsImpostor;
      target.crewWins += stat.crewWins;
      target.impWins += stat.impWins;
    }
  }

  return finalizePlayerRates(playerMap);
}

function formatRate(rate) {
  return Number.isFinite(rate) ? `${rate.toFixed(2)} (${(rate * 100).toFixed(0)}%)` : '0.00 (0%)';
}

function renderSummary() {
  const totals = state.entries.reduce(
    (acc, entry) => {
      acc.games += entry.games;
      acc.crewWins += entry.crewWins;
      acc.impWins += entry.impWins;
      acc.totalKills += entry.totalKills;
      acc.crewDeaths += entry.crewDeaths;
      return acc;
    },
    { games: 0, crewWins: 0, impWins: 0, totalKills: 0, crewDeaths: 0 }
  );

  elements.gamesTotal.textContent = String(totals.games);
  elements.crewWinsTotal.textContent = String(totals.crewWins);
  elements.impWinsTotal.textContent = String(totals.impWins);
  elements.totalKillsTotal.textContent = String(totals.totalKills);
  elements.crewDeathsTotal.textContent = String(totals.crewDeaths);
}

function renderGames() {
  const searchTerm = state.search;
  const filtered = state.entries.filter((entry) => {
    const haystack = `${entry.fileName} ${entry.games} ${entry.crewWins} ${entry.impWins} ${entry.totalKills} ${entry.crewDeaths}`.toLowerCase();
    return haystack.includes(searchTerm);
  });

  if (filtered.length === 0) {
    elements.gameTableBody.innerHTML = '<tr><td colspan="6" class="empty">No matching game data yet.</td></tr>';
    return;
  }

  elements.gameTableBody.innerHTML = filtered.map((entry) => `
    <tr>
      <td>${entry.fileName}</td>
      <td>${entry.games}</td>
      <td>${entry.crewWins}</td>
      <td>${entry.impWins}</td>
      <td>${entry.totalKills}</td>
      <td>${entry.crewDeaths}</td>
    </tr>
  `).join('');
}

function renderPlayers() {
  const searchTerm = state.search;
  const playerRows = Object.entries(state.players || {}).map(([playerName, stat]) => ({ playerName, ...stat }));
  const filtered = playerRows.filter((row) => {
    const haystack = `${row.playerName} ${row.gamesPlayed} ${row.gamesAsCrewmate} ${row.gamesAsImpostor} ${row.crewWins} ${row.impWins}`.toLowerCase();
    return haystack.includes(searchTerm);
  });

  if (filtered.length === 0) {
    elements.playerTableBody.innerHTML = '<tr><td colspan="8" class="empty">No matching players yet.</td></tr>';
    return;
  }

  elements.playerTableBody.innerHTML = filtered.map((row) => `
    <tr>
      <td>${row.playerName}</td>
      <td>${row.gamesPlayed}</td>
      <td>${row.gamesAsCrewmate}</td>
      <td>${row.gamesAsImpostor}</td>
      <td>${row.crewWins}</td>
      <td>${row.impWins}</td>
      <td>${formatRate(row.crewWinRate)}</td>
      <td>${formatRate(row.impWinRate)}</td>
    </tr>
  `).join('');
}

function renderAll() {
  state.search = elements.searchInput.value.trim().toLowerCase();
  renderSummary();
  renderGames();
  renderPlayers();
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file && file.name);
  if (files.length === 0) {
    return;
  }

  const parsedEntries = await Promise.all(
    files.map(async (file) => parseLogText(await file.text(), file.name))
  );

  const previousEntries = loadStoredEntries();
  state.entries = [...previousEntries, ...parsedEntries];
  state.players = aggregatePlayers(state.entries);
  saveEntries(state.entries);
  renderAll();
}

function bindEvents() {
  elements.fileInput.addEventListener('change', async (event) => {
    await handleFiles(event.target.files);
    event.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove('dragover');
    });
  });

  elements.dropZone.addEventListener('drop', async (event) => {
    await handleFiles(event.dataTransfer.files);
  });

  elements.searchInput.addEventListener('input', renderAll);

  elements.clearButton.addEventListener('click', () => {
    window.localStorage.removeItem(STORAGE_KEY);
    state.entries = [];
    state.players = {};
    renderAll();
  });
}

function bootstrap() {
  state.entries = loadStoredEntries();
  state.players = aggregatePlayers(state.entries);
  bindEvents();
  renderAll();
}

bootstrap();
