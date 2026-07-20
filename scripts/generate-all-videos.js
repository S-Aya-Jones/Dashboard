require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

// Load program data
const programData = fs.readFileSync('./src/components/workout/program.ts', 'utf8');
const match = programData.match(/const PROGRAMS[\s\S]*?(?=\n\nexport)/);
const programCode = match ? match[0] : '';

// Parse exercises from program
const exercises = [];
const exerciseMatches = programData.matchAll(/id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?formCue:\s*"([^"]+)"/g);
for (const match of exerciseMatches) {
  exercises.push({ id: match[1], name: match[2], formCue: match[3] });
}

const API_KEY = process.env.HEYGEN_API_KEY;
const AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
const VOICE_ID = process.env.HEYGEN_VOICE_ID;

if (!API_KEY || !AVATAR_ID || !VOICE_ID) {
  console.error('Missing HeyGen credentials in .env.local');
  process.exit(1);
}

const results = [];

async function generateVideo(exercise) {
  const script = `Hi! Let's work on ${exercise.name}. ${exercise.formCue}`;

  try {
    const response = await fetch('https://api.heygen.com/v3/videos', {
      method: 'POST',
      headers: {
        'X-HEYGEN-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'avatar',
        avatar_id: AVATAR_ID,
        voice: {
          voice_id: VOICE_ID,
        },
        text: script,
        version: 'latest',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ ${exercise.name}: ${data.error_message || 'Unknown error'}`);
      results.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        videoId: null,
        submittedAt: new Date().toISOString(),
        status: 'failed',
      });
    } else {
      console.log(`✅ ${exercise.name}: ${data.data.video_id}`);
      results.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        videoId: data.data.video_id,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      });
    }
  } catch (err) {
    console.error(`⚠️ ${exercise.name}: ${err.message}`);
    results.push({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      videoId: null,
      submittedAt: new Date().toISOString(),
      status: 'error',
    });
  }
}

async function main() {
  console.log(`🎬 Generating ${exercises.length} videos...`);
  
  for (const exercise of exercises) {
    await generateVideo(exercise);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  fs.writeFileSync('.heygen-results.json', JSON.stringify(results, null, 2));
  
  const pending = results.filter(r => r.status === 'pending').length;
  console.log(`\n✅ ${pending}/${exercises.length} videos submitted!`);
}

main().catch(console.error);
