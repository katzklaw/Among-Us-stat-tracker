import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLogText, summarizeFiles } from '../src/parser.js';

test('counts impostor wins, kills, and crew deaths from log text', () => {
  const log = [
    'Game 1 started',
    'Crewmate Alice was killed by Impostor Bob',
    'Impostor Bob killed Crewmate Carol',
    'Impostor team wins',
    'Crewmate Dave died during the emergency meeting',
    'Crewmates win'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.impWins, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.totalKills, 2);
  assert.equal(result.crewDeaths, 2);
  assert.equal(result.games, 2);
});

test('parses the sample game log style from the provided logs', () => {
  const log = [
    '[6/27/2026 18:27:04]',
    'Started game on Polus - game mode: Normal',
    '',
    '[6/27/2026 18:27:09]',
    "Player's Roles:",
    'ArtfulDdgr (Pink) : Crewmate',
    'Bane (Orange) : Impostor',
    'Chomp (Green) : Impostor',
    '',
    '[6/27/2026 18:27:40]',
    'Chomp (Green) killed gin (Lime) at Storage',
    '[6/27/2026 18:27:43]',
    'Bane (Orange) killed Frosty (Blue) outside / in a hallway',
    '[6/27/2026 18:27:46]',
    'Meeting started by Chomp (Green)',
    "Frosty (Blue)'s body was found",
    'Players died this round: Frosty (Blue), gin (Lime)',
    '[6/27/2026 18:31:22]',
    'Chomp (Green) killed ArtfulDdgr (Pink) at O2',
    '[6/27/2026 18:31:31]',
    'Meeting started by ItzJdøt (Brown)',
    "ArtfulDdgr (Pink)'s body was found",
    'Players died this round: ArtfulDdgr (Pink)',
    '[6/27/2026 18:37:28]',
    'Winners: Crewmates by voting out Impostors',
    'Chomp (Green) killed 2 players',
    'Bane (Orange) killed 1 players'
  ].join('\n');

  const result = parseLogText(log, 'sample.log');

  assert.equal(result.games, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.impWins, 0);
  assert.equal(result.totalKills, 3);
  assert.equal(result.crewDeaths, 3);
});

test('summarizeFiles aggregates multiple files', async () => {
  const files = [
    new File(['Impostor team wins\nCrewmate Eve was killed by Impostor Frank'], 'a.log', { type: 'text/plain' }),
    new File(['Crewmates win\nImpostor Grace killed Crewmate Heidi'], 'b.log', { type: 'text/plain' })
  ];

  const result = await summarizeFiles(files);

  assert.equal(result.impWins, 1);
  assert.equal(result.crewWins, 1);
  assert.equal(result.totalKills, 2);
  assert.equal(result.crewDeaths, 2);
  assert.equal(result.filesProcessed, 2);
});
