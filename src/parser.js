export function parseLogText(text, fileName = 'unknown.log') {
  const lines = text.split(/\r?\n/);
  const stats = {
    fileName,
    games: 0,
    impWins: 0,
    crewWins: 0,
    totalKills: 0,
    crewDeaths: 0
  };
  const roles = new Map();
  const seenDeaths = new Set();
  let inRolesSection = false;

  const normalizeName = (name) => name.replace(/\s*\(.+?\)$/, '').trim();

  const registerDeath = (name) => {
    const cleaned = normalizeName(name || '');
    if (!cleaned || seenDeaths.has(cleaned.toLowerCase())) {
      return;
    }

    const role = roles.get(cleaned.toLowerCase());
    const isCrewLike = /^(crewmate|crew)\b/i.test(cleaned) || role === 'crewmate';
    if (isCrewLike) {
      stats.crewDeaths += 1;
    }
    seenDeaths.add(cleaned.toLowerCase());
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (/^Player's Roles:/.test(trimmed)) {
      inRolesSection = true;
      continue;
    }

    if (inRolesSection) {
      const roleMatch = trimmed.match(/^(.+?) \(([^)]+)\) : (.+)$/);
      if (roleMatch) {
        roles.set(roleMatch[1].trim().toLowerCase(), roleMatch[3].trim().toLowerCase());
        continue;
      }

      if (/^\[/.test(trimmed)) {
        inRolesSection = false;
      }
    }

    const normalized = trimmed.toLowerCase();

    if (/started\b/i.test(normalized) && (normalized.includes('game') || normalized.includes('on'))) {
      stats.games += 1;
      continue;
    }

    if (/winners?:?.*(impostor|impostors|impostor team)/i.test(normalized) || /impostor team wins|impostors win|impostor wins/.test(normalized)) {
      stats.impWins += 1;
      continue;
    }

    if (/winners?:?.*(crewmate|crewmates|crew)/i.test(normalized) || /crewmates win|crew win|crewmate win/.test(normalized)) {
      stats.crewWins += 1;
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

    const deathLineMatch = trimmed.match(/^(.*?)\s*(?:\([^)]+\))?\s+(?:was killed|died|was eliminated|was ejected|is dead|has died)/i);
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

  return stats;
}

export async function summarizeFiles(files) {
  const summaries = files.map((file) => {
    if (typeof file.text === 'function') {
      return file.text().then((content) => parseLogText(content, file.name));
    }

    return Promise.resolve(parseLogText(String(file), file.name));
  });

  const results = await Promise.all(summaries);

  return results.reduce(
    (acc, result) => {
      acc.games += result.games;
      acc.impWins += result.impWins;
      acc.crewWins += result.crewWins;
      acc.totalKills += result.totalKills;
      acc.crewDeaths += result.crewDeaths;
      acc.filesProcessed += 1;
      return acc;
    },
    {
      games: 0,
      impWins: 0,
      crewWins: 0,
      totalKills: 0,
      crewDeaths: 0,
      filesProcessed: 0
    }
  );
}
