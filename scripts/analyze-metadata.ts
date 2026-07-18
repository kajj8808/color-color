import fs from 'fs';
import path from 'path';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function getAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchTrack(id: string, token: string) {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

async function getArtistGenres(artistId: string, token: string) {
  const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.genres || [];
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars.");
    process.exit(1);
  }

  console.log("Authenticating with Spotify API...");
  const token = await getAccessToken();
  console.log("Successfully authenticated!");

  const dataPath = path.resolve(__dirname, '../public/demo-data-global.json');
  const demoData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`Analyzing ${demoData.length} tracks...`);

  const results = [];

  for (const item of demoData) {
    console.log(`Fetching track ID: ${item.id} (Artist: ${item.artist})...`);
    const track = await fetchTrack(item.id, token);
    
    let releaseYear = "Unknown";
    let genres: string[] = [];
    let realTitle = item.title;

    if (track) {
      realTitle = track.name;
      releaseYear = track.album.release_date ? track.album.release_date.substring(0, 4) : "Unknown";
      if (track.artists && track.artists.length > 0) {
        genres = await getArtistGenres(track.artists[0].id, token);
      }
    } else {
      console.log(`  -> Track not found via API.`);
    }

    results.push({
      title: realTitle,
      artist: item.artist,
      pass: item.pass,
      deltaE: item.bestDeltaE,
      releaseYear,
      genres,
      originalTruth: item.truthColor
    });
    
    await new Promise(r => setTimeout(r, 200));
  }

  const passCount = results.filter(r => r.pass).length;
  console.log(`\n--- ANALYSIS RESULTS ---`);
  console.log(`Total Tracks: ${results.length}`);
  console.log(`Pass Rate: ${passCount}/${results.length} (${Math.round(passCount/results.length*100)}%)`);

  const yearStats: Record<string, { total: number, pass: number }> = {};
  for (const r of results) {
    if (!yearStats[r.releaseYear]) yearStats[r.releaseYear] = { total: 0, pass: 0 };
    yearStats[r.releaseYear].total++;
    if (r.pass) yearStats[r.releaseYear].pass++;
  }

  console.log(`\n--- PASS RATE BY RELEASE YEAR ---`);
  Object.keys(yearStats).sort().forEach(year => {
    const stat = yearStats[year];
    console.log(`${year}: ${stat.pass}/${stat.total} (${Math.round(stat.pass/stat.total*100)}%)`);
  });

  console.log(`\n--- GENRE ANALYSIS ---`);
  console.log("Common genres for FAILED tracks (dE > 6):");
  const failedGenres: Record<string, number> = {};
  results.filter(r => !r.pass).forEach(r => {
    r.genres.forEach(g => {
      failedGenres[g] = (failedGenres[g] || 0) + 1;
    });
  });
  Object.entries(failedGenres).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([g, count]) => {
    console.log(`  - ${g}: ${count} tracks`);
  });

  console.log("\nCommon genres for PASSED tracks (dE < 6):");
  const passedGenres: Record<string, number> = {};
  results.filter(r => r.pass).forEach(r => {
    r.genres.forEach(g => {
      passedGenres[g] = (passedGenres[g] || 0) + 1;
    });
  });
  Object.entries(passedGenres).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([g, count]) => {
    console.log(`  - ${g}: ${count} tracks`);
  });

  fs.writeFileSync(path.resolve(__dirname, 'analysis_results.json'), JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to scripts/analysis_results.json`);
}

main().catch(console.error);
