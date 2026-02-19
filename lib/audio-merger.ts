import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AudioChunk } from './tutorial';

/**
 * Merge audio chunks into a recorded video file using ffmpeg.
 * Each chunk is positioned at its correct time offset using adelay filters.
 * Video stream is copied (no re-encode); audio is encoded as libopus for WebM.
 */
export function mergeAudioWithVideo(
  videoPath: string,
  chunks: AudioChunk[],
  outputPath: string,
): void {
  if (chunks.length === 0) return;

  // Probe the video duration so we can pad audio to match
  const probeResult = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
    { encoding: 'utf-8', timeout: 10_000 },
  ).trim();
  const videoDuration = parseFloat(probeResult);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-audio-'));
  const tmpFiles: string[] = [];

  try {
    // Write each chunk to a temp MP3 file
    for (let i = 0; i < chunks.length; i++) {
      const tmpFile = path.join(tmpDir, `chunk-${i}.mp3`);
      fs.writeFileSync(tmpFile, chunks[i].buffer);
      tmpFiles.push(tmpFile);
    }

    // Build ffmpeg command with adelay filters to position each chunk
    const inputs = tmpFiles.map((f) => `-i "${f}"`).join(' ');
    const filters: string[] = [];

    // When video duration is known, add an anullsrc silent track (input 1) that
    // spans the full video. This ensures amix (duration=longest) keeps the audio
    // stream alive for the entire video — no apad/atrim needed.
    const hasSilenceTrack = !isNaN(videoDuration) && videoDuration > 0;
    const chunkInputOffset = hasSilenceTrack ? 2 : 1; // chunk inputs start after video (and optional silence)

    for (let i = 0; i < chunks.length; i++) {
      const delay = chunks[i].offsetMs;
      filters.push(`[${i + chunkInputOffset}:a]adelay=${delay}|${delay}[a${i}]`);
    }

    const chunkMixInputs = chunks.map((_, i) => `[a${i}]`).join('');
    if (hasSilenceTrack) {
      filters.push(`[1:a]${chunkMixInputs}amix=inputs=${chunks.length + 1}:normalize=0[aout]`);
    } else {
      filters.push(`${chunkMixInputs}amix=inputs=${chunks.length}:normalize=0[aout]`);
    }

    const filterComplex = filters.join(';');

    const silenceInput = hasSilenceTrack
      ? `-f lavfi -t ${videoDuration} -i anullsrc=r=48000:cl=stereo`
      : '';

    const cmd = [
      'ffmpeg -y',
      `-i "${videoPath}"`,
      silenceInput,
      inputs,
      `-filter_complex "${filterComplex}"`,
      '-map 0:v -map "[aout]"',
      '-c:v copy -c:a libopus',
      `"${outputPath}"`,
    ].filter(Boolean).join(' ');

    execSync(cmd, { stdio: 'pipe', timeout: 60_000 });
  } finally {
    // Clean up temp files
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
    try { fs.rmdirSync(tmpDir); } catch {}
  }
}
